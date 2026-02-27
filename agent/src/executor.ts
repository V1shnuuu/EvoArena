import { ethers } from "ethers";
import { config } from "./config";
import * as fs from "fs";
import * as path from "path";

// ── ABIs (minimal) ──────────────────────────────────────────────────
const EVOPOOL_ABI = [
  "function getReserves() view returns (uint256, uint256)",
  "function feeBps() view returns (uint256)",
  "function curveBeta() view returns (uint256)",
  "function curveMode() view returns (uint8)",
  "function tradeCount() view returns (uint256)",
  "function cumulativeVolume0() view returns (uint256)",
  "function cumulativeVolume1() view returns (uint256)",
  "function totalSupply() view returns (uint256)",
  "function price0CumulativeLast() view returns (uint256)",
  "function price1CumulativeLast() view returns (uint256)",
  "function protocolFeeBps() view returns (uint256)",
  "function protocolFeeAccum0() view returns (uint256)",
  "function protocolFeeAccum1() view returns (uint256)",
  "event Swap(address indexed sender, bool zeroForOne, uint256 amountIn, uint256 amountOut, uint256 feeAmount)",
  "event ParametersUpdated(uint256 newFeeBps, uint256 newCurveBeta, uint8 newMode, address indexed agent)",
];

const CONTROLLER_ABI = [
  "function registerAgent() payable",
  "function submitParameterUpdate(uint256 newFeeBps, uint256 newCurveBeta, uint8 newCurveMode)",
  "function getAgentInfo(address) view returns (tuple(address agentAddress, uint256 bondAmount, uint256 tokenBondAmount, uint256 registeredAt, uint256 lastUpdateTime, bool active))",
  "function cooldownSeconds() view returns (uint256)",
  "function minBond() view returns (uint256)",
  "function paused() view returns (bool)",
  "event AgentUpdateProposed(address indexed agent, uint256 newFeeBps, uint256 newCurveBeta, uint8 newCurveMode, uint256 timestamp)",
];

// ── Circuit-Breaker thresholds ──────────────────────────────────────
const CIRCUIT_BREAKER = {
  maxReserveImbalance: 0.5,      // halt if reserve ratio > 2:1
  maxConsecutiveErrors: 3,        // halt if 3 errors in a row
  maxGasPriceGwei: 50,           // halt if gas > 50 gwei
  minReserveBps: 100,            // halt if either reserve < 1% of initial
};

export interface UpdateSummary {
  timestamp: string;
  agentAddress: string;
  featuresUsed: Record<string, number | boolean>;
  ruleFired: string;
  currentParams: { feeBps: number; curveBeta: number; curveMode: number };
  proposedParams: { feeBps: number; curveBeta: number; curveMode: number };
  expectedImpact: string;
  txHash?: string;
  dryRun: boolean;
  gasUsed?: string;
}

export interface AlertMessage {
  timestamp: string;
  level: "info" | "warn" | "error" | "critical";
  message: string;
  data?: Record<string, any>;
}

export class Executor {
  private provider: ethers.JsonRpcProvider;
  private wallet: ethers.Wallet;
  private pool: ethers.Contract;
  private controller: ethers.Contract;
  private consecutiveErrors: number = 0;
  private alerts: AlertMessage[] = [];

  constructor() {
    this.provider = new ethers.JsonRpcProvider(config.rpcUrl);
    this.wallet = new ethers.Wallet(config.agentPrivateKey, this.provider);
    this.pool = new ethers.Contract(config.evoPoolAddress, EVOPOOL_ABI, this.wallet);
    this.controller = new ethers.Contract(
      config.agentControllerAddress,
      CONTROLLER_ABI,
      this.wallet
    );
  }

  get agentAddress(): string {
    return this.wallet.address;
  }

