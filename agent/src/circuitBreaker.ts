/**
 * Alerting & Circuit Breaker Module
 *
 * Monitors pool state for anomalies and halts agent activity
 * when thresholds are breached.
 *
 * Circuit breaker conditions:
 *  1. Reserve imbalance > 20:1 ratio
 *  2. Price deviation > 50% from last known baseline
 *  3. Consecutive failed transactions > 3
 *  4. Agent bond balance below minimum
 *  5. Volatility spike > 10x normal
 */

import { MarketFeatures } from "./volatility";
import { config } from "./config";
import * as fs from "fs";
import * as path from "path";

export interface Alert {
  type: "warning" | "critical" | "circuit-breaker";
  condition: string;
  message: string;
  timestamp: string;
  value: number;
  threshold: number;
}

export interface CircuitBreakerState {
  tripped: boolean;
  reason: string;
  trippedAt: string | null;
  consecutiveFailures: number;
  lastKnownPrice: number;
  baselineVolatility: number;
  alerts: Alert[];
}

const STATE_FILE = path.resolve(__dirname, "../state/circuit_breaker.json");

export class CircuitBreaker {
  private state: CircuitBreakerState;

  // Thresholds
  private readonly MAX_RESERVE_RATIO = 20;       // 20:1 imbalance
  private readonly MAX_PRICE_DEVIATION = 0.5;     // 50% from baseline
  private readonly MAX_CONSECUTIVE_FAILS = 3;
  private readonly VOLATILITY_SPIKE_MULTIPLIER = 10;
  private readonly MAX_ALERTS_STORED = 100;

  constructor() {
    this.state = this.loadState();
  }

  private loadState(): CircuitBreakerState {
    try {
      if (fs.existsSync(STATE_FILE)) {
        return JSON.parse(fs.readFileSync(STATE_FILE, "utf-8"));
      }
    } catch { /* use default */ }
    return {
      tripped: false,
      reason: "",
      trippedAt: null,
      consecutiveFailures: 0,
      lastKnownPrice: 0,
      baselineVolatility: 0.01,
      alerts: [],
    };
  }

