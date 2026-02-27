/**
 * ML-Based Strategy Engine
 *
 * Uses online linear regression on recent feature vectors to
 * predict optimal parameters rather than pure rule-based logic.
 *
 * Model: y_predicted = W · x + b
 * Where:
 *   x = [volatility, tradeVelocity, whaleRatio, priceChange, reserveRatio]
 *   y = [feeDelta, betaDelta, modeScore]
 *
 * Trains incrementally using gradient descent on observed APS feedback.
 */

import { MarketFeatures } from "./volatility";
import { config } from "./config";
import * as fs from "fs";
import * as path from "path";

export interface MLModelState {
  weights: number[][]; // 3 x 5 matrix (outputs x features)
  biases: number[];    // 3 biases
  learningRate: number;
  trainCount: number;
  avgLoss: number;
}

const NUM_FEATURES = 5;
const NUM_OUTPUTS = 3; // feeDelta, betaDelta, modeScore

const DEFAULT_STATE: MLModelState = {
  weights: Array.from({ length: NUM_OUTPUTS }, () => Array(NUM_FEATURES).fill(0)),
  biases: [0, 0, 0],
  learningRate: 0.01,
  trainCount: 0,
  avgLoss: 0,
};

const STATE_FILE = path.resolve(__dirname, "../state/ml_model.json");

export class MLStrategyEngine {
  private model: MLModelState;

  constructor() {
    this.model = this.loadModel();
  }

  private loadModel(): MLModelState {
    try {
      if (fs.existsSync(STATE_FILE)) {
        return JSON.parse(fs.readFileSync(STATE_FILE, "utf-8"));
      }
    } catch { /* use default */ }
    return { ...DEFAULT_STATE, weights: DEFAULT_STATE.weights.map(r => [...r]) };
  }

  private saveModel(): void {
    const dir = path.dirname(STATE_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(STATE_FILE, JSON.stringify(this.model, null, 2));
  }

  /**
   * Extract feature vector from market features.
   */
  private extractFeatures(features: MarketFeatures, reserveRatio: number): number[] {
    return [
      features.volatility,
      features.tradeVelocity / 100,       // normalize
      features.maxWhaleRatio,
      features.priceChangeAbs,
      reserveRatio,
    ];
  }

  /**
   * Forward pass: y = Wx + b
   */
  private predict(featureVec: number[]): number[] {
    return this.model.weights.map((w, i) => {
      let sum = this.model.biases[i];
      for (let j = 0; j < NUM_FEATURES; j++) {
        sum += w[j] * featureVec[j];
      }
      return sum;
    });
  }

  /**
   * Compute suggested parameters using ML model.
   * Falls back to rule-based if model is untrained.
   */
  computeSuggestion(
    features: MarketFeatures,
    currentFeeBps: number,
    currentCurveBeta: number,
    _currentCurveMode: number,
    reserveRatio: number
  ): { newFeeBps: number; newCurveBeta: number; newCurveMode: number; confidence: number; modelTrained: boolean } {
    const featureVec = this.extractFeatures(features, reserveRatio);
    const [feeDelta, betaDelta, modeScore] = this.predict(featureVec);

    const isTrained = this.model.trainCount >= 5;

    if (!isTrained) {
      // Not enough training data — return no-change signal
      return {
        newFeeBps: currentFeeBps,
        newCurveBeta: currentCurveBeta,
        newCurveMode: _currentCurveMode,
        confidence: 0,
        modelTrained: false,
      };
    }

    // Apply deltas with clamping
    let newFee = Math.round(currentFeeBps + feeDelta * 50); // scale to bps range
    let newBeta = Math.round(currentCurveBeta + betaDelta * 2000); // scale to beta range

    // Determine mode from score
    let newMode: number;
    if (modeScore > 0.5) newMode = 1;        // Defensive
    else if (modeScore > 0.0) newMode = 2;   // VolatilityAdaptive
    else newMode = 0;                          // Normal

    // Clamp deltas
    const fDelta = newFee - currentFeeBps;
    if (Math.abs(fDelta) > config.maxFeeDelta) {
      newFee = fDelta > 0 ? currentFeeBps + config.maxFeeDelta : currentFeeBps - config.maxFeeDelta;
    }
    const bDelta = newBeta - currentCurveBeta;
    if (Math.abs(bDelta) > config.maxBetaDelta) {
      newBeta = bDelta > 0 ? currentCurveBeta + config.maxBetaDelta : currentCurveBeta - config.maxBetaDelta;
    }

    newFee = Math.max(0, Math.min(newFee, config.maxFeeBps));
    newBeta = Math.max(0, Math.min(newBeta, 10000));

    return {
      newFeeBps: newFee,
      newCurveBeta: newBeta,
      newCurveMode: newMode,
      confidence: Math.min(0.95, 0.5 + this.model.trainCount * 0.01),
      modelTrained: true,
    };
  }

  /**
   * Train model with observed APS as feedback signal.
   * Uses simple gradient descent with MSE loss.
   *
   * @param features Market features at decision time
   * @param reserveRatio Reserve ratio at decision time
   * @param appliedFeeDelta Actual fee delta applied (normalized)
   * @param appliedBetaDelta Actual beta delta applied (normalized)
   * @param appliedModeScore Actual mode score (0, 0.25, 0.75 for modes 0,1,2)
   * @param apsReward The APS score received (higher is better)
   */
  train(
    features: MarketFeatures,
    reserveRatio: number,
    appliedFeeDelta: number,
    appliedBetaDelta: number,
    appliedModeScore: number,
    apsReward: number
  ): void {
    const featureVec = this.extractFeatures(features, reserveRatio);
    const predicted = this.predict(featureVec);

    // Target: scale the applied actions by the APS reward
    // Positive APS reinforces actions; negative APS pushes away
    // Clamp to [-2, 2] range to prevent gradient explosion
    const rewardScale = Math.max(-2, Math.min(2, apsReward * 10));
    const targets = [
      appliedFeeDelta * rewardScale,
      appliedBetaDelta * rewardScale,
      appliedModeScore * rewardScale,
    ];

    // Compute gradients and update
    let totalLoss = 0;
    for (let i = 0; i < NUM_OUTPUTS; i++) {
      const error = predicted[i] - targets[i];
      totalLoss += error * error;

      // Update weights: w -= lr * error * x
      for (let j = 0; j < NUM_FEATURES; j++) {
        this.model.weights[i][j] -= this.model.learningRate * error * featureVec[j];
      }
      // Update bias: b -= lr * error
      this.model.biases[i] -= this.model.learningRate * error;
    }

    this.model.trainCount++;
    this.model.avgLoss = this.model.avgLoss * 0.9 + (totalLoss / NUM_OUTPUTS) * 0.1;

    this.saveModel();
    console.log(`[ml] Trained step ${this.model.trainCount}, avg loss: ${this.model.avgLoss.toFixed(6)}`);
  }

  getModelState(): MLModelState {
    return { ...this.model };
  }
}
