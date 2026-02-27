"use client";

import { useState } from "react";
import { ethers } from "ethers";
import { useWallet } from "@/hooks/useWallet";
import { usePoolState } from "@/hooks/useEvoPool";
import { EVOPOOL_ABI, ERC20_ABI, ADDRESSES } from "@/lib/contracts";

export default function LiquidityPage() {
  const { signer, connected, connect, address } = useWallet();
  const { state, refetch } = usePoolState(5000);
  const [tab, setTab] = useState<"add" | "remove">("add");
  const [amount0, setAmount0] = useState("");
  const [amount1, setAmount1] = useState("");
  const [lpAmount, setLpAmount] = useState("");
  const [txStatus, setTxStatus] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [lpBalance, setLpBalance] = useState<string | null>(null);

  // Fetch LP balance
  const fetchLPBalance = async () => {
    if (!connected || !address) return;
    try {
      const pool = new ethers.Contract(ADDRESSES.evoPool, EVOPOOL_ABI, new ethers.JsonRpcProvider("https://data-seed-prebsc-1-s1.binance.org:8545/"));
      const bal = await pool.balanceOf(address);
      setLpBalance(ethers.formatEther(bal));
    } catch { setLpBalance("0"); }
  };
  if (connected && lpBalance === null) fetchLPBalance();

  const handleAddLiquidity = async () => {
    if (!signer || !connected) { await connect(); return; }
    if (!amount0 || !amount1 || Number(amount0) <= 0 || Number(amount1) <= 0) return;

    setSubmitting(true);
    setTxStatus("Preparing...");
    setTxHash(null);

    try {
      const pool = new ethers.Contract(ADDRESSES.evoPool, EVOPOOL_ABI, signer);
      const tokenAContract = new ethers.Contract(ADDRESSES.tokenA, ERC20_ABI, signer);
      const tokenBContract = new ethers.Contract(ADDRESSES.tokenB, ERC20_ABI, signer);

      const amt0 = ethers.parseEther(amount0);
      const amt1 = ethers.parseEther(amount1);
      const poolAddr = ADDRESSES.evoPool;

      // Approve tokens
      setTxStatus("Approving Token A...");
      const allow0 = await tokenAContract.allowance(address, poolAddr);
      if (allow0 < amt0) {
        const tx = await tokenAContract.approve(poolAddr, amt0);
        await tx.wait();
      }

      setTxStatus("Approving Token B...");
      const allow1 = await tokenBContract.allowance(address, poolAddr);
      if (allow1 < amt1) {
        const tx = await tokenBContract.approve(poolAddr, amt1);
        await tx.wait();
      }

      setTxStatus("Adding liquidity...");
      const tx = await pool.addLiquidity(amt0, amt1);
      setTxHash(tx.hash);
      setTxStatus("Confirming...");
      await tx.wait();

      setTxStatus("✅ Liquidity added!");
      setAmount0("");
      setAmount1("");
      await refetch();
      await fetchLPBalance();
    } catch (err: any) {
      setTxStatus(`❌ ${err.reason || err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemoveLiquidity = async () => {
    if (!signer || !connected) { await connect(); return; }
    if (!lpAmount || Number(lpAmount) <= 0) return;

    setSubmitting(true);
    setTxStatus("Removing liquidity...");
    setTxHash(null);

    try {
      const pool = new ethers.Contract(ADDRESSES.evoPool, EVOPOOL_ABI, signer);
      const lpWei = ethers.parseEther(lpAmount);

      const tx = await pool.removeLiquidity(lpWei);
      setTxHash(tx.hash);
      setTxStatus("Confirming...");
      await tx.wait();

      setTxStatus("✅ Liquidity removed!");
      setLpAmount("");
      await refetch();
      await fetchLPBalance();
    } catch (err: any) {
      setTxStatus(`❌ ${err.reason || err.message}`);
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
            <label className="text-xs text-[var(--muted)] mb-1 block">EVOA Amount</label>
            <input type="number" value={amount0} onChange={(e) => setAmount0(e.target.value)} placeholder="0.0"
              className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-lg px-4 py-3 text-lg font-bold focus:outline-none focus:border-[var(--accent)] transition" />
          </div>
          <div>
            <label className="text-xs text-[var(--muted)] mb-1 block">EVOB Amount</label>
            <input type="number" value={amount1} onChange={(e) => setAmount1(e.target.value)} placeholder="0.0"
              className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-lg px-4 py-3 text-lg font-bold focus:outline-none focus:border-[var(--accent)] transition" />
          </div>
          <button onClick={handleAddLiquidity} disabled={submitting}
            className={`w-full py-3 rounded-lg font-semibold text-white transition cursor-pointer ${submitting ? "bg-gray-600 cursor-not-allowed" : connected ? "bg-[var(--green)] hover:bg-green-600" : "bg-[var(--accent)] hover:bg-indigo-500"}`}>
            {submitting ? "⏳ " + txStatus : connected ? "💧 Add Liquidity" : "🔗 Connect Wallet"}
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
          <button onClick={handleRemoveLiquidity} disabled={submitting}
            className={`w-full py-3 rounded-lg font-semibold text-white transition cursor-pointer ${submitting ? "bg-gray-600 cursor-not-allowed" : connected ? "bg-[var(--red)] hover:bg-red-600" : "bg-[var(--accent)] hover:bg-indigo-500"}`}>
            {submitting ? "⏳ " + txStatus : connected ? "🔥 Remove Liquidity" : "🔗 Connect Wallet"}
          </button>
        </div>
      )}

      {/* Status */}
      {txStatus && !submitting && (
        <div className="text-sm text-center">
          <p>{txStatus}</p>
          {txHash && (
            <a href={`https://testnet.bscscan.com/tx/${txHash}`} target="_blank" rel="noopener noreferrer"
              className="text-[var(--accent)] hover:underline text-xs">View on BscScan ↗</a>
          )}
        </div>
      )}
    </div>
  );
}
