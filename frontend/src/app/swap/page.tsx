"use client";

import { useState, useRef, useEffect } from "react";
import { ethers } from "ethers";
import { useWallet } from "@/hooks/useWallet";
import { usePoolState } from "@/hooks/useEvoPool";
import { useTokenBalances } from "@/hooks/useTokenBalances";
import { useToast } from "@/components/Toast";
import { ConfirmModal } from "@/components/ConfirmModal";
import { EVOPOOL_ABI, ERC20_ABI, ADDRESSES, CURVE_MODES } from "@/lib/contracts";
import { ResponsiveContainer, AreaChart, Area, Tooltip, YAxis } from "recharts";

export default function SwapPage() {
  const { signer, connected, address } = useWallet();
  const { state, refetch } = usePoolState(5000);
  const { addToast, updateToast } = useToast();
  const { balanceA, balanceB, refetchBalances } = useTokenBalances(address);
  const arrowRef = useRef<HTMLSpanElement>(null);
  const [direction, setDirection] = useState<"0to1" | "1to0">("0to1");
  const [amountIn, setAmountIn] = useState("");
  const [slippage, setSlippage] = useState("1.0");
  const [submitting, setSubmitting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [priceHistory, setPriceHistory] = useState<{ time: string; price: number }[]>([]);

  // Track price history from polling
  useEffect(() => {
    if (!state) return;
    const price = Number(state.price);
    if (isNaN(price) || price <= 0) return;
    setPriceHistory((prev) => {
      const now = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
      const last = prev[prev.length - 1];
      if (last && last.price === price) return prev; // skip duplicates
      const updated = [...prev, { time: now, price }];
      return updated.slice(-30); // keep last 30 data points
    });
  }, [state]);

  const estimateOutput = () => {
    if (!state || !amountIn || isNaN(Number(amountIn)) || Number(amountIn) <= 0) return "0";
    const inWei = Number(amountIn);
    const r0 = Number(state.reserve0);
    const r1 = Number(state.reserve1);
    const reserveIn = direction === "0to1" ? r0 : r1;
    const reserveOut = direction === "0to1" ? r1 : r0;
    if (reserveIn <= 0 || reserveOut <= 0) return "0";
    const fee = state.feeBps / 10000;
    const effectiveIn = inWei * (1 - fee);
    const denominator = reserveIn + effectiveIn;
    if (denominator <= 0) return "0";
    const out = (reserveOut * effectiveIn) / denominator;
    return out.toFixed(6);
  };

  const priceImpact = () => {
    if (!state || !amountIn || isNaN(Number(amountIn)) || Number(amountIn) <= 0) return "0.00";
    const r0 = Number(state.reserve0);
    const r1 = Number(state.reserve1);
    const reserveIn = direction === "0to1" ? r0 : r1;
    const reserveOut = direction === "0to1" ? r1 : r0;
    if (reserveIn <= 0 || reserveOut <= 0) return "0.00";
    const spotPrice = reserveOut / reserveIn;
    const estOut = Number(estimateOutput());
    if (estOut <= 0) return "0.00";
    const execPrice = estOut / Number(amountIn);
    if (!isFinite(execPrice) || spotPrice <= 0) return "0.00";
    const impact = Math.abs(1 - execPrice / spotPrice) * 100;
    return isFinite(impact) ? impact.toFixed(2) : "0.00";
  };

  const minReceived = () => {
    const est = Number(estimateOutput());
    const slipFactor = 1 - Number(slippage) / 100;
    return (est * slipFactor).toFixed(6);
  };

  const handleSwap = async () => {
    if (!signer || !connected) return;
    if (!amountIn || Number(amountIn) <= 0) return;

    setSubmitting(true);
    const toastId = addToast({ type: "loading", title: "Preparing swap…" });

    try {
      const pool = new ethers.Contract(ADDRESSES.evoPool, EVOPOOL_ABI, signer);
      const tokenAddr = direction === "0to1" ? ADDRESSES.tokenA : ADDRESSES.tokenB;
      const token = new ethers.Contract(tokenAddr, ERC20_ABI, signer);

      const amountInWei = ethers.parseEther(amountIn);
      const estimatedOut = estimateOutput();
      const slippageFactor = 1 - Number(slippage) / 100;
      const minOut = ethers.parseEther((Number(estimatedOut) * slippageFactor).toFixed(18));

      // Approve token
      updateToast(toastId, { title: "Approving token…" });
      const allowance = await token.allowance(await signer.getAddress(), ADDRESSES.evoPool);
      if (allowance < amountInWei) {
        const approveTx = await token.approve(ADDRESSES.evoPool, amountInWei);
        await approveTx.wait();
      }

      // Execute swap
      updateToast(toastId, { title: "Executing swap…" });
      const zeroForOne = direction === "0to1";
      const tx = await pool.swap(zeroForOne, amountInWei, minOut);
      updateToast(toastId, { title: "Confirming swap…", txHash: tx.hash });
      await tx.wait();

      updateToast(toastId, {
        type: "success",
        title: "Swap successful!",
        message: `${amountIn} ${direction === "0to1" ? "EVOA" : "EVOB"} → ${estimatedOut} ${direction === "0to1" ? "EVOB" : "EVOA"}`,
        txHash: tx.hash,
      });
      await refetch();
      refetchBalances();
      setAmountIn("");
    } catch (err: any) {
      console.error("Swap error:", err);
      updateToast(toastId, {
        type: "error",
        title: "Swap failed",
        message: err.reason || err.message,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <h1 className="text-3xl font-bold">💱 <span className="text-[var(--accent)]">Swap</span></h1>
      <p className="text-[var(--muted)]">Trade tokens on EvoPool with adaptive fees</p>

      {/* Pool info banner */}
      {state && (
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 text-sm">
          <div className="flex justify-between">
            <span className="text-[var(--muted)]">Current Fee</span>
            <span className="font-bold">{state.feeBps} bps ({(state.feeBps / 100).toFixed(2)}%)</span>
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-[var(--muted)]">Curve Mode</span>
            <span className={`font-bold ${state.curveMode === 0 ? "text-[var(--green)]" : state.curveMode === 1 ? "text-[var(--red)]" : "text-[var(--yellow)]"}`}>
              {state.curveModeName}
            </span>
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-[var(--muted)]">Price</span>
            <span className="font-bold">{state.price} EVOA/EVOB</span>
          </div>

          {/* Mini Price Chart */}
          {priceHistory.length >= 2 && (
            <div className="mt-3 pt-3 border-t border-[var(--border)]">
              <p className="text-xs text-[var(--muted)] mb-1">Price (live)</p>
              <div className="h-20">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={priceHistory}>
                    <defs>
                      <linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <YAxis domain={["dataMin", "dataMax"]} hide />
                    <Tooltip
                      contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                      labelStyle={{ color: "var(--muted)" }}
                    />
                    <Area type="monotone" dataKey="price" stroke="var(--accent)" fill="url(#priceGrad)" strokeWidth={2} dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Swap card */}
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-6 space-y-4">
        {/* Direction toggle */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-[var(--muted)]">Direction</span>
          <button
            onClick={() => {
              if (arrowRef.current) {
                arrowRef.current.style.transition = "transform 0.3s ease";
                arrowRef.current.style.transform =
                  direction === "0to1" ? "rotate(180deg)" : "rotate(0deg)";
              }
              setDirection(direction === "0to1" ? "1to0" : "0to1");
            }}
            className="px-3 py-1 rounded-lg bg-[var(--bg)] border border-[var(--border)] text-sm hover:border-[var(--accent)] hover:text-[var(--accent)] transition cursor-pointer flex items-center gap-1"
          >
            {direction === "0to1" ? "EVOA → EVOB" : "EVOB → EVOA"}
            <span ref={arrowRef} className="inline-block">⇄</span>
          </button>
        </div>

        {/* Input */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs text-[var(--muted)]">
              You pay ({direction === "0to1" ? "EVOA" : "EVOB"})
            </label>
            {connected && (
              <span className="text-xs text-[var(--muted)]">
                Balance:{" "}
                <span className="text-[var(--text)] font-mono">
                  {Number(direction === "0to1" ? balanceA ?? "0" : balanceB ?? "0").toFixed(4)}
                </span>
                <button
                  onClick={() => setAmountIn(direction === "0to1" ? balanceA ?? "0" : balanceB ?? "0")}
                  className="ml-1 text-[var(--accent)] font-bold hover:underline cursor-pointer"
                >
                  MAX
                </button>
              </span>
            )}
          </div>
          <input
            type="number"
            value={amountIn}
            onChange={(e) => setAmountIn(e.target.value)}
            placeholder="0.0"
            className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-lg px-4 py-3 text-lg font-bold focus:outline-none focus:border-[var(--accent)] transition"
          />
        </div>

        {/* Output estimate */}
        <div>
          <label className="text-xs text-[var(--muted)] mb-1 block">
            You receive ({direction === "0to1" ? "EVOB" : "EVOA"}) — estimated
          </label>
          <div className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-lg px-4 py-3 text-lg font-bold text-[var(--green)]">
            {estimateOutput()}
          </div>
        </div>

        {/* Trade Details */}
        {amountIn && Number(amountIn) > 0 && state && (
          <div className="bg-[var(--bg)] border border-[var(--border)] rounded-lg p-3 text-xs space-y-1">
            <div className="flex justify-between">
              <span className="text-[var(--muted)]">Price Impact</span>
              <span className={Number(priceImpact()) > 3 ? "text-[var(--red)] font-bold" : Number(priceImpact()) > 1 ? "text-[var(--yellow)]" : "text-[var(--green)]"}>
                {priceImpact()}%
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--muted)]">Min. Received (after {slippage}% slippage)</span>
              <span className="text-[var(--text)]">{minReceived()} {direction === "0to1" ? "EVOB" : "EVOA"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--muted)]">Fee</span>
              <span className="text-[var(--text)]">{state.feeBps} bps ({(state.feeBps / 100).toFixed(2)}%)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--muted)]">Route</span>
              <span className="text-[var(--text)]">{direction === "0to1" ? "EVOA → EvoPool → EVOB" : "EVOB → EvoPool → EVOA"}</span>
            </div>
          </div>
        )}

        {/* Slippage */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-[var(--muted)]">Slippage tolerance:</span>
          {["0.5", "1.0", "2.0"].map((s) => (
            <button
              key={s}
              onClick={() => setSlippage(s)}
              className={`px-2 py-1 rounded text-xs cursor-pointer ${slippage === s ? "bg-[var(--accent)] text-[#0B0E11] font-bold" : "bg-[var(--bg)] text-[var(--muted)] border border-[var(--border)]"}`}
            >
              {s}%
            </button>
          ))}
        </div>

        {/* Swap button */}
        <button
          onClick={() => setShowConfirm(true)}
          disabled={submitting || !connected || (!amountIn || Number(amountIn) <= 0)}
          className={`w-full py-3 rounded-lg font-semibold transition cursor-pointer ${
            submitting
              ? "bg-gray-600 cursor-not-allowed text-white"
              : !connected
                ? "bg-gray-600 cursor-not-allowed text-gray-400"
                : "bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[#0B0E11] font-bold"
          }`}
        >
          {submitting ? "⏳ Swapping…" : !connected ? "🔗 Connect wallet in navbar to swap" : "🔄 Swap"}
        </button>
      </div>

      {/* Confirmation Modal */}
      <ConfirmModal
        open={showConfirm}
        title="Confirm Swap"
        confirmLabel="Swap Now"
        onCancel={() => setShowConfirm(false)}
        onConfirm={() => { setShowConfirm(false); handleSwap(); }}
        loading={submitting}
      >
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-[var(--muted)]">You pay</span>
            <span className="font-mono text-[var(--foreground)]">{amountIn} {direction === "0to1" ? "EVOA" : "EVOB"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--muted)]">You receive (est.)</span>
            <span className="font-mono text-[var(--green)]">~{estimateOutput()} {direction === "0to1" ? "EVOB" : "EVOA"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--muted)]">Min received</span>
            <span className="font-mono">{minReceived()} {direction === "0to1" ? "EVOB" : "EVOA"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--muted)]">Price impact</span>
            <span className={`font-mono ${Number(priceImpact()) > 5 ? "text-[var(--red)]" : "text-[var(--foreground)]"}`}>{priceImpact()}%</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--muted)]">Slippage tolerance</span>
            <span className="font-mono">{slippage}%</span>
          </div>
        </div>
      </ConfirmModal>

      {/* Price impact warning */}
      {state && amountIn && Number(amountIn) > 0 && (
        <div className="text-xs text-[var(--muted)] text-center">
          {state.curveMode === 1 && (
            <span className="text-[var(--yellow)]">
              ⚠️ Defensive mode active — large trades incur quadratic whale penalty
            </span>
          )}
          {state.curveMode === 2 && (
            <span className="text-[var(--yellow)]">
              ⚠️ VolatilityAdaptive mode — spreads widened proportionally to trade size
            </span>
          )}
        </div>
      )}
    </div>
  );
}
