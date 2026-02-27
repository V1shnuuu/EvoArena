import { config } from "./config";
import { Executor } from "./executor";
import { VolatilityCalculator, SwapEvent } from "./volatility";
import { computeSuggestion } from "./strategyEngine";
import { MLStrategyEngine } from "./mlStrategy";
import { CircuitBreaker } from "./circuitBreaker";
import { computeAPS, saveAPSSnapshot } from "./apsCalculator";

const ONCE_MODE = process.argv.includes("--once");
const DRY_RUN = process.argv.includes("--dry-run");
const USE_ML = process.argv.includes("--ml");

let epoch = 0;

async function runEpoch(
  executor: Executor,
  volCalc: VolatilityCalculator,
  mlEngine: MLStrategyEngine,
  circuitBreaker: CircuitBreaker
): Promise<void> {
  epoch++;
  console.log(`\n${"═".repeat(60)}`);
  console.log(`[agent] Epoch ${epoch} — ${new Date().toISOString()}`);
  console.log(`${"═".repeat(60)}`);

  // 1. Get pool state
  const state = await executor.getPoolState();
  console.log(`[agent] Reserves: ${state.reserve0} / ${state.reserve1}`);
  console.log(`[agent] Current params: fee=${state.feeBps}bps, beta=${state.curveBeta}, mode=${state.curveMode}`);
  console.log(`[agent] Trade count: ${state.tradeCount}`);

  // 2. Get recent swaps
  const swaps: SwapEvent[] = await executor.getRecentSwaps(500);
  console.log(`[agent] Recent swaps in window: ${swaps.length}`);

  // 3. Compute market features
  const features = volCalc.computeFeatures(
    swaps,
    state.reserve0,
    state.reserve1,
    config.whaleRatioThreshold
  );
  console.log(`[agent] Features:`, {
    volatility: features.volatility.toFixed(6),
    tradeVelocity: features.tradeVelocity,
    whaleDetected: features.whaleDetected,
    maxWhaleRatio: features.maxWhaleRatio.toFixed(4),
  });

  // 4. Circuit breaker check
  const currentPrice = Number(state.reserve1) > 0
    ? Number(state.reserve0) / Number(state.reserve1)
    : 1;
  const cbResult = circuitBreaker.check(
    state.reserve0,
    state.reserve1,
    currentPrice,
    features
  );
  if (!cbResult.safe) {
    console.log(`[agent] ⛔ Circuit breaker TRIPPED — skipping epoch`);
    for (const a of cbResult.alerts) {
      console.log(`  ${a.type}: ${a.message}`);
    }
    return;
  }
  if (cbResult.alerts.length > 0) {
    console.log(`[agent] ⚠️ ${cbResult.alerts.length} warning(s):`);
    for (const a of cbResult.alerts) {
      console.log(`  ${a.condition}: ${a.message}`);
    }
  }

  // 5. Compute parameter suggestion (rule-based or ML)
  let suggestion;
  let strategyUsed = "rule-based";

  if (USE_ML) {
    const reserveRatio = Number(state.reserve0) > 0 && Number(state.reserve1) > 0
      ? Number(state.reserve0) / Number(state.reserve1)
      : 1;
    const mlSuggestion = mlEngine.computeSuggestion(
      features,
      state.feeBps,
      state.curveBeta,
      state.curveMode,
      reserveRatio
    );
    if (mlSuggestion.modelTrained) {
      suggestion = {
        newFeeBps: mlSuggestion.newFeeBps,
        newCurveBeta: mlSuggestion.newCurveBeta,
        newCurveMode: mlSuggestion.newCurveMode,
        ruleFired: "ml-prediction",
        confidence: mlSuggestion.confidence,
      };
      strategyUsed = "ml";
    } else {
      suggestion = computeSuggestion(features, state.feeBps, state.curveBeta, state.curveMode);
      strategyUsed = "rule-based (ml untrained)";
    }
  } else {
    suggestion = computeSuggestion(features, state.feeBps, state.curveBeta, state.curveMode);
  }

  console.log(`[agent] Strategy: ${strategyUsed}`);
  console.log(`[agent] Rule fired: "${suggestion.ruleFired}" (confidence: ${suggestion.confidence})`);
  console.log(`[agent] Suggestion: fee=${suggestion.newFeeBps}, beta=${suggestion.newCurveBeta}, mode=${suggestion.newCurveMode}`);

  // 6. Submit update
  const featuresMap: Record<string, number | boolean> = {
    volatility: features.volatility,
    tradeVelocity: features.tradeVelocity,
    whaleDetected: features.whaleDetected,
    maxWhaleRatio: features.maxWhaleRatio,
  };

  try {
    const result = await executor.submitUpdate(
      suggestion.newFeeBps,
      suggestion.newCurveBeta,
      suggestion.newCurveMode,
      featuresMap,
      suggestion.ruleFired,
      DRY_RUN
    );

    if (result.txHash) {
      circuitBreaker.recordSuccess();
    }
  } catch (err: any) {
    console.error(`[agent] Update failed:`, err.message);
    circuitBreaker.recordFailure();
  }

  // 7. Compute APS
  const staticFee = config.baseFeeBps;
  const agentFee = suggestion.newFeeBps;
  const totalVolume = Number(state.cumulativeVolume0) + Number(state.cumulativeVolume1);
  const staticLpReturn = totalVolume > 0 ? (staticFee / 10000) * totalVolume : staticFee * state.tradeCount;
  const agentLpReturn = totalVolume > 0 ? (agentFee / 10000) * totalVolume : agentFee * state.tradeCount;

  const avgTradeSize = features.avgTradeSize;
  const reserveTotal = Number(state.reserve0) + Number(state.reserve1);
  const tradeDepthRatio = reserveTotal > 0 ? avgTradeSize / (reserveTotal / 2) : 0;
  const staticSlippage = tradeDepthRatio;
  const agentSlippage = suggestion.newCurveMode === 1
    ? tradeDepthRatio * 0.6
    : suggestion.newCurveMode === 2
      ? tradeDepthRatio * 0.75
      : tradeDepthRatio;

  const staticVol = features.volatility;
  const agentVol = suggestion.newCurveMode === 2
    ? features.volatility * (1 - 0.3 * Math.min(1, suggestion.newCurveBeta / 10000))
    : suggestion.newCurveMode === 1
      ? features.volatility * (1 - 0.2 * Math.min(1, suggestion.newCurveBeta / 10000))
      : features.volatility;

  const apsSnapshot = computeAPS(
    staticLpReturn,
    agentLpReturn,
    staticSlippage,
    agentSlippage,
    staticVol,
    agentVol,
    agentFee * (totalVolume > 0 ? totalVolume / 1e18 : state.tradeCount) * 0.01,
    totalVolume > 0 ? totalVolume / 1e18 : state.tradeCount * 100,
    epoch,
    executor.agentAddress
  );

  saveAPSSnapshot(apsSnapshot);
  console.log(`[agent] APS: ${apsSnapshot.aps}`);

  // 8. Train ML model with APS feedback
  if (USE_ML) {
    const reserveRatio = Number(state.reserve0) > 0 && Number(state.reserve1) > 0
      ? Number(state.reserve0) / Number(state.reserve1) : 1;
    const feeDelta = (suggestion.newFeeBps - state.feeBps) / 50;
    const betaDelta = (suggestion.newCurveBeta - state.curveBeta) / 2000;
    const modeScore = suggestion.newCurveMode === 1 ? 0.75 : suggestion.newCurveMode === 2 ? 0.25 : 0;
    mlEngine.train(features, reserveRatio, feeDelta, betaDelta, modeScore, apsSnapshot.aps);
  }
}

