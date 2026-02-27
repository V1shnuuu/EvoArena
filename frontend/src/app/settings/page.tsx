"use client";

import { useState, useEffect } from "react";
import { useWallet } from "@/hooks/useWallet";
import { ethers } from "ethers";
import { CONTROLLER_ABI, EVOPOOL_ABI, ADDRESSES, CURVE_MODES } from "@/lib/contracts";

/**
 * #30 — Configurable Strategy via UI
 *
 * Allows registered agents to submit parameter updates (fee, curveBeta, curveMode)
 * directly from the UI. Shows current pool state and agent status.
 */
export default function SettingsPage() {
  const { signer, connected, address } = useWallet();

  // Pool state
  const [currentFee, setCurrentFee] = useState("0");
  const [currentBeta, setCurrentBeta] = useState("0");
  const [currentMode, setCurrentMode] = useState(0);

  // Agent state
  const [isAgent, setIsAgent] = useState(false);
  const [bondAmount, setBondAmount] = useState("0");
  const [cooldown, setCooldown] = useState(0);
  const [lastUpdate, setLastUpdate] = useState(0);
  const [canUpdate, setCanUpdate] = useState(false);

  // Form
  const [newFee, setNewFee] = useState("");
  const [newBeta, setNewBeta] = useState("");
  const [newMode, setNewMode] = useState("0");
  const [submitting, setSubmitting] = useState(false);
  const [txHash, setTxHash] = useState("");
  const [error, setError] = useState("");

  // Registration
  const [bondInput, setBondInput] = useState("0.01");
  const [registering, setRegistering] = useState(false);

  useEffect(() => {
    if (!signer || !address) return;
    loadState();
  }, [signer, address]);

  async function loadState() {
    try {
      const pool = new ethers.Contract(ADDRESSES.evoPool, EVOPOOL_ABI, signer!);
      const controller = new ethers.Contract(ADDRESSES.agentController, CONTROLLER_ABI, signer!);

      const [fee, beta, mode] = await Promise.all([
        pool.feeBps(),
        pool.curveBeta(),
        pool.curveMode(),
      ]);
      setCurrentFee(fee.toString());
      setCurrentBeta(beta.toString());
      setCurrentMode(Number(mode));
      setNewFee(fee.toString());
      setNewBeta(beta.toString());
      setNewMode(mode.toString());

      // Agent info
      const info = await controller.getAgentInfo(address);
      setIsAgent(info.active);
      setBondAmount(ethers.formatEther(info.bondAmount));
      setLastUpdate(Number(info.lastUpdateTime));

      const cd = await controller.cooldownSeconds();
      setCooldown(Number(cd));

      const now = Math.floor(Date.now() / 1000);
      setCanUpdate(info.active && now - Number(info.lastUpdateTime) >= Number(cd));
    } catch (err: any) {
      console.error("Load state error:", err);
    }
  }

  async function handleRegister() {
    if (!signer) return;
    setRegistering(true);
    setError("");
    try {
      const controller = new ethers.Contract(ADDRESSES.agentController, CONTROLLER_ABI, signer);
      const tx = await controller.registerAgent({ value: ethers.parseEther(bondInput) });
      await tx.wait();
      await loadState();
    } catch (err: any) {
      setError(err.reason || err.message);
    } finally {
      setRegistering(false);
    }
  }

  async function handleSubmit() {
    if (!signer) return;
    setSubmitting(true);
    setError("");
    setTxHash("");
    try {
      const controller = new ethers.Contract(ADDRESSES.agentController, CONTROLLER_ABI, signer);
      const tx = await controller.submitParameterUpdate(
        parseInt(newFee),
        parseInt(newBeta),
        parseInt(newMode)
      );
      setTxHash(tx.hash);
      await tx.wait();
      await loadState();
    } catch (err: any) {
      setError(err.reason || err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (!connected) {
    return (
      <main className="max-w-2xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-amber-400 mb-4">⚙️ Agent Settings</h1>
        <p className="text-gray-400">Connect your wallet to manage agent strategy.</p>
      </main>
    );
  }

  return (
    <main className="max-w-2xl mx-auto px-4 py-8 space-y-8">
      <h1 className="text-2xl font-bold text-amber-400">⚙️ Agent Settings</h1>

      {/* ── Current Pool State ───────────────────────────────────── */}
      <section className="bg-gray-800 rounded-lg p-6 space-y-2">
        <h2 className="text-lg font-semibold text-gray-200 mb-3">Current Pool State</h2>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-xs text-gray-400">Fee (bps)</p>
            <p className="text-xl font-mono text-white">{currentFee}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Curve Beta</p>
            <p className="text-xl font-mono text-white">{currentBeta}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Curve Mode</p>
            <p className="text-xl font-mono text-white">{CURVE_MODES[currentMode] || "Unknown"}</p>
          </div>
        </div>
      </section>

      {/* ── Agent Status ─────────────────────────────────────────── */}
      {!isAgent ? (
        <section className="bg-gray-800 rounded-lg p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-200">Register as Agent</h2>
          <p className="text-sm text-gray-400">
            You are not a registered agent. Register with a bond to start submitting parameter updates.
          </p>
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <label className="text-xs text-gray-400">Bond Amount (BNB)</label>
              <input
                type="number"
                step="0.001"
                value={bondInput}
                onChange={(e) => setBondInput(e.target.value)}
                className="mt-1 w-full bg-gray-700 text-white rounded px-3 py-2 text-sm"
              />
            </div>
            <button
              onClick={handleRegister}
              disabled={registering}
              className="bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-black font-semibold px-6 py-2 rounded"
            >
              {registering ? "Registering..." : "Register"}
            </button>
          </div>
        </section>
      ) : (
        <section className="bg-gray-800 rounded-lg p-6 space-y-2">
          <h2 className="text-lg font-semibold text-gray-200 mb-3">Agent Status</h2>
          <div className="grid grid-cols-2 gap-4 text-center">
            <div>
              <p className="text-xs text-gray-400">Bond</p>
              <p className="text-lg font-mono text-green-400">{bondAmount} BNB</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Cooldown Ready</p>
              <p className={`text-lg font-mono ${canUpdate ? "text-green-400" : "text-red-400"}`}>
                {canUpdate ? "✓ Ready" : "✗ Cooling down"}
              </p>
            </div>
          </div>
        </section>
      )}

      {/* ── Submit Parameter Update ──────────────────────────────── */}
      {isAgent && (
        <section className="bg-gray-800 rounded-lg p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-200">Submit Parameter Update</h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-xs text-gray-400">Fee (bps)</label>
              <input
                type="number"
                min="0"
                max="500"
                value={newFee}
                onChange={(e) => setNewFee(e.target.value)}
                className="mt-1 w-full bg-gray-700 text-white rounded px-3 py-2 text-sm"
              />
              <p className="text-xs text-gray-500 mt-1">Current: {currentFee}</p>
            </div>
            <div>
              <label className="text-xs text-gray-400">Curve Beta</label>
              <input
                type="number"
                min="0"
                max="10000"
                value={newBeta}
                onChange={(e) => setNewBeta(e.target.value)}
                className="mt-1 w-full bg-gray-700 text-white rounded px-3 py-2 text-sm"
              />
              <p className="text-xs text-gray-500 mt-1">Current: {currentBeta}</p>
            </div>
            <div>
              <label className="text-xs text-gray-400">Curve Mode</label>
              <select
                value={newMode}
                onChange={(e) => setNewMode(e.target.value)}
                className="mt-1 w-full bg-gray-700 text-white rounded px-3 py-2 text-sm"
              >
                {CURVE_MODES.map((mode, i) => (
                  <option key={i} value={i}>
                    {mode}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">Current: {CURVE_MODES[currentMode]}</p>
            </div>
          </div>

          <button
            onClick={handleSubmit}
            disabled={submitting || !canUpdate}
            className="w-full bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-black font-bold py-3 rounded text-sm"
          >
            {submitting ? "Submitting..." : canUpdate ? "Submit Update" : "Cooldown Active"}
          </button>

          {txHash && (
            <p className="text-xs text-green-400 break-all">
              ✓ TX: <a href={`https://testnet.bscscan.com/tx/${txHash}`} target="_blank" rel="noopener noreferrer" className="underline">{txHash}</a>
            </p>
          )}
          {error && <p className="text-xs text-red-400">Error: {error}</p>}
        </section>
      )}

      {/* ── Strategy Tips ────────────────────────────────────────── */}
      <section className="bg-gray-800/50 rounded-lg p-6">
        <h2 className="text-lg font-semibold text-gray-200 mb-3">💡 Strategy Guide</h2>
        <ul className="text-sm text-gray-400 space-y-2 list-disc list-inside">
          <li><strong>Normal</strong>: Standard constant-product. Good for stable markets.</li>
          <li><strong>Defensive</strong>: Higher slippage for large trades. Use during whale activity.</li>
          <li><strong>VolatilityAdaptive</strong>: Linear penalty scaling. Best for volatile markets.</li>
          <li>Lower <strong>feeBps</strong> attracts more volume; higher fees protect against IL.</li>
          <li>Higher <strong>curveBeta</strong> concentrates liquidity around the current price.</li>
        </ul>
      </section>
    </main>
  );
}
