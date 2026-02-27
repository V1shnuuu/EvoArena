/**
 * Historical Backtesting Framework
 *
 * Replays recorded swap events through the strategy engine
 * to evaluate how different parameter configurations would have performed.
 *
 * Usage:
 *   ts-node src/backtester.ts [--epochs 100] [--strategy rule|ml]
 */

import { VolatilityCalculator, SwapEvent } from "./volatility";
import { computeSuggestion } from "./strategyEngine";
import { computeAPS, APSSnapshot } from "./apsCalculator";
import { config } from "./config";
import * as fs from "fs";
import * as path from "path";

export interface BacktestConfig {
  /** Number of simulated epochs to run */
  epochs: number;
  /** Swaps per epoch (simulated) */
  swapsPerEpoch: number;
  /** Initial reserves */
  initialReserve0: number;
  initialReserve1: number;
  /** Initial parameters */
  initialFeeBps: number;
  initialCurveBeta: number;
  initialCurveMode: number;
  /** Volatility scenario */
  volatilityScenario: "low" | "medium" | "high" | "spike" | "random";
  /** Include whale trades? */
  includeWhales: boolean;
}

export interface BacktestResult {
  config: BacktestConfig;
  epochs: BacktestEpoch[];
  totalAPS: number;
  avgAPS: number;
  maxAPS: number;
  minAPS: number;
  totalFeeRevenue: number;
  avgSlippage: number;
  rulesDistribution: Record<string, number>;
  timestamp: string;
}

export interface BacktestEpoch {
  epochNumber: number;
  feeBps: number;
  curveBeta: number;
  curveMode: number;
  ruleFired: string;
  aps: number;
  swapCount: number;
  volume: number;
  volatility: number;
}

const DEFAULT_CONFIG: BacktestConfig = {
  epochs: 50,
  swapsPerEpoch: 20,
  initialReserve0: 10000,
  initialReserve1: 10000,
  initialFeeBps: 30,
  initialCurveBeta: 5000,
  initialCurveMode: 0,
  volatilityScenario: "medium",
  includeWhales: true,
};

/**
 * Generate synthetic swap events for backtesting.
 */
function generateSwaps(
  count: number,
  reserve0: number,
  reserve1: number,
  scenario: string,
  includeWhales: boolean
): SwapEvent[] {
  const swaps: SwapEvent[] = [];

  for (let i = 0; i < count; i++) {
    const zeroForOne = Math.random() > 0.5;

    // Base trade size: 0.1% - 2% of reserve
    let tradeRatio = 0.001 + Math.random() * 0.019;

    // Scenario-based adjustments
    switch (scenario) {
      case "low":
        tradeRatio *= 0.3;
        break;
      case "high":
        tradeRatio *= 2.5;
        break;
      case "spike":
        tradeRatio *= i % 5 === 0 ? 5 : 0.5;
        break;
      case "random":
        tradeRatio *= 0.1 + Math.random() * 5;
        break;
      // "medium" uses default
    }

    // Whale trades
    if (includeWhales && Math.random() < 0.05) {
      tradeRatio = 0.06 + Math.random() * 0.1; // 6-16% of reserve
    }

    const reserveIn = zeroForOne ? reserve0 : reserve1;
    const amountIn = BigInt(Math.floor(reserveIn * tradeRatio * 1e18));

    // Simple CPMM output
    const reserveOut = zeroForOne ? reserve1 : reserve0;
    const amountInNum = Number(amountIn) / 1e18;
    const output = (reserveOut * amountInNum) / (reserveIn + amountInNum);
    const feeAmount = BigInt(Math.floor(amountInNum * 0.003 * 1e18));

    swaps.push({
      sender: "0x" + "0".repeat(40),
      zeroForOne,
      amountIn,
      amountOut: BigInt(Math.floor(output * 1e18)),
      feeAmount,
      blockNumber: 1000 + i,
    });
  }

  return swaps;
}

/**
 * Run a full backtest simulation.
 */
