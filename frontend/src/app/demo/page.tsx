"use client";

import { useState, useEffect } from "react";
import { usePoolState } from "@/hooks/useEvoPool";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from "recharts";

const tooltipStyle = {
  backgroundColor: "#111118",
  border: "1px solid #1e1e2e",
  borderRadius: "8px",
  fontSize: "12px",
};

export default function DemoPage() {
  const { state, loading, refetch } = usePoolState(5000);
  const [demoLog, setDemoLog] = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  const [lastResult, setLastResult] = useState<any>(null);
  const [epochCount, setEpochCount] = useState(0);

  const runDemoEpoch = async () => {
    setRunning(true);
    setDemoLog((prev) => [...prev, `[${new Date().toISOString()}] Starting demo epoch...`]);

    try {
      const res = await fetch("/api/demo", { method: "POST" });
      const data = await res.json();
      setLastResult(data);

      if (data.error) {
        setDemoLog((prev) => [...prev, `❌ Error: ${data.error}`]);
        if (data.hint) setDemoLog((prev) => [...prev, `   💡 ${data.hint}`]);
      } else {
        setEpochCount((c) => c + 1);
        setDemoLog((prev) => [
          ...prev,
          data.live ? `🟢 LIVE agent execution` : `🔵 Read-only (agent not configured)`,
          `✅ ${data.message || "Epoch completed"}`,
          `   Rule: ${data.ruleFired || "unknown"}`,
          `   Fee: ${data.feeBps ?? "?"} bps → Mode: ${data.curveModeName || data.curveMode || "?"}`,
          ...(data.txHash ? [`   TX: ${data.txHash}`] : []),
          ...(data.aps != null ? [`   APS: ${data.aps}`] : []),
          `   Agent: ${data.agentAddress || "n/a"}`,
        ]);
      }

      await refetch();
    } catch (err: any) {
      setDemoLog((prev) => [...prev, `❌ Fetch error: ${err.message}`]);
    } finally {
      setRunning(false);
    }
  };

  // Comparison data for bar chart
  const comparisonData = state ? [
    {
      metric: "Fee (bps)",
      Static: 30,
      EvoPool: state.feeBps,
    },
    {
      metric: "Whale Defense",
      Static: 0,
      EvoPool: state.curveMode === 1 ? 100 : state.curveMode === 2 ? 50 : 10,
    },
    {
      metric: "Adaptability",
      Static: 0,
      EvoPool: state.curveMode === 2 ? 100 : state.curveMode === 1 ? 70 : 20,
    },
    {
      metric: "Beta Impact",
      Static: 50,
      EvoPool: state.curveBeta / 100,
    },
  ] : [];

  // Radar chart data
  const radarData = state ? [
    { subject: "Fee Efficiency", Static: 30, EvoPool: Math.min(100, state.feeBps * 2), fullMark: 100 },
    { subject: "Whale Defense", Static: 10, EvoPool: state.curveMode === 1 ? 95 : 30, fullMark: 100 },
    { subject: "Vol Adaptation", Static: 10, EvoPool: state.curveMode === 2 ? 90 : 20, fullMark: 100 },
    { subject: "LP Protection", Static: 40, EvoPool: state.curveMode > 0 ? 85 : 45, fullMark: 100 },
    { subject: "Capital Efficiency", Static: 50, EvoPool: 70, fullMark: 100 },
  ] : [];

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">🎮 Demo Panel</h1>
      <p className="text-[var(--muted)]">
        Run a single agent epoch to see parameter updates in real-time
      </p>

      {/* Current state */}
      {state && (
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-5">
          <h3 className="text-sm font-semibold text-[var(--muted)] mb-3 uppercase tracking-wider">
            Current Pool State
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
            <div>
              <div className="text-[var(--muted)]">Fee</div>
              <div className="text-xl font-bold">{state.feeBps} bps</div>
            </div>
            <div>
              <div className="text-[var(--muted)]">Beta</div>
              <div className="text-xl font-bold">{state.curveBeta}</div>
            </div>
            <div>
              <div className="text-[var(--muted)]">Mode</div>
              <div className={`text-xl font-bold ${state.curveMode === 0 ? "text-[var(--green)]" : state.curveMode === 1 ? "text-[var(--red)]" : "text-[var(--yellow)]"}`}>
                {state.curveModeName}
              </div>
            </div>
            <div>
              <div className="text-[var(--muted)]">Trades</div>
              <div className="text-xl font-bold">{state.tradeCount}</div>
            </div>
            <div>
              <div className="text-[var(--muted)]">Epochs Run</div>
              <div className="text-xl font-bold text-[var(--accent)]">{epochCount}</div>
            </div>
          </div>
        </div>
      )}

      {/* Run button */}
      <div className="flex items-center gap-4">
        <button
          onClick={runDemoEpoch}
          disabled={running}
          className={`px-6 py-3 rounded-lg font-semibold text-white transition cursor-pointer ${
            running
              ? "bg-gray-600 cursor-not-allowed"
              : "bg-[var(--accent)] hover:bg-indigo-500"
          }`}
        >
          {running ? "⏳ Running epoch..." : "⚡ Run Demo Epoch"}
        </button>
        <button
          onClick={() => setDemoLog([])}
          className="px-4 py-3 rounded-lg font-semibold text-[var(--muted)] bg-[var(--card)] border border-[var(--border)] hover:text-white transition cursor-pointer"
        >
          Clear Log
        </button>
      </div>

      <p className="text-xs text-[var(--muted)]">
        This calls the agent in <code>--once</code> mode via the backend API.
        The agent reads pool state, computes strategy, and submits a parameter update on-chain.
      </p>

      {/* Log */}
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-5">
        <h3 className="text-sm font-semibold text-[var(--muted)] mb-3 uppercase tracking-wider">
          Demo Log
        </h3>
        <div className="font-mono text-xs space-y-1 max-h-80 overflow-y-auto">
          {demoLog.length === 0 ? (
            <p className="text-[var(--muted)]">Click &quot;Run Demo Epoch&quot; to start</p>
          ) : (
            demoLog.map((line, i) => (
              <div key={i} className={`${line.startsWith("❌") ? "text-[var(--red)]" : line.startsWith("✅") || line.startsWith("🟢") ? "text-[var(--green)]" : "text-[var(--text)]"}`}>
                {line}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Comparison Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Bar Chart Comparison */}
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-5">
          <h3 className="text-sm font-semibold text-[var(--muted)] mb-3 uppercase tracking-wider">
            📊 Static vs EvoPool — Metrics
          </h3>
          {comparisonData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={comparisonData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e1e2e" />
                <XAxis dataKey="metric" tick={{ fontSize: 10, fill: "#888899" }} />
                <YAxis tick={{ fontSize: 11, fill: "#888899" }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="Static" fill="#ef4444" radius={[4, 4, 0, 0]} />
                <Bar dataKey="EvoPool" fill="#22c55e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-[var(--muted)] text-sm text-center py-8">Loading…</p>
          )}
        </div>

        {/* Radar Chart */}
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-5">
          <h3 className="text-sm font-semibold text-[var(--muted)] mb-3 uppercase tracking-wider">
            🕸️ Capability Radar
          </h3>
          {radarData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
                <PolarGrid stroke="#1e1e2e" />
                <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fill: "#888899" }} />
                <PolarRadiusAxis tick={{ fontSize: 9, fill: "#888899" }} domain={[0, 100]} />
                <Radar name="Static AMM" dataKey="Static" stroke="#ef4444" fill="#ef4444" fillOpacity={0.15} strokeWidth={2} />
                <Radar name="EvoPool" dataKey="EvoPool" stroke="#22c55e" fill="#22c55e" fillOpacity={0.2} strokeWidth={2} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </RadarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-[var(--muted)] text-sm text-center py-8">Loading…</p>
          )}
        </div>
      </div>

      {/* Text Comparison */}
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-5">
        <h3 className="text-sm font-semibold text-[var(--muted)] mb-3 uppercase tracking-wider">
          Static Baseline vs EvoPool — Feature Comparison
        </h3>
        <div className="grid grid-cols-2 gap-8 text-sm">
          <div>
            <h4 className="font-bold mb-2 text-[var(--red)]">❌ Static AMM</h4>
            <ul className="space-y-1 text-[var(--muted)]">
              <li>• Fee: 30 bps (forever fixed)</li>
              <li>• Curve: constant-product only</li>
              <li>• No whale defense</li>
              <li>• No volatility adaptation</li>
              <li>• LPs bleed during high-vol</li>
            </ul>
          </div>
          <div>
            <h4 className="font-bold mb-2 text-[var(--green)]">✅ EvoPool (Agent-Controlled)</h4>
            <ul className="space-y-1 text-[var(--muted)]">
              <li>• Fee: <span className="text-[var(--foreground)] font-bold">{state?.feeBps || "?"} bps</span> (AI-tuned per epoch)</li>
              <li>• Curve: <span className="text-[var(--foreground)] font-bold">{state?.curveModeName || "?"}</span></li>
              <li>• Whale defense: {state?.curveMode === 1 ? <span className="text-[var(--green)]">Active ✅ (quadratic penalty)</span> : "Standby"}</li>
              <li>• Vol adaptive: {state?.curveMode === 2 ? <span className="text-[var(--yellow)]">Active ✅ (spread widening)</span> : "Standby"}</li>
              <li>• LPs protected by dynamic curve selection</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
