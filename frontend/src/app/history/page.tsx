"use client";

import { useState, useEffect } from "react";
import { ethers } from "ethers";
import { EVOPOOL_ABI, CONTROLLER_ABI, ADDRESSES, BSC_TESTNET_RPC } from "@/lib/contracts";

interface TxEvent {
  type: "Swap" | "LiquidityAdded" | "LiquidityRemoved" | "ParameterUpdate" | "AgentRegistered" | "AgentSlashed";
  blockNumber: number;
  txHash: string;
  details: string;
  timestamp?: number;
}

const provider = new ethers.JsonRpcProvider(BSC_TESTNET_RPC);

export default function HistoryPage() {
  const [events, setEvents] = useState<TxEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [blockRange, setBlockRange] = useState(5000);

  useEffect(() => {
    (async () => {
      if (!ADDRESSES.evoPool || !ADDRESSES.agentController) {
        setLoading(false);
        return;
      }
      try {
        const pool = new ethers.Contract(ADDRESSES.evoPool, EVOPOOL_ABI, provider);
        const ctrl = new ethers.Contract(ADDRESSES.agentController, CONTROLLER_ABI, provider);
        const current = await provider.getBlockNumber();
        const from = Math.max(0, current - blockRange);

        const allEvents: TxEvent[] = [];

        // Swap events
        const swaps = await pool.queryFilter(pool.filters.Swap(), from, current);
        for (const e of swaps as any[]) {
          const dir = e.args[1] ? "EVOA→EVOB" : "EVOB→EVOA";
          const amtIn = ethers.formatEther(e.args[2]);
          const amtOut = ethers.formatEther(e.args[3]);
          allEvents.push({
            type: "Swap",
            blockNumber: e.blockNumber,
            txHash: e.transactionHash,
            details: `${dir} | In: ${Number(amtIn).toFixed(4)} | Out: ${Number(amtOut).toFixed(4)}`,
          });
        }

        // Liquidity events
        const adds = await pool.queryFilter(pool.filters.LiquidityAdded(), from, current);
        for (const e of adds as any[]) {
          allEvents.push({
            type: "LiquidityAdded",
            blockNumber: e.blockNumber,
            txHash: e.transactionHash,
            details: `+${Number(ethers.formatEther(e.args[1])).toFixed(2)} EVOA / +${Number(ethers.formatEther(e.args[2])).toFixed(2)} EVOB → ${Number(ethers.formatEther(e.args[3])).toFixed(4)} LP`,
          });
        }

        const removes = await pool.queryFilter(pool.filters.LiquidityRemoved(), from, current);
        for (const e of removes as any[]) {
          allEvents.push({
            type: "LiquidityRemoved",
            blockNumber: e.blockNumber,
            txHash: e.transactionHash,
            details: `-${Number(ethers.formatEther(e.args[1])).toFixed(2)} EVOA / -${Number(ethers.formatEther(e.args[2])).toFixed(2)} EVOB (burned ${Number(ethers.formatEther(e.args[3])).toFixed(4)} LP)`,
          });
        }

        // Parameter updates
        const params = await pool.queryFilter(pool.filters.ParametersUpdated(), from, current);
        for (const e of params as any[]) {
          const modes = ["Normal", "Defensive", "VolAdaptive"];
          allEvents.push({
            type: "ParameterUpdate",
            blockNumber: e.blockNumber,
            txHash: e.transactionHash,
            details: `Fee: ${e.args[0]}bps | Beta: ${e.args[1]} | Mode: ${modes[Number(e.args[2])] || e.args[2]} | Agent: ${String(e.args[3]).slice(0, 10)}…`,
          });
        }

        // Agent registrations
        const regs = await ctrl.queryFilter(ctrl.filters.AgentRegistered(), from, current);
        for (const e of regs as any[]) {
          allEvents.push({
            type: "AgentRegistered",
            blockNumber: e.blockNumber,
            txHash: e.transactionHash,
            details: `Agent ${String(e.args[0]).slice(0, 10)}… | Bond: ${ethers.formatEther(e.args[1])} BNB`,
          });
        }

        // Slashing
        const slashes = await ctrl.queryFilter(ctrl.filters.AgentSlashed(), from, current);
        for (const e of slashes as any[]) {
          allEvents.push({
            type: "AgentSlashed",
            blockNumber: e.blockNumber,
            txHash: e.transactionHash,
            details: `Agent ${String(e.args[0]).slice(0, 10)}… | Slashed: ${ethers.formatEther(e.args[1])} BNB | Reason: ${e.args[2]}`,
          });
        }

        // Sort by block descending
        allEvents.sort((a, b) => b.blockNumber - a.blockNumber);
        setEvents(allEvents);
      } catch (e) {
        console.error("History fetch error:", e);
      } finally {
        setLoading(false);
      }
    })();
  }, [blockRange]);

  const filtered = filter === "all" ? events : events.filter((e) => e.type === filter);

  const typeColors: Record<string, string> = {
    Swap: "text-[var(--accent)]",
    LiquidityAdded: "text-[var(--green)]",
    LiquidityRemoved: "text-[var(--red)]",
    ParameterUpdate: "text-[var(--yellow)]",
    AgentRegistered: "text-blue-400",
    AgentSlashed: "text-orange-400",
  };

  const typeIcons: Record<string, string> = {
    Swap: "💱",
    LiquidityAdded: "💧",
    LiquidityRemoved: "🔥",
    ParameterUpdate: "⚙️",
    AgentRegistered: "🤖",
    AgentSlashed: "⚡",
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">📜 Transaction History</h1>
      <p className="text-[var(--muted)]">Recent on-chain events from EvoPool and AgentController</p>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        {["all", "Swap", "LiquidityAdded", "LiquidityRemoved", "ParameterUpdate", "AgentRegistered", "AgentSlashed"].map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${filter === f ? "bg-[var(--accent)] text-white" : "bg-[var(--card)] border border-[var(--border)] text-[var(--muted)]"}`}>
            {f === "all" ? "All" : `${typeIcons[f] || ""} ${f}`}
          </button>
        ))}
        <select value={blockRange} onChange={(e) => setBlockRange(Number(e.target.value))}
          className="ml-auto bg-[var(--card)] border border-[var(--border)] rounded-lg px-3 py-1 text-xs text-[var(--muted)]">
          <option value={1000}>Last 1K blocks</option>
          <option value={5000}>Last 5K blocks</option>
          <option value={10000}>Last 10K blocks</option>
        </select>
      </div>

      {/* Events list */}
      {loading ? (
        <div className="text-center py-10">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-2 border-[var(--accent)] border-t-transparent"></div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-8 text-center">
          <p className="text-[var(--muted)]">No events found in the selected range</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.slice(0, 100).map((ev, i) => (
            <div key={i} className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-2">
              <div className="flex items-center gap-2 min-w-[160px]">
                <span className="text-lg">{typeIcons[ev.type]}</span>
                <span className={`text-xs font-bold ${typeColors[ev.type]}`}>{ev.type}</span>
              </div>
              <div className="flex-1 text-sm font-mono text-[var(--muted)]">{ev.details}</div>
              <div className="flex items-center gap-3 text-xs text-[var(--muted)]">
                <span>Block {ev.blockNumber}</span>
                <a href={`https://testnet.bscscan.com/tx/${ev.txHash}`} target="_blank" rel="noopener noreferrer"
                  className="text-[var(--accent)] hover:underline">TX ↗</a>
              </div>
            </div>
          ))}
          {filtered.length > 100 && (
            <p className="text-center text-sm text-[var(--muted)]">Showing first 100 of {filtered.length} events</p>
          )}
        </div>
      )}
    </div>
  );
}