  // ── Alerting ────────────────────────────────────────────────────────
  private addAlert(level: AlertMessage["level"], message: string, data?: Record<string, any>): void {
    const alert: AlertMessage = { timestamp: new Date().toISOString(), level, message, data };
    this.alerts.push(alert);
    const prefix = level === "critical" ? "🚨" : level === "error" ? "❌" : level === "warn" ? "⚠️" : "ℹ️";
    console.log(`[alert] ${prefix} ${message}`, data || "");

    // Persist alerts
    const dir = path.resolve(__dirname, "../state");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const alertFile = path.join(dir, "alerts.json");
    let history: AlertMessage[] = [];
    if (fs.existsSync(alertFile)) {
      try { history = JSON.parse(fs.readFileSync(alertFile, "utf-8")); } catch { history = []; }
    }
    history.push(alert);
    // Keep last 500 alerts
    if (history.length > 500) history = history.slice(-500);
    fs.writeFileSync(alertFile, JSON.stringify(history, null, 2));
  }

  getAlerts(): AlertMessage[] { return this.alerts; }

  // ── Circuit Breaker ─────────────────────────────────────────────────
  async checkCircuitBreaker(): Promise<{ safe: boolean; reason?: string }> {
    try {
      // 1. Check consecutive errors
      if (this.consecutiveErrors >= CIRCUIT_BREAKER.maxConsecutiveErrors) {
        this.addAlert("critical", "Circuit breaker: too many consecutive errors", { count: this.consecutiveErrors });
        return { safe: false, reason: `${this.consecutiveErrors} consecutive errors` };
      }

      // 2. Check controller paused
      const paused = await this.controller.paused();
      if (paused) {
        this.addAlert("warn", "Circuit breaker: controller is paused");
        return { safe: false, reason: "controller paused" };
      }

      // 3. Check reserve imbalance
      const [r0, r1] = await this.pool.getReserves();
      const reserve0 = Number(r0);
      const reserve1 = Number(r1);
      if (reserve0 > 0 && reserve1 > 0) {
        const ratio = Math.max(reserve0 / reserve1, reserve1 / reserve0);
        if (ratio > 1 / (1 - CIRCUIT_BREAKER.maxReserveImbalance) + 1) {
          this.addAlert("critical", "Circuit breaker: reserve imbalance too high", { ratio: ratio.toFixed(4) });
          return { safe: false, reason: `reserve ratio ${ratio.toFixed(2)}:1` };
        }
      }

      // 4. Check gas price
      const feeData = await this.provider.getFeeData();
      const gasPriceGwei = Number(feeData.gasPrice || 0n) / 1e9;
      if (gasPriceGwei > CIRCUIT_BREAKER.maxGasPriceGwei) {
        this.addAlert("warn", "Circuit breaker: gas price too high", { gasPriceGwei });
        return { safe: false, reason: `gas ${gasPriceGwei.toFixed(1)} gwei > ${CIRCUIT_BREAKER.maxGasPriceGwei}` };
      }

      return { safe: true };
    } catch (err: any) {
      this.addAlert("error", "Circuit breaker check failed", { error: err.message });
      return { safe: false, reason: `check failed: ${err.message}` };
    }
  }

  async getPoolState() {
    const [reserve0, reserve1] = await this.pool.getReserves();
    const feeBps = await this.pool.feeBps();
    const curveBeta = await this.pool.curveBeta();
    const curveMode = await this.pool.curveMode();
    const tradeCount = await this.pool.tradeCount();
    const vol0 = await this.pool.cumulativeVolume0();
    const vol1 = await this.pool.cumulativeVolume1();

    return {
      reserve0: BigInt(reserve0),
      reserve1: BigInt(reserve1),
      feeBps: Number(feeBps),
      curveBeta: Number(curveBeta),
      curveMode: Number(curveMode),
      tradeCount: Number(tradeCount),
      cumulativeVolume0: BigInt(vol0),
      cumulativeVolume1: BigInt(vol1),
    };
  }

  async getRecentSwaps(blockRange: number = 200) {
    const currentBlock = await this.provider.getBlockNumber();
    const fromBlock = Math.max(0, currentBlock - blockRange);

    const filter = this.pool.filters.Swap();
    const events = await this.pool.queryFilter(filter, fromBlock, currentBlock);

    return events.map((e: any) => ({
      sender: e.args[0],
      zeroForOne: e.args[1],
      amountIn: BigInt(e.args[2]),
      amountOut: BigInt(e.args[3]),
      feeAmount: BigInt(e.args[4]),
      blockNumber: e.blockNumber,
    }));
  }