export function runBacktest(userConfig?: Partial<BacktestConfig>): BacktestResult {
  const cfg = { ...DEFAULT_CONFIG, ...userConfig };
  const volCalc = new VolatilityCalculator(config.emaSmoothingFactor);

  let feeBps = cfg.initialFeeBps;
  let curveBeta = cfg.initialCurveBeta;
  let curveMode = cfg.initialCurveMode;
  let reserve0 = cfg.initialReserve0;
  let reserve1 = cfg.initialReserve1;

  const epochs: BacktestEpoch[] = [];
  const rulesDistribution: Record<string, number> = {};
  let totalAPS = 0;
  let maxAPS = -Infinity;
  let minAPS = Infinity;
  let totalFeeRevenue = 0;
  let totalSlippage = 0;

  console.log(`[backtest] Running ${cfg.epochs} epochs, ${cfg.swapsPerEpoch} swaps/epoch, scenario: ${cfg.volatilityScenario}`);

  for (let e = 1; e <= cfg.epochs; e++) {
    // Generate synthetic swaps
    const swaps = generateSwaps(
      cfg.swapsPerEpoch,
      reserve0,
      reserve1,
      cfg.volatilityScenario,
      cfg.includeWhales
    );

    // Compute features
    const features = volCalc.computeFeatures(
      swaps,
      BigInt(Math.floor(reserve0 * 1e18)),
      BigInt(Math.floor(reserve1 * 1e18)),
      config.whaleRatioThreshold
    );

    // Get suggestion from strategy engine
    const suggestion = computeSuggestion(features, feeBps, curveBeta, curveMode);

    // Apply suggestion
    const prevFee = feeBps;
    feeBps = suggestion.newFeeBps;
    curveBeta = suggestion.newCurveBeta;
    curveMode = suggestion.newCurveMode;

    // Simulate volume
    let epochVolume = 0;
    for (const s of swaps) {
      epochVolume += Number(s.amountIn) / 1e18;
    }

    // Compute epoch APS
    const staticFee = cfg.initialFeeBps;
    const staticLpReturn = epochVolume * (staticFee / 10000);
    const agentLpReturn = epochVolume * (feeBps / 10000);
    const tradeDepth = reserve0 > 0 ? features.avgTradeSize / (reserve0 * 1e18) : 0;
    const staticSlippage = tradeDepth;
    const agentSlippage = curveMode === 1 ? tradeDepth * 0.6 : curveMode === 2 ? tradeDepth * 0.75 : tradeDepth;

    const apsSnapshot = computeAPS(
      staticLpReturn, agentLpReturn,
      staticSlippage, agentSlippage,
      features.volatility, features.volatility * (curveMode > 0 ? 0.8 : 1),
      agentLpReturn, epochVolume,
      e, "backtest-agent"
    );

    totalAPS += apsSnapshot.aps;
    if (apsSnapshot.aps > maxAPS) maxAPS = apsSnapshot.aps;
    if (apsSnapshot.aps < minAPS) minAPS = apsSnapshot.aps;
    totalFeeRevenue += agentLpReturn;
    totalSlippage += Number(agentSlippage);

    rulesDistribution[suggestion.ruleFired] = (rulesDistribution[suggestion.ruleFired] || 0) + 1;

    epochs.push({
      epochNumber: e,
      feeBps,
      curveBeta,
      curveMode,
      ruleFired: suggestion.ruleFired,
      aps: apsSnapshot.aps,
      swapCount: swaps.length,
      volume: epochVolume,
      volatility: features.volatility,
    });

    // Update reserves (simplified)
    for (const s of swaps) {
      const inAmt = Number(s.amountIn) / 1e18;
      const outAmt = Number(s.amountOut) / 1e18;
      if (s.zeroForOne) {
        reserve0 += inAmt;
        reserve1 = Math.max(1, reserve1 - outAmt);
      } else {
        reserve1 += inAmt;
        reserve0 = Math.max(1, reserve0 - outAmt);
      }
    }
  }

  const result: BacktestResult = {
    config: cfg,
    epochs,
    totalAPS,
    avgAPS: totalAPS / cfg.epochs,
    maxAPS,
    minAPS,
    totalFeeRevenue,
    avgSlippage: totalSlippage / cfg.epochs,
    rulesDistribution,
    timestamp: new Date().toISOString(),
  };

  // Save result
  const dir = path.resolve(__dirname, "../state");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "backtest_latest.json"), JSON.stringify(result, null, 2));
  console.log(`[backtest] Complete. Avg APS: ${result.avgAPS.toFixed(4)}, Total fee revenue: ${result.totalFeeRevenue.toFixed(2)}`);

  return result;
}

// CLI entry point
if (require.main === module) {
  const epochs = parseInt(process.argv.find(a => a.startsWith("--epochs="))?.split("=")[1] || "50", 10);
  const scenario = (process.argv.find(a => a.startsWith("--scenario="))?.split("=")[1] || "medium") as BacktestConfig["volatilityScenario"];

  console.log("╔══════════════════════════════════════╗");
  console.log("║  EvoArena Backtesting Framework      ║");
  console.log("╚══════════════════════════════════════╝");

  const result = runBacktest({ epochs, volatilityScenario: scenario });

  console.log("\n── Summary ──────────────────────────────");
  console.log(`  Epochs:       ${result.config.epochs}`);
  console.log(`  Scenario:     ${result.config.volatilityScenario}`);
  console.log(`  Avg APS:      ${result.avgAPS.toFixed(4)}`);
  console.log(`  Max APS:      ${result.maxAPS.toFixed(4)}`);
  console.log(`  Min APS:      ${result.minAPS.toFixed(4)}`);
  console.log(`  Fee Revenue:  ${result.totalFeeRevenue.toFixed(2)}`);
  console.log(`  Avg Slippage: ${result.avgSlippage.toExponential(3)}`);
  console.log(`\n── Rules Distribution ───────────────────`);
  for (const [rule, count] of Object.entries(result.rulesDistribution)) {
    console.log(`  ${rule}: ${count} (${((count / result.config.epochs) * 100).toFixed(1)}%)`);
  }
  console.log(`\nResults saved to agent/state/backtest_latest.json`);
}
