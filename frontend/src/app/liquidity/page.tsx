"use client";

import { useState } from "react";
import { ethers } from "ethers";
import { useWallet } from "@/hooks/useWallet";
import { usePoolState } from "@/hooks/useEvoPool";
import { useTokenBalances } from "@/hooks/useTokenBalances";
import { useToast } from "@/components/Toast";
import { ConfirmModal } from "@/components/ConfirmModal";
import { EVOPOOL_ABI, ERC20_ABI, ADDRESSES, BSC_TESTNET_RPC } from "@/lib/contracts";

export default function LiquidityPage() {
  const { signer, connected, address } = useWallet();
  const { state, refetch } = usePoolState(5000);
  const { addToast, updateToast } = useToast();
  const { balanceA, balanceB, refetchBalances } = useTokenBalances(address);
  const [tab, setTab] = useState<"add" | "remove">("add");
  const [amount0, setAmount0] = useState("");
  const [amount1, setAmount1] = useState("");
  const [lpAmount, setLpAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [lpBalance, setLpBalance] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState<"add" | "remove" | null>(null);

  // Fetch LP balance
  const fetchLPBalance = async () => {
    if (!connected || !address) return;
    try {
      const pool = new ethers.Contract(ADDRESSES.evoPool, EVOPOOL_ABI, new ethers.JsonRpcProvider(BSC_TESTNET_RPC));
      const bal = await pool.balanceOf(address);
      setLpBalance(ethers.formatEther(bal));
    } catch { setLpBalance("0"); }
  };
  if (connected && lpBalance === null) fetchLPBalance();

  const handleAddLiquidity = async () => {
    if (!signer || !connected) return;
    if (!amount0 || !amount1 || Number(amount0) <= 0 || Number(amount1) <= 0) return;

    setSubmitting(true);
    const toastId = addToast({ type: "loading", title: "Preparing…" });

    try {
      const pool = new ethers.Contract(ADDRESSES.evoPool, EVOPOOL_ABI, signer);
      const tokenAContract = new ethers.Contract(ADDRESSES.tokenA, ERC20_ABI, signer);
      const tokenBContract = new ethers.Contract(ADDRESSES.tokenB, ERC20_ABI, signer);

      const amt0 = ethers.parseEther(amount0);
      const amt1 = ethers.parseEther(amount1);
      const poolAddr = ADDRESSES.evoPool;

      // Approve tokens
      updateToast(toastId, { title: "Approving Token A…" });
      const allow0 = await tokenAContract.allowance(address, poolAddr);
      if (allow0 < amt0) {
        const tx = await tokenAContract.approve(poolAddr, amt0);
        await tx.wait();
      }

      updateToast(toastId, { title: "Approving Token B…" });
      const allow1 = await tokenBContract.allowance(address, poolAddr);
      if (allow1 < amt1) {
        const tx = await tokenBContract.approve(poolAddr, amt1);
        await tx.wait();
      }

      updateToast(toastId, { title: "Adding liquidity…" });
      const tx = await pool.addLiquidity(amt0, amt1);
      updateToast(toastId, { title: "Confirming…", txHash: tx.hash });
      await tx.wait();

      updateToast(toastId, {
        type: "success",
        title: "Liquidity added!",
        message: `${amount0} EVOA + ${amount1} EVOB`,
        txHash: tx.hash,
      });
      setAmount0("");
      setAmount1("");
      await refetch();
      await fetchLPBalance();
      refetchBalances();
    } catch (err: any) {
      updateToast(toastId, { type: "error", title: "Add liquidity failed", message: err.reason || err.message });
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemoveLiquidity = async () => {
    if (!signer || !connected) return;
    if (!lpAmount || Number(lpAmount) <= 0) return;

    setSubmitting(true);
    const toastId = addToast({ type: "loading", title: "Removing liquidity…" });

    try {
      const pool = new ethers.Contract(ADDRESSES.evoPool, EVOPOOL_ABI, signer);
      const lpWei = ethers.parseEther(lpAmount);

      const tx = await pool.removeLiquidity(lpWei);
      updateToast(toastId, { title: "Confirming…", txHash: tx.hash });
      await tx.wait();

      updateToast(toastId, {
        type: "success",
        title: "Liquidity removed!",
        message: `Burned ${lpAmount} EVO-LP`,
        txHash: tx.hash,
      });
      setLpAmount("");
      await refetch();
      await fetchLPBalance();
      refetchBalances();
    } catch (err: any) {
      updateToast(toastId, { type: "error", title: "Remove liquidity failed", message: err.reason || err.message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <h1 className="text-3xl font-bold">💧 Liquidity</h1>
      <p className="text-[var(--muted)]">Add or remove liquidity from EvoPool</p>

      {/* Pool info */}
      {state && (
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 text-sm space-y-1">
          <div className="flex justify-between">
            <span className="text-[var(--muted)]">Reserve EVOA</span>
            <span className="font-bold">{Number(state.reserve0).toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--muted)]">Reserve EVOB</span>
            <span className="font-bold">{Number(state.reserve1).toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--muted)]">Total LP Supply</span>
            <span className="font-bold">{Number(state.totalSupply).toLocaleString(undefined, { maximumFractionDigits: 4 })}</span>
          </div>
          {lpBalance && (
            <div className="flex justify-between">
              <span className="text-[var(--muted)]">Your LP Balance</span>
              <span className="font-bold text-[var(--accent)]">{Number(lpBalance).toFixed(6)} EVO-LP</span>
            </div>
          )}
          {lpBalance && Number(lpBalance) > 0 && Number(state.totalSupply) > 0 && (
            <>
              <div className="border-t border-[var(--border)] my-2" />
              <p className="text-xs text-[var(--muted)] font-semibold">Your Position Value</p>
              <div className="flex justify-between">
                <span className="text-[var(--muted)]">EVOA share</span>
                <span className="font-mono text-[var(--foreground)]">
                  {(Number(lpBalance) / Number(state.totalSupply) * Number(state.reserve0)).toFixed(4)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--muted)]">EVOB share</span>
                <span className="font-mono text-[var(--foreground)]">
                  {(Number(lpBalance) / Number(state.totalSupply) * Number(state.reserve1)).toFixed(4)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--muted)]">Pool share</span>
                <span className="font-mono text-[var(--accent)]">
                  {(Number(lpBalance) / Number(state.totalSupply) * 100).toFixed(2)}%
                </span>
              </div>
            </>
          )}
        </div>
      )}

      {/* Tab toggle */}
      <div className="flex rounded-lg overflow-hidden border border-[var(--border)]">
        <button
          onClick={() => setTab("add")}
          className={`flex-1 py-2 text-sm font-semibold transition cursor-pointer ${tab === "add" ? "bg-[var(--accent)] text-white" : "bg-[var(--card)] text-[var(--muted)]"}`}
        >
          ➕ Add Liquidity
        </button>
        <button
          onClick={() => setTab("remove")}
          className={`flex-1 py-2 text-sm font-semibold transition cursor-pointer ${tab === "remove" ? "bg-[var(--red)] text-white" : "bg-[var(--card)] text-[var(--muted)]"}`}
        >
          ➖ Remove Liquidity
        </button>
      </div>

      {/* Add Liquidity Form */}
      {tab === "add" && (
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-6 space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs text-[var(--muted)]">EVOA Amount</label>
              {connected && balanceA && (
                <span className="text-xs text-[var(--muted)]">
                  Balance: <span className="font-mono text-[var(--text)]">{Number(balanceA).toFixed(4)}</span>
                  <button onClick={() => setAmount0(balanceA)} className="ml-1 text-[var(--accent)] font-bold hover:underline cursor-pointer">MAX</button>
                </span>
              )}
            </div>
            <input type="number" value={amount0} onChange={(e) => setAmount0(e.target.value)} placeholder="0.0"
              className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-lg px-4 py-3 text-lg font-bold focus:outline-none focus:border-[var(--accent)] transition" />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs text-[var(--muted)]">EVOB Amount</label>
              {connected && balanceB && (
                <span className="text-xs text-[var(--muted)]">
                  Balance: <span className="font-mono text-[var(--text)]">{Number(balanceB).toFixed(4)}</span>
                  <button onClick={() => setAmount1(balanceB)} className="ml-1 text-[var(--accent)] font-bold hover:underline cursor-pointer">MAX</button>
                </span>
              )}
            </div>
            <input type="number" value={amount1} onChange={(e) => setAmount1(e.target.value)} placeholder="0.0"
              className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-lg px-4 py-3 text-lg font-bold focus:outline-none focus:border-[var(--accent)] transition" />
          </div>
          <button onClick={() => setShowConfirm("add")} disabled={submitting || !connected || (!amount0 || Number(amount0) <= 0) || (!amount1 || Number(amount1) <= 0)}
            className={`w-full py-3 rounded-lg font-semibold text-white transition cursor-pointer ${submitting ? "bg-gray-600 cursor-not-allowed" : !connected ? "bg-gray-600 cursor-not-allowed text-gray-400" : "bg-[var(--green)] hover:bg-green-600"}`}>
            {submitting ? "⏳ Adding…" : !connected ? "🔗 Connect wallet in navbar" : "💧 Add Liquidity"}
          </button>
        </div>
      )}

      {/* Remove Liquidity Form */}
      {tab === "remove" && (
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-6 space-y-4">
          <div>
            <label className="text-xs text-[var(--muted)] mb-1 block">LP Tokens to Burn</label>
            <input type="number" value={lpAmount} onChange={(e) => setLpAmount(e.target.value)} placeholder="0.0"
              className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-lg px-4 py-3 text-lg font-bold focus:outline-none focus:border-[var(--accent)] transition" />
            {lpBalance && (
              <button onClick={() => setLpAmount(lpBalance)} className="text-xs text-[var(--accent)] mt-1 hover:underline cursor-pointer">
                Max: {Number(lpBalance).toFixed(6)}
              </button>
            )}
          </div>
          <button onClick={() => setShowConfirm("remove")} disabled={submitting || !connected || (!lpAmount || Number(lpAmount) <= 0)}
            className={`w-full py-3 rounded-lg font-semibold text-white transition cursor-pointer ${submitting ? "bg-gray-600 cursor-not-allowed" : !connected ? "bg-gray-600 cursor-not-allowed text-gray-400" : "bg-[var(--red)] hover:bg-red-600"}`}>
            {submitting ? "⏳ Removing…" : !connected ? "🔗 Connect wallet in navbar" : "🔥 Remove Liquidity"}
          </button>
        </div>
      )}

      {/* Confirmation Modals */}
      <ConfirmModal
        open={showConfirm === "add"}
        title="Confirm Add Liquidity"
        confirmLabel="Add Liquidity"
        onCancel={() => setShowConfirm(null)}
        onConfirm={() => { setShowConfirm(null); handleAddLiquidity(); }}
        loading={submitting}
      >
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-[var(--muted)]">EVOA deposit</span>
            <span className="font-mono text-[var(--foreground)]">{amount0}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--muted)]">EVOB deposit</span>
            <span className="font-mono text-[var(--foreground)]">{amount1}</span>
          </div>
          <p className="text-xs text-[var(--muted)] pt-2 border-t border-[var(--border)]">
            You will receive LP tokens proportional to your share of the pool.
          </p>
        </div>
      </ConfirmModal>

      <ConfirmModal
        open={showConfirm === "remove"}
        title="Confirm Remove Liquidity"
        confirmLabel="Remove Liquidity"
        onCancel={() => setShowConfirm(null)}
        onConfirm={() => { setShowConfirm(null); handleRemoveLiquidity(); }}
        loading={submitting}
      >
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-[var(--muted)]">LP tokens to burn</span>
            <span className="font-mono text-[var(--foreground)]">{lpAmount}</span>
          </div>
          <p className="text-xs text-[var(--muted)] pt-2 border-t border-[var(--border)]">
            You will receive EVOA and EVOB proportional to your LP share.
          </p>
        </div>
      </ConfirmModal>
    </div>
  );
}
