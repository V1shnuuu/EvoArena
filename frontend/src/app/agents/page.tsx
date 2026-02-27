"use client";

import { useState, useEffect } from "react";
import { useAgents, useParameterHistory } from "@/hooks/useEvoPool";
import { useWallet } from "@/hooks/useWallet";
import { ethers } from "ethers";
import { CONTROLLER_ABI, ADDRESSES } from "@/lib/contracts";
import { APSChart, APSDataPoint } from "@/components/Charts";
import { CopyButton } from "@/components/CopyButton";

interface APSSnapshot {
  epoch: number;
  aps: number;
  lpReturnDelta: number;
  slippageReduction: number;
  volatilityCompression: number;
  feeRevenue: number;
  agentAddress: string;
  timestamp: string;
}

export default function AgentsPage() {
  const { agents, loading } = useAgents();
  const paramHistory = useParameterHistory();
  const { signer, connected, address } = useWallet();
  const [apsData, setApsData] = useState<APSSnapshot[]>([]);
  const [apsLoading, setApsLoading] = useState(true);
  const [registering, setRegistering] = useState(false);
  const [regStatus, setRegStatus] = useState<string | null>(null);
  const [bondInput, setBondInput] = useState("0.01");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/aps");
        const json = await res.json();
        setApsData(json.snapshots || []);
      } catch (e) {
        console.error("Failed to load APS data:", e);
      } finally {
        setApsLoading(false);
      }
    })();
  }, []);

  // Aggregate APS by agent for leaderboard
  const leaderboard = apsData.reduce<Record<string, { total: number; count: number; latest: number; best: number }>>((acc, s) => {
    const addr = s.agentAddress;
    if (!acc[addr]) acc[addr] = { total: 0, count: 0, latest: 0, best: 0 };
    acc[addr].total += s.aps;
    acc[addr].count++;
    acc[addr].latest = s.aps;
    acc[addr].best = Math.max(acc[addr].best, s.aps);
    return acc;
  }, {});

  const sortedLeaderboard = Object.entries(leaderboard)
    .map(([addr, stats]) => ({
      address: addr,
      avgAps: stats.count > 0 ? stats.total / stats.count : 0,
      latestAps: stats.latest,
      bestAps: stats.best,
      epochs: stats.count,
    }))
    .sort((a, b) => b.avgAps - a.avgAps);

  // Chart data
  const apsChartData: APSDataPoint[] = apsData.map((s) => ({
    epoch: s.epoch,
    aps: s.aps,
    lpReturnDelta: s.lpReturnDelta,
    slippageReduction: s.slippageReduction,
    volatilityCompression: s.volatilityCompression,
    feeRevenue: s.feeRevenue,
    agentAddress: s.agentAddress,
  }));

  const handleRegister = async () => {
    if (!connected || !signer) return;
    setRegistering(true);
    setRegStatus(null);
    try {
      const controller = new ethers.Contract(ADDRESSES.agentController, CONTROLLER_ABI, signer);
      const tx = await controller.registerAgent({ value: ethers.parseEther(bondInput) });
      setRegStatus("⏳ Waiting for confirmation…");
      await tx.wait();
      setRegStatus("✅ Agent registered! Refresh the page to see it.");
    } catch (err: any) {
      setRegStatus(`❌ ${err.reason || err.message}`);
    } finally {
      setRegistering(false);
    }
  };

  // Check if current user is already an agent
  const isCurrentUserAgent = agents.some(
    (a) => a.address.toLowerCase() === address?.toLowerCase()
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">🤖 <span className="text-[var(--accent)]">Agents</span></h1>
          <p className="text-[var(--muted)]">Registered AI agents controlling EvoPool parameters</p>
        </div>
        <div className="text-sm text-[var(--muted)]">
          {agents.length} agent{agents.length !== 1 ? "s" : ""} registered
        </div>
      </div>

      {/* Register Agent Card — shown if user is NOT already an agent */}
      {!isCurrentUserAgent && (
        <div className="bg-[var(--card)] border border-[var(--accent)] border-opacity-30 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-[var(--accent)] mb-3 uppercase tracking-wider">
            🔐 Register as Agent
          </h3>
          <p className="text-sm text-[var(--muted)] mb-4">
            Bond tBNB to become a registered agent. Agents can submit pool parameter updates and compete for epoch rewards.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 items-end">
            <div className="flex-1">
              <label className="text-xs text-[var(--muted)] mb-1 block">Bond Amount (tBNB)</label>
              <input
                type="number"
                step="0.001"
                min="0.01"
                value={bondInput}
                onChange={(e) => setBondInput(e.target.value)}
                className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-[var(--accent)] transition"
              />
            </div>
            <button
              onClick={handleRegister}
              disabled={registering || !connected}
              className={`px-6 py-2 rounded-lg font-bold text-sm transition cursor-pointer ${
                registering
                  ? "bg-gray-600 text-white cursor-not-allowed"
                  : !connected
                    ? "bg-gray-600 text-gray-400 cursor-not-allowed"
                    : "bg-[var(--accent)] text-[#0B0E11] hover:bg-[var(--accent-hover)]"
              }`}
            >
              {registering ? "Registering…" : !connected ? "Connect wallet in navbar" : "Register Agent"}
            </button>
          </div>
          {regStatus && <p className="text-sm mt-3">{regStatus}</p>}
        </div>
      )}

      {loading ? (
        <div className="text-center py-10">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-2 border-[var(--accent)] border-t-transparent"></div>
        </div>
      ) : agents.length === 0 ? (
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-8 text-center">
          <div className="text-5xl mb-4">🤖</div>
          <h3 className="text-lg font-bold mb-2">No Agents Registered Yet</h3>
          <p className="text-[var(--muted)] text-sm mb-4">
            Be the first! Register above with a tBNB bond, then submit parameter proposals from the Settings page.
          </p>
          <div className="text-xs text-[var(--muted)] space-y-1">
            <p>1. Connect MetaMask to BSC Testnet (Chain 97)</p>
            <p>2. Enter a bond amount (min 0.01 tBNB) and click Register</p>
            <p>3. Go to <a href="/settings" className="text-[var(--accent)] hover:underline">Settings</a> to submit parameter updates</p>
            <p>4. Or run the off-chain agent: <code className="bg-[var(--bg)] px-1 rounded">cd agent && npx ts-node src/index.ts --once</code></p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {agents.map((agent, i) => {
            const agentUpdates = paramHistory.filter(
              (e) => e.agent.toLowerCase() === agent.address.toLowerCase()
            );
            const agentAps = leaderboard[agent.address];
            return (
              <div key={i} className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className={`inline-block w-3 h-3 rounded-full ${agent.active ? "bg-[var(--green)]" : "bg-[var(--red)]"}`}></span>
                    <a
                      href={`https://testnet.bscscan.com/address/${agent.address}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-sm hover:text-[var(--accent)] transition"
                    >
                      {agent.address}
                    </a>
                    <CopyButton text={agent.address} />
                    {agent.address.toLowerCase() === address?.toLowerCase() && (
                      <span className="text-xs bg-[var(--accent)] text-[#0B0E11] px-2 py-0.5 rounded-full font-bold">You</span>
                    )}
                  </div>
                  <span className="text-sm text-[var(--muted)]">
                    Bond: {agent.bondAmount} BNB
                  </span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                  <div>
                    <div className="text-[var(--muted)]">Registered</div>
                    <div>{new Date(agent.registeredAt * 1000).toLocaleString()}</div>
                  </div>
                  <div>
                    <div className="text-[var(--muted)]">Last Update</div>
                    <div>
                      {agent.lastUpdateTime > 0
                        ? new Date(agent.lastUpdateTime * 1000).toLocaleString()
                        : "Never"}
                    </div>
                  </div>
                  <div>
                    <div className="text-[var(--muted)]">Updates</div>
                    <div>{agentUpdates.length}</div>
                  </div>
                  <div>
                    <div className="text-[var(--muted)]">Avg APS</div>
                    <div className="text-[var(--accent)] font-bold">
                      {agentAps && agentAps.count > 0
                        ? (agentAps.total / agentAps.count).toFixed(4)
                        : "—"}
                    </div>
                  </div>
                  <div>
                    <div className="text-[var(--muted)]">Best APS</div>
                    <div className="text-[var(--green)] font-bold">
                      {agentAps && agentAps.best > 0 ? agentAps.best.toFixed(4) : "—"}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* APS Leaderboard */}
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-5">
        <h3 className="text-sm font-semibold text-[var(--muted)] mb-3 uppercase tracking-wider">
          🏆 APS Leaderboard
        </h3>
        {sortedLeaderboard.length === 0 ? (
          <p className="text-[var(--muted)] text-sm">
            {apsLoading
              ? "Loading APS data…"
              : "No APS scores recorded yet. Run the agent to generate scores."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[var(--muted)] text-left">
                  <th className="pb-2">Rank</th>
                  <th className="pb-2">Agent</th>
                  <th className="pb-2">Avg APS</th>
                  <th className="pb-2">Best APS</th>
                  <th className="pb-2">Latest APS</th>
                  <th className="pb-2">Epochs</th>
                </tr>
              </thead>
              <tbody>
                {sortedLeaderboard.map((entry, i) => (
                  <tr key={entry.address} className="border-t border-[var(--border)]">
                    <td className="py-2">
                      <span className={`font-bold ${i === 0 ? "text-[var(--yellow)]" : i === 1 ? "text-gray-400" : i === 2 ? "text-amber-700" : ""}`}>
                        #{i + 1}
                      </span>
                    </td>
                    <td className="py-2 font-mono text-xs">{entry.address.slice(0, 10)}…{entry.address.slice(-6)}</td>
                    <td className="py-2 font-bold text-[var(--accent)]">{entry.avgAps.toFixed(4)}</td>
                    <td className="py-2 text-[var(--green)]">{entry.bestAps.toFixed(4)}</td>
                    <td className="py-2">{entry.latestAps.toFixed(4)}</td>
                    <td className="py-2">{entry.epochs}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* APS Chart */}
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-5">
        <h3 className="text-sm font-semibold text-[var(--muted)] mb-3 uppercase tracking-wider">
          📊 APS Over Epochs
        </h3>
        <APSChart data={apsChartData} />
      </div>
    </div>
  );
}