async function main(): Promise<void> {
  console.log("╔══════════════════════════════════════╗");
  console.log("║   EvoArena Agent — Strategy Engine   ║");
  console.log("╚══════════════════════════════════════╝");
  console.log(`Mode: ${ONCE_MODE ? "ONCE" : "LOOP"} ${DRY_RUN ? "(DRY-RUN)" : ""} ${USE_ML ? "(ML)" : "(RULES)"}`);

  if (!config.agentPrivateKey || config.agentPrivateKey === "0xYOUR_AGENT_PRIVATE_KEY_HERE") {
    console.error("[agent] ERROR: AGENT_PRIVATE_KEY not set in .env");
    process.exit(1);
  }
  if (!config.evoPoolAddress) {
    console.error("[agent] ERROR: EVOPOOL_ADDRESS not set in .env");
    process.exit(1);
  }
  if (!config.agentControllerAddress) {
    console.error("[agent] ERROR: AGENT_CONTROLLER_ADDRESS not set in .env");
    process.exit(1);
  }

  const executor = new Executor();
  const volCalc = new VolatilityCalculator(config.emaSmoothingFactor);
  const mlEngine = new MLStrategyEngine();
  const circuitBreaker = new CircuitBreaker();

  console.log(`[agent] Agent address: ${executor.agentAddress}`);

  // Register if needed
  await executor.registerIfNeeded();

  if (ONCE_MODE) {
    await runEpoch(executor, volCalc, mlEngine, circuitBreaker);
    console.log("\n[agent] Single epoch complete. Exiting.");
  } else {
    console.log(`[agent] Polling every ${config.pollIntervalMs}ms...`);

    // Run immediately
    await runEpoch(executor, volCalc, mlEngine, circuitBreaker);

    // Then schedule
    setInterval(async () => {
      try {
        await runEpoch(executor, volCalc, mlEngine, circuitBreaker);
      } catch (err) {
        console.error("[agent] Epoch error:", err);
      }
    }, config.pollIntervalMs);
  }
}

main().catch((err) => {
  console.error("[agent] Fatal error:", err);
  process.exit(1);
});
