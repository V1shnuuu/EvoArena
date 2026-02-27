"use client";

import { useState, useEffect, useRef } from "react";
import { usePoolState, useParameterHistory } from "@/hooks/useEvoPool";
import { CURVE_MODES } from "@/lib/contracts";
import { FeeHistoryChart, ModeTimelineChart, ReserveChart, ReserveSnapshot } from "@/components/Charts";

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-5">
      <h3 className="text-sm font-semibold text-[var(--muted)] mb-3 uppercase tracking-wider">{title}</h3>
      {children}
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs text-[var(--muted)]">{label}</div>
      {sub && <div className="text-xs text-[var(--accent)] mt-1">{sub}</div>}
    </div>
  );
}

export default function PoolPage() {
  const { state, loading, error } = usePoolState(8000);
  const paramHistory = useParameterHistory();

  // Accumulate reserve snapshots for the live chart
  const [reserveSnapshots, setReserveSnapshots] = useState<ReserveSnapshot[]>([]);
  const prevTradeCount = useRef<number | null>(null);

  useEffect(() => {
    if (!state) return;
    // Only push a new snapshot if something changed
    const r0 = Number(state.reserve0);
    const r1 = Number(state.reserve1);
    setReserveSnapshots((prev) => {
      const last = prev[prev.length - 1];
      if (last && last.reserve0 === r0 && last.reserve1 === r1) return prev;
      const next = [...prev, { timestamp: Date.now(), reserve0: r0, reserve1: r1 }];
      return next.length > 100 ? next.slice(-100) : next;
    });
    prevTradeCount.current = state.tradeCount;
  }, [state]);

  if (error) {
    return (
      <div className="text-center py-20">
        <p className="text-[var(--red)] text-lg mb-2">Connection Error</p>
        <p className="text-[var(--muted)] text-sm">{error}</p>
        <p className="text-[var(--muted)] text-sm mt-4">Set contract addresses in <code>.env.local</code></p>
      </div>
    );
  }

  if (loading || !state) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">🏊 <span className="text-[var(--accent)]">EvoPool</span></h1>
        <p className="text-[var(--muted)]">Adaptive AMM with dynamic curve, fee, and mode control — on BNB Chain</p>
        {/* Skeleton stat cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-5">
              <div className="skeleton h-3 w-16 mb-3"></div>
              <div className="skeleton h-7 w-24 mb-1"></div>
              <div className="skeleton h-3 w-12"></div>
            </div>
          ))}
        </div>
        {/* Skeleton parameter cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-5">
              <div className="skeleton h-3 w-12 mb-3"></div>
              <div className="skeleton h-9 w-20"></div>
            </div>
          ))}
        </div>
        {/* Skeleton charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-5">
            <div className="skeleton h-3 w-32 mb-3"></div>
            <div className="skeleton h-48 w-full"></div>
          </div>
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-5">
            <div className="skeleton h-3 w-32 mb-3"></div>
            <div className="skeleton h-48 w-full"></div>
          </div>
        </div>
      </div>
    );
  }

  const modeColor = state.curveMode === 0
    ? "text-[var(--green)]"
    : state.curveMode === 1
      ? "text-[var(--red)]"
      : "text-[var(--yellow)]";

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">🏊 <span className="text-[var(--accent)]">EvoPool</span></h1>
      <p className="text-[var(--muted)]">Adaptive AMM with dynamic curve, fee, and mode control — on BNB Chain</p>

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card title="Reserve 0">
          <Stat label="EVOA" value={Number(state.reserve0).toLocaleString(undefined, { maximumFractionDigits: 2 })} />
        </Card>
        <Card title="Reserve 1">
          <Stat label="EVOB" value={Number(state.reserve1).toLocaleString(undefined, { maximumFractionDigits: 2 })} />
        </Card>
        <Card title="Price">
          <Stat label="EVOA / EVOB" value={state.price} />
        </Card>
        <Card title="Trades">
          <Stat label="Total swaps" value={state.tradeCount.toString()} />
        </Card>
      </div>

      {/* Parameters */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card title="Fee">
          <div className="text-3xl font-bold">{state.feeBps} <span className="text-base text-[var(--muted)]">bps</span></div>
          <div className="text-xs text-[var(--muted)] mt-1">{(state.feeBps / 100).toFixed(2)}%</div>
        </Card>
        <Card title="Curve Beta">
          <div className="text-3xl font-bold">{state.curveBeta}</div>
          <div className="text-xs text-[var(--muted)] mt-1">{(state.curveBeta / 10000).toFixed(4)} (scaled)</div>
        </Card>
        <Card title="Curve Mode">
          <div className={`text-3xl font-bold ${modeColor}`}>{state.curveModeName}</div>
          <div className="text-xs text-[var(--muted)] mt-1">Mode {state.curveMode}</div>
        </Card>
      </div>

      {/* Charts Row 1: Fee/Beta History + Reserve Balances */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="📈 Fee & Beta History">
          <FeeHistoryChart data={paramHistory} />
        </Card>
        <Card title="💰 Reserve Balances (Live)">
          <ReserveChart data={reserveSnapshots} />
        </Card>
      </div>

      {/* Charts Row 2: Mode Timeline */}
      <Card title="🔀 Curve Mode Timeline">
        <ModeTimelineChart data={paramHistory} />
      </Card>

      {/* Parameter History Table */}
      <Card title="Recent Parameter Updates">
        {paramHistory.length === 0 ? (
          <p className="text-[var(--muted)] text-sm">No parameter updates found in recent blocks</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[var(--muted)] text-left">
                  <th className="pb-2">Block</th>
                  <th className="pb-2">Fee (bps)</th>
                  <th className="pb-2">Beta</th>
                  <th className="pb-2">Mode</th>
                  <th className="pb-2">Agent</th>
                  <th className="pb-2">TX</th>
                </tr>
              </thead>
              <tbody>
                {paramHistory.slice().reverse().map((e, i) => (
                  <tr key={i} className="border-t border-[var(--border)]">
                    <td className="py-2">{e.blockNumber}</td>
                    <td className="py-2">{e.feeBps}</td>
                    <td className="py-2">{e.curveBeta}</td>
                    <td className="py-2">{CURVE_MODES[e.curveMode] || e.curveMode}</td>
                    <td className="py-2 font-mono text-xs">{e.agent.slice(0, 8)}…</td>
                    <td className="py-2">
                      <a
                        href={`https://testnet.bscscan.com/tx/${e.txHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[var(--accent)] hover:underline"
                      >
                        View ↗
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