  private saveState(): void {
    const dir = path.dirname(STATE_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(STATE_FILE, JSON.stringify(this.state, null, 2));
  }

  private addAlert(alert: Alert): void {
    this.state.alerts.push(alert);
    if (this.state.alerts.length > this.MAX_ALERTS_STORED) {
      this.state.alerts = this.state.alerts.slice(-this.MAX_ALERTS_STORED);
    }

    const prefix = alert.type === "critical" ? "🚨" : alert.type === "circuit-breaker" ? "⛔" : "⚠️";
    console.log(`[circuit-breaker] ${prefix} ${alert.condition}: ${alert.message}`);
  }

  /**
   * Check all conditions and return whether the agent should proceed.
   */
  check(
    reserve0: bigint,
    reserve1: bigint,
    currentPrice: number,
    features: MarketFeatures,
    bondBalance?: bigint
  ): { safe: boolean; alerts: Alert[] } {
    const newAlerts: Alert[] = [];

    if (this.state.tripped) {
      return { safe: false, alerts: [{ type: "circuit-breaker", condition: "already-tripped", message: `Circuit breaker active since ${this.state.trippedAt}: ${this.state.reason}`, timestamp: new Date().toISOString(), value: 0, threshold: 0 }] };
    }

    // 1. Reserve imbalance check
    const r0 = Number(reserve0);
    const r1 = Number(reserve1);
    if (r0 > 0 && r1 > 0) {
      const ratio = Math.max(r0 / r1, r1 / r0);
      if (ratio > this.MAX_RESERVE_RATIO) {
        const alert: Alert = {
          type: "circuit-breaker",
          condition: "reserve-imbalance",
          message: `Reserve ratio ${ratio.toFixed(1)}:1 exceeds ${this.MAX_RESERVE_RATIO}:1 limit`,
          timestamp: new Date().toISOString(),
          value: ratio,
          threshold: this.MAX_RESERVE_RATIO,
        };
        newAlerts.push(alert);
        this.trip(`Reserve imbalance: ${ratio.toFixed(1)}:1`);
      } else if (ratio > this.MAX_RESERVE_RATIO * 0.5) {
        newAlerts.push({
          type: "warning",
          condition: "reserve-imbalance-warning",
          message: `Reserve ratio ${ratio.toFixed(1)}:1 approaching limit`,
          timestamp: new Date().toISOString(),
          value: ratio,
          threshold: this.MAX_RESERVE_RATIO,
        });
      }
    }

    // 2. Price deviation check
    if (this.state.lastKnownPrice > 0 && currentPrice > 0) {
      const deviation = Math.abs(currentPrice - this.state.lastKnownPrice) / this.state.lastKnownPrice;
      if (deviation > this.MAX_PRICE_DEVIATION) {
        const alert: Alert = {
          type: "circuit-breaker",
          condition: "price-deviation",
          message: `Price deviated ${(deviation * 100).toFixed(1)}% from baseline ${this.state.lastKnownPrice.toFixed(4)}`,
          timestamp: new Date().toISOString(),
          value: deviation,
          threshold: this.MAX_PRICE_DEVIATION,
        };
        newAlerts.push(alert);
        this.trip(`Price deviation: ${(deviation * 100).toFixed(1)}%`);
      } else if (deviation > this.MAX_PRICE_DEVIATION * 0.5) {
        newAlerts.push({
          type: "warning",
          condition: "price-deviation-warning",
          message: `Price deviated ${(deviation * 100).toFixed(1)}% from baseline`,
          timestamp: new Date().toISOString(),
          value: deviation,
          threshold: this.MAX_PRICE_DEVIATION,
        });
      }
    }
    // Update baseline
    if (currentPrice > 0) this.state.lastKnownPrice = currentPrice;

    // 3. Consecutive failures
    if (this.state.consecutiveFailures >= this.MAX_CONSECUTIVE_FAILS) {
      const alert: Alert = {
        type: "circuit-breaker",
        condition: "consecutive-failures",
        message: `${this.state.consecutiveFailures} consecutive transaction failures`,
        timestamp: new Date().toISOString(),
        value: this.state.consecutiveFailures,
        threshold: this.MAX_CONSECUTIVE_FAILS,
      };
      newAlerts.push(alert);
      this.trip(`${this.state.consecutiveFailures} consecutive failures`);
    }

    // 4. Bond balance check
    if (bondBalance !== undefined) {
      const minBondWei = BigInt(Math.floor(0.005 * 1e18)); // 0.005 BNB warning threshold
      if (bondBalance < minBondWei) {
        newAlerts.push({
          type: "critical",
          condition: "low-bond",
          message: `Bond balance critically low: ${Number(bondBalance) / 1e18} BNB`,
          timestamp: new Date().toISOString(),
          value: Number(bondBalance) / 1e18,
          threshold: 0.005,
        });
      }
    }

    // 5. Volatility spike
    if (this.state.baselineVolatility > 0 && features.volatility > 0) {
      const spike = features.volatility / this.state.baselineVolatility;
      if (spike > this.VOLATILITY_SPIKE_MULTIPLIER) {
        const alert: Alert = {
          type: "circuit-breaker",
          condition: "volatility-spike",
          message: `Volatility spike ${spike.toFixed(1)}x above baseline`,
          timestamp: new Date().toISOString(),
          value: spike,
          threshold: this.VOLATILITY_SPIKE_MULTIPLIER,
        };
        newAlerts.push(alert);
        this.trip(`Volatility spike: ${spike.toFixed(1)}x`);
      }
    }
    // Update baseline EMA
    if (features.volatility > 0) {
      this.state.baselineVolatility = 0.95 * this.state.baselineVolatility + 0.05 * features.volatility;
    }

    // Record alerts
    for (const a of newAlerts) this.addAlert(a);
    this.saveState();

    return { safe: !this.state.tripped, alerts: newAlerts };
  }

  /** Record a successful transaction. Resets failure counter. */
  recordSuccess(): void {
    this.state.consecutiveFailures = 0;
    this.saveState();
  }

  /** Record a failed transaction. Increments failure counter. */
  recordFailure(): void {
    this.state.consecutiveFailures++;
    this.saveState();
  }

  /** Manually reset the circuit breaker. */
  reset(): void {
    this.state.tripped = false;
    this.state.reason = "";
    this.state.trippedAt = null;
    this.state.consecutiveFailures = 0;
    this.saveState();
    console.log("[circuit-breaker] ✅ Reset — agent can resume operations");
  }

  isTripped(): boolean {
    return this.state.tripped;
  }

  getState(): CircuitBreakerState {
    return { ...this.state };
  }

  private trip(reason: string): void {
    this.state.tripped = true;
    this.state.reason = reason;
    this.state.trippedAt = new Date().toISOString();
    this.saveState();
  }
}
