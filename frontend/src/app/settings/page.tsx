"use client";

import { useState, useEffect, useRef } from "react";
import { useWallet } from "@/hooks/useWallet";
import { useGreenfield } from "@/hooks/useGreenfield";
import { useToast } from "@/components/Toast";
import { ethers } from "ethers";
import { CONTROLLER_ABI, EVOPOOL_ABI, ADDRESSES, CURVE_MODES, BSC_TESTNET_RPC } from "@/lib/contracts";
import type { AgentStrategyLog } from "@/lib/greenfield";

/**
 * #30 — Configurable Strategy via UI
 *
 * Allows registered agents to submit parameter updates (fee, curveBeta, curveMode)
 * directly from the UI. Shows current pool state and agent status.
 */
const readProvider = new ethers.JsonRpcProvider(BSC_TESTNET_RPC);

export default function SettingsPage() {
  const { signer, connected, address } = useWallet();
  const { uploadLog, uploading: greenfieldUploading } = useGreenfield();
  const { addToast, updateToast } = useToast();

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

  // Cooldown countdown
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (cooldownRef.current) clearInterval(cooldownRef.current);
    if (!isAgent || canUpdate || lastUpdate === 0 || cooldown === 0) {
      setCooldownRemaining(0);
      return;
    }
    const tick = () => {
      const now = Math.floor(Date.now() / 1000);
      const elapsed = now - lastUpdate;
      const remaining = Math.max(0, cooldown - elapsed);
      setCooldownRemaining(remaining);
      if (remaining <= 0) {
        setCanUpdate(true);
        if (cooldownRef.current) clearInterval(cooldownRef.current);
      }
    };
    tick();
    cooldownRef.current = setInterval(tick, 1000);
    return () => { if (cooldownRef.current) clearInterval(cooldownRef.current); };
  }, [isAgent, canUpdate, lastUpdate, cooldown]);

  useEffect(() => {
    loadPoolState();
  }, []);

  useEffect(() => {
    if (!signer || !address) return;
    loadAgentState();
  }, [signer, address]);

  async function loadPoolState() {
    try {
      const pool = new ethers.Contract(ADDRESSES.evoPool, EVOPOOL_ABI, readProvider);
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
    } catch (err: any) {
      console.error("Load pool state error:", err);
    }
  }

  async function loadAgentState() {
    try {
      const controller = new ethers.Contract(ADDRESSES.agentController, CONTROLLER_ABI, signer!);
      const info = await controller.getAgentInfo(address);
      setIsAgent(info.active);
      setBondAmount(ethers.formatEther(info.bondAmount));
      setLastUpdate(Number(info.lastUpdateTime));

      const cd = await controller.cooldownSeconds();
      setCooldown(Number(cd));

      const now = Math.floor(Date.now() / 1000);
      setCanUpdate(info.active && now - Number(info.lastUpdateTime) >= Number(cd));
    } catch (err: any) {
      console.error("Load agent state error:", err);
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
      await loadPoolState();
      await loadAgentState();
    } catch (err: any) {
      setError(err.reason || err.message);
    } finally {
      setRegistering(false);
    }
  }

  async function handleSubmit() {
    if (!signer || !address) return;
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
      await loadPoolState();
      await loadAgentState();

      // Upload strategy log to BNB Greenfield
      const log: AgentStrategyLog = {
        agentAddress: address,
        timestamp: Date.now(),
        action: "parameter_update",
        data: {
          feeBps: parseInt(newFee),
          curveBeta: parseInt(newBeta),
          curveMode: parseInt(newMode),
          curveModeName: CURVE_MODES[parseInt(newMode)] ?? "Unknown",
          reason: "Manual submission via Settings UI",
          txHash: tx.hash,
          poolState: {
            reserve0: currentFee,
            reserve1: currentBeta,
            price: "N/A",
            totalSupply: "N/A",
          },
        },
        metadata: {
          chainId: 97,
          version: "1.0.0",
        },
      };
      const toastId = addToast({ type: "loading", title: "📦 Uploading audit log to Greenfield…" });
      try {
        const url = await uploadLog(address, log);
        if (url) {
          updateToast(toastId, {
            type: "success",
            title: "Audit log stored on Greenfield!",
            message: "Decentralized audit trail updated.",
          });
        } else {
          updateToast(toastId, {
            type: "info",
            title: "Greenfield upload skipped",
            message: "Audit log upload could not complete. TX still succeeded on-chain.",
          });
        }
      } catch {
        updateToast(toastId, {
          type: "info",
          title: "Greenfield upload failed",
          message: "This doesn't affect your on-chain transaction.",
        });
      }
    } catch (err: any) {
      setError(err.reason || err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="max-w-2xl mx-auto px-4 py-8 space-y-8">
      <h1 className="text-2xl font-bold text-[var(--accent)]">⚙️ Agent Settings</h1>

      {/* Wallet hint when disconnected */}
      {!connected && (
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 text-sm text-[var(--muted)] text-center">
          🔗 Connect your wallet using the button in the navbar to register or submit updates.
        </div>
      )}

      {/* ── Current Pool State ───────────────────────────────────── */}
      <section className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-6 space-y-2">
        <h2 className="text-lg font-semibold text-[var(--foreground)] mb-3">Current Pool State</h2>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-xs text-[var(--muted)]">Fee (bps)</p>
            <p className="text-xl font-mono text-white">{currentFee}</p>
          </div>
          <div>
            <p className="text-xs text-[var(--muted)]">Curve Beta</p>
            <p className="text-xl font-mono text-white">{currentBeta}</p>
          </div>
          <div>
            <p className="text-xs text-[var(--muted)]">Curve Mode</p>
            <p className="text-xl font-mono text-white">{CURVE_MODES[currentMode] || "Unknown"}</p>
          </div>
        </div>
      </section>

      {/* ── Agent Status ─────────────────────────────────────────── */}
      {!isAgent ? (
        <section className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-6 space-y-4">
          <h2 className="text-lg font-semibold text-[var(--foreground)]">Register as Agent</h2>
          <p className="text-sm text-[var(--muted)]">
            You are not a registered agent. Register with a bond to start submitting parameter updates.
          </p>
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <label className="text-xs text-[var(--muted)]">Bond Amount (BNB)</label>
              <input
                type="number"
                step="0.001"
                value={bondInput}
                onChange={(e) => setBondInput(e.target.value)}
                className="mt-1 w-full bg-[#1E2329] text-white rounded-lg px-3 py-2 text-sm border border-[var(--border)] focus:border-[var(--accent)] focus:outline-none"
              />
            </div>
            <button
              onClick={handleRegister}
              disabled={registering || !connected}
              className={`px-6 py-2 rounded-lg font-semibold transition ${
                !connected
                  ? "bg-gray-600 text-gray-400 cursor-not-allowed"
                  : "bg-[var(--accent)] hover:brightness-110 text-[#0B0E11] cursor-pointer"
              } disabled:opacity-50`}
            >
              {registering ? "Registering..." : "Register"}
            </button>
          </div>
        </section>
      ) : (
        <section className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-6 space-y-2">
          <h2 className="text-lg font-semibold text-[var(--foreground)] mb-3">Agent Status</h2>
          <div className="grid grid-cols-2 gap-4 text-center">
            <div>
              <p className="text-xs text-[var(--muted)]">Bond</p>
              <p className="text-lg font-mono text-[var(--green)]">{bondAmount} BNB</p>
            </div>
            <div>
              <p className="text-xs text-[var(--muted)]">Cooldown Ready</p>
              <p className={`text-lg font-mono ${canUpdate ? "text-[var(--green)]" : "text-[var(--red)]"}`}>
                {canUpdate
                  ? "✓ Ready"
                  : `✗ ${Math.floor(cooldownRemaining / 60)}m ${(cooldownRemaining % 60).toString().padStart(2, "0")}s`}
              </p>
            </div>
          </div>
        </section>
      )}

      {/* ── Submit Parameter Update ──────────────────────────────── */}
      {isAgent && (
        <section className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-6 space-y-4">
          <h2 className="text-lg font-semibold text-[var(--foreground)]">Submit Parameter Update</h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-xs text-[var(--muted)]">Fee (bps)</label>
              <input
                type="number"
                min="0"
                max="500"
                value={newFee}
                onChange={(e) => setNewFee(e.target.value)}
                className="mt-1 w-full bg-[#1E2329] text-white rounded-lg px-3 py-2 text-sm border border-[var(--border)] focus:border-[var(--accent)] focus:outline-none"
              />
              <p className="text-xs text-[var(--muted)] mt-1">Current: {currentFee}</p>
            </div>
            <div>
              <label className="text-xs text-[var(--muted)]">Curve Beta</label>
              <input
                type="number"
                min="0"
                max="10000"
                value={newBeta}
                onChange={(e) => setNewBeta(e.target.value)}
                className="mt-1 w-full bg-[#1E2329] text-white rounded-lg px-3 py-2 text-sm border border-[var(--border)] focus:border-[var(--accent)] focus:outline-none"
              />
              <p className="text-xs text-[var(--muted)] mt-1">Current: {currentBeta}</p>
            </div>
            <div>
              <label className="text-xs text-[var(--muted)]">Curve Mode</label>
              <select
                value={newMode}
                onChange={(e) => setNewMode(e.target.value)}
                className="mt-1 w-full bg-[#1E2329] text-white rounded-lg px-3 py-2 text-sm border border-[var(--border)] focus:border-[var(--accent)] focus:outline-none"
              >
                {CURVE_MODES.map((mode, i) => (
                  <option key={i} value={i}>
                    {mode}
                  </option>
                ))}
              </select>
              <p className="text-xs text-[var(--muted)] mt-1">Current: {CURVE_MODES[currentMode]}</p>
            </div>
          </div>

          <button
            onClick={handleSubmit}
            disabled={submitting || !canUpdate}
            className="w-full bg-[var(--accent)] hover:brightness-110 disabled:opacity-50 text-[#0B0E11] font-bold py-3 rounded-lg text-sm transition"
          >
            {submitting
              ? "Submitting..."
              : canUpdate
              ? "Submit Update"
              : `Cooldown ${Math.floor(cooldownRemaining / 60)}m ${(cooldownRemaining % 60).toString().padStart(2, "0")}s`}
          </button>

          {txHash && (
            <p className="text-xs text-[var(--green)] break-all">
              ✓ TX: <a href={`https://testnet.bscscan.com/tx/${txHash}`} target="_blank" rel="noopener noreferrer" className="underline hover:text-[var(--accent)]">{txHash}</a>
            </p>
          )}
          {error && <p className="text-xs text-[var(--red)]">Error: {error}</p>}
        </section>
      )}

      {/* ── Strategy Tips ────────────────────────────────────────── */}
      <section className="bg-[var(--card)]/50 border border-[var(--border)] rounded-xl p-6">
        <h2 className="text-lg font-semibold text-[var(--foreground)] mb-3">💡 Strategy Guide</h2>
        <ul className="text-sm text-[var(--muted)] space-y-2 list-disc list-inside">
          <li><strong className="text-[var(--accent)]">Normal</strong>: Standard constant-product. Good for stable markets.</li>
          <li><strong className="text-[var(--accent)]">Defensive</strong>: Higher slippage for large trades. Use during whale activity.</li>
          <li><strong className="text-[var(--accent)]">VolatilityAdaptive</strong>: Linear penalty scaling. Best for volatile markets.</li>
          <li>Lower <strong className="text-white">feeBps</strong> attracts more volume; higher fees protect against IL.</li>
          <li>Higher <strong className="text-white">curveBeta</strong> concentrates liquidity around the current price.</li>
        </ul>
      </section>
    </main>
  );
}