  async checkRegistration(): Promise<boolean> {
    const info = await this.controller.getAgentInfo(this.agentAddress);
    return info.active;
  }

  async registerIfNeeded(): Promise<void> {
    const registered = await this.checkRegistration();
    if (registered) {
      console.log(`[agent] Already registered: ${this.agentAddress}`);
      return;
    }

    const minBond = await this.controller.minBond();
    console.log(`[agent] Registering with bond ${ethers.formatEther(minBond)} BNB...`);
    const tx = await this.controller.registerAgent({ value: minBond });
    await tx.wait();
    console.log(`[agent] Registered. TX: ${tx.hash}`);
    this.addAlert("info", "Agent registered", { bond: ethers.formatEther(minBond) });
  }

  async submitUpdate(
    newFeeBps: number,
    newCurveBeta: number,
    newCurveMode: number,
    features: Record<string, number | boolean>,
    ruleFired: string,
    dryRun: boolean = false
  ): Promise<UpdateSummary> {
    const state = await this.getPoolState();

    const summary: UpdateSummary = {
      timestamp: new Date().toISOString(),
      agentAddress: this.agentAddress,
      featuresUsed: features,
      ruleFired,
      currentParams: {
        feeBps: state.feeBps,
        curveBeta: state.curveBeta,
        curveMode: state.curveMode,
      },
      proposedParams: {
        feeBps: newFeeBps,
        curveBeta: newCurveBeta,
        curveMode: newCurveMode,
      },
      expectedImpact: `fee ${state.feeBps} → ${newFeeBps}, beta ${state.curveBeta} → ${newCurveBeta}, mode ${state.curveMode} → ${newCurveMode}`,
      dryRun,
    };

    if (dryRun) {
      console.log(`[agent] DRY-RUN: would submit`, summary.proposedParams);
    } else {
      // Check if params actually changed
      if (
        newFeeBps === state.feeBps &&
        newCurveBeta === state.curveBeta &&
        newCurveMode === state.curveMode
      ) {
        console.log(`[agent] No parameter change needed. Skipping.`);
        summary.expectedImpact = "no-change";
        this.saveSummary(summary);
        return summary;
      }

      // Circuit breaker check
      const cb = await this.checkCircuitBreaker();
      if (!cb.safe) {
        console.log(`[agent] ⛔ Circuit breaker tripped: ${cb.reason}. Skipping update.`);
        summary.expectedImpact = `CIRCUIT-BREAKER: ${cb.reason}`;
        this.saveSummary(summary);
        return summary;
      }

      console.log(`[agent] Submitting update:`, summary.proposedParams);
      try {
        const tx = await this.controller.submitParameterUpdate(
          newFeeBps,
          newCurveBeta,
          newCurveMode
        );
        const receipt = await tx.wait();
        summary.txHash = tx.hash;
        summary.gasUsed = receipt.gasUsed?.toString();
        this.consecutiveErrors = 0; // reset on success
        this.addAlert("info", "Parameter update submitted", { txHash: tx.hash, gasUsed: summary.gasUsed });
        console.log(`[agent] ✅ Update submitted. TX: ${tx.hash} (block ${receipt.blockNumber}, gas ${summary.gasUsed})`);
      } catch (err: any) {
        this.consecutiveErrors++;
        this.addAlert("error", "Parameter update failed", { error: err.reason || err.message, consecutiveErrors: this.consecutiveErrors });
        console.error(`[agent] ❌ Update failed:`, err.reason || err.message);
        summary.expectedImpact = `FAILED: ${err.reason || err.message}`;
      }
    }

    this.saveSummary(summary);
    return summary;
  }

  private saveSummary(summary: UpdateSummary): void {
    const dir = path.resolve(__dirname, "../updates");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const filename = `update_${Date.now()}.json`;
    fs.writeFileSync(path.join(dir, filename), JSON.stringify(summary, null, 2));
    console.log(`[agent] Summary saved: updates/${filename}`);
  }
}
