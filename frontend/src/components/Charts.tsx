"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { ParameterEvent } from "@/hooks/useEvoPool";

const CHART_COLORS = {
  fee: "#F0B90B",
  beta: "#0ECB81",
  mode: "#F0B90B",
  reserve0: "#F0B90B",
  reserve1: "#0ECB81",
  aps: "#F0B90B",
  slippage: "#F6465D",
  volume: "#1E9FF2",
};

const tooltipStyle = {
  backgroundColor: "#14181e",
  border: "1px solid #2b3139",
  borderRadius: "8px",
  fontSize: "12px",
  color: "#EAECEF",
};

// ── Fee & Beta Over Time ────────────────────────────────────────────
export function FeeHistoryChart({ data }: { data: ParameterEvent[] }) {
  if (data.length === 0) return <EmptyChart label="No parameter history yet" />;

  const chartData = data.map((d, i) => ({
    index: i + 1,
    block: d.blockNumber,
    fee: d.feeBps,
    beta: d.curveBeta,
    mode: d.curveMode,
  }));

  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#2b3139" />
        <XAxis dataKey="index" tick={{ fontSize: 11, fill: "#848E9C" }} label={{ value: "Update #", position: "insideBottom", offset: -5, fill: "#848E9C", fontSize: 11 }} />
        <YAxis yAxisId="fee" tick={{ fontSize: 11, fill: "#848E9C" }} label={{ value: "Fee (bps)", angle: -90, position: "insideLeft", fill: "#848E9C", fontSize: 11 }} />
        <YAxis yAxisId="beta" orientation="right" tick={{ fontSize: 11, fill: "#848E9C" }} label={{ value: "Beta", angle: 90, position: "insideRight", fill: "#848E9C", fontSize: 11 }} />
        <Tooltip contentStyle={tooltipStyle} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Line yAxisId="fee" type="stepAfter" dataKey="fee" stroke={CHART_COLORS.fee} strokeWidth={2} dot={{ r: 3 }} name="Fee (bps)" />
        <Line yAxisId="beta" type="stepAfter" dataKey="beta" stroke={CHART_COLORS.beta} strokeWidth={2} dot={{ r: 3 }} name="Curve Beta" />
      </LineChart>
    </ResponsiveContainer>
  );
}

// ── Curve Mode Timeline ─────────────────────────────────────────────
export function ModeTimelineChart({ data }: { data: ParameterEvent[] }) {
  if (data.length === 0) return <EmptyChart label="No mode changes yet" />;

  const modeNames = ["Normal", "Defensive", "VolAdaptive"];
  const modeColors = ["#0ECB81", "#F6465D", "#F0B90B"];

  const chartData = data.map((d, i) => ({
    index: i + 1,
    mode: d.curveMode,
    modeName: modeNames[d.curveMode] || "Unknown",
    fill: modeColors[d.curveMode] || "#888899",
  }));

  return (
    <ResponsiveContainer width="100%" height={160}>
      <BarChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#2b3139" />
        <XAxis dataKey="index" tick={{ fontSize: 11, fill: "#848E9C" }} />
        <YAxis domain={[0, 2]} ticks={[0, 1, 2]} tickFormatter={(v) => modeNames[v] || ""} tick={{ fontSize: 10, fill: "#848E9C" }} />
        <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => modeNames[value] || value} />
        <Bar dataKey="mode" name="Curve Mode" radius={[4, 4, 0, 0]}>
          {chartData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.fill} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── Reserve Balance Over Polls ──────────────────────────────────────
export interface ReserveSnapshot {
  timestamp: number;
  reserve0: number;
  reserve1: number;
}

export function ReserveChart({ data }: { data: ReserveSnapshot[] }) {
  if (data.length === 0) return <EmptyChart label="Collecting reserve data…" />;

  const chartData = data.map((d, i) => ({
    index: i,
    time: new Date(d.timestamp).toLocaleTimeString(),
    EVOA: d.reserve0,
    EVOB: d.reserve1,
  }));

  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#2b3139" />
        <XAxis dataKey="time" tick={{ fontSize: 10, fill: "#848E9C" }} />
        <YAxis tick={{ fontSize: 11, fill: "#848E9C" }} />
        <Tooltip contentStyle={tooltipStyle} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Area type="monotone" dataKey="EVOA" stroke={CHART_COLORS.reserve0} fill={CHART_COLORS.reserve0} fillOpacity={0.15} strokeWidth={2} />
        <Area type="monotone" dataKey="EVOB" stroke={CHART_COLORS.reserve1} fill={CHART_COLORS.reserve1} fillOpacity={0.15} strokeWidth={2} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ── APS Over Epochs ─────────────────────────────────────────────────
export interface APSDataPoint {
  epoch: number;
  aps: number;
  lpReturnDelta: number;
  slippageReduction: number;
  volatilityCompression: number;
  feeRevenue: number;
  agentAddress: string;
}

export function APSChart({ data }: { data: APSDataPoint[] }) {
  if (data.length === 0) return <EmptyChart label="No APS data yet" />;

  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#2b3139" />
        <XAxis dataKey="epoch" tick={{ fontSize: 11, fill: "#848E9C" }} label={{ value: "Epoch", position: "insideBottom", offset: -5, fill: "#848E9C", fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11, fill: "#848E9C" }} />
        <Tooltip contentStyle={tooltipStyle} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Line type="monotone" dataKey="aps" stroke={CHART_COLORS.aps} strokeWidth={3} dot={{ r: 4 }} name="APS (composite)" />
        <Line type="monotone" dataKey="lpReturnDelta" stroke={CHART_COLORS.fee} strokeWidth={1} strokeDasharray="4 4" name="LP Return Δ" />
        <Line type="monotone" dataKey="slippageReduction" stroke={CHART_COLORS.slippage} strokeWidth={1} strokeDasharray="4 4" name="Slippage Reduction" />
        <Line type="monotone" dataKey="volatilityCompression" stroke={CHART_COLORS.beta} strokeWidth={1} strokeDasharray="4 4" name="Vol Compression" />
      </LineChart>
    </ResponsiveContainer>
  );
}

// ── Empty state ─────────────────────────────────────────────────────
function EmptyChart({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center h-40 text-[var(--muted)] text-sm">
      {label}
    </div>
  );
}
