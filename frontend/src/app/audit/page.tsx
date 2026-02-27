"use client";

import { useState, useEffect } from "react";
import { useGreenfield } from "@/hooks/useGreenfield";
import { getObjectUrl, EVOARENA_BUCKET, GREENFIELD_SP_ENDPOINT, type AgentStrategyLog } from "@/lib/greenfield";

interface LogEntry {
  objectName: string;
  size: number;
  createAt: number;
  data: AgentStrategyLog | null;
  url: string;
  loading: boolean;
}

export default function AuditPage() {
  const { listLogs } = useGreenfield();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLog, setSelectedLog] = useState<LogEntry | null>(null);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    loadLogs();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadLogs = async () => {
    setLoading(true);
    try {
      const objects = await listLogs();
      const entries: LogEntry[] = objects
        .filter((obj: any) => obj?.ObjectInfo?.ObjectName?.endsWith(".json"))
        .map((obj: any) => ({
          objectName: obj.ObjectInfo.ObjectName,
          size: Number(obj.ObjectInfo.PayloadSize ?? 0),
          createAt: Number(obj.ObjectInfo.CreateAt ?? 0),
          data: null,
          url: getObjectUrl(EVOARENA_BUCKET, obj.ObjectInfo.ObjectName),
          loading: false,
        }))
        .sort((a: LogEntry, b: LogEntry) => b.createAt - a.createAt);
      setLogs(entries);
    } catch (err) {
      console.error("Failed to load logs:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchLogContent = async (entry: LogEntry) => {
    if (entry.data || entry.loading) return;
    // Mark as loading
    setLogs((prev) =>
      prev.map((l) => (l.objectName === entry.objectName ? { ...l, loading: true } : l))
    );
    try {
      const res = await fetch(entry.url);
      if (res.ok) {
        const data = await res.json();
        setLogs((prev) =>
          prev.map((l) =>
            l.objectName === entry.objectName ? { ...l, data, loading: false } : l
          )
        );
        setSelectedLog({ ...entry, data, loading: false });
      }
    } catch {
      setLogs((prev) =>
        prev.map((l) =>
          l.objectName === entry.objectName ? { ...l, loading: false } : l
        )
      );
    }
  };

  const extractAgent = (name: string) => {
    const parts = name.split("/");
    return parts.length >= 2 ? parts[1] : "unknown";
  };

  const filteredLogs = filter
    ? logs.filter(
        (l) =>
          l.objectName.toLowerCase().includes(filter.toLowerCase()) ||
          extractAgent(l.objectName).includes(filter.toLowerCase())
      )
    : logs;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold">
            📋 <span className="text-[var(--accent)]">Audit Trail</span>
          </h1>
          <p className="text-[var(--muted)] text-sm mt-1">
            Agent strategy logs stored on{" "}
            <a
              href="https://docs.bnbchain.org/bnb-greenfield/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--accent)] hover:underline"
            >
              BNB Greenfield
            </a>{" "}
            — decentralized & immutable
          </p>
        </div>
        <button
          onClick={loadLogs}
          className="text-sm px-3 py-1.5 rounded-lg border border-[var(--border)] text-[var(--muted)] hover:text-[var(--accent)] hover:border-[var(--accent)] transition"
        >
          🔄 Refresh
        </button>
      </div>

      {/* Greenfield info banner */}
      <div className="bg-[var(--card)] border border-[var(--accent)]/30 rounded-xl p-4 text-sm flex items-start gap-3">
        <span className="text-2xl">🟢</span>
        <div>
          <p className="font-bold text-[var(--foreground)]">Powered by BNB Greenfield</p>
          <p className="text-[var(--muted)] mt-1">
            Every AI agent parameter update is stored as a JSON object on Greenfield&apos;s
            decentralized storage network. This creates a transparent, tamper-proof
            audit trail that anyone can verify.
          </p>
          <div className="flex gap-4 mt-2 text-xs text-[var(--muted)]">
            <span>
              📦 Bucket: <code className="text-[var(--accent)]">{EVOARENA_BUCKET}</code>
            </span>
            <span>
              🌐 SP:{" "}
              <a
                href={GREENFIELD_SP_ENDPOINT}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--accent)] hover:underline"
              >
                SP1 Testnet
              </a>
            </span>
            <a
              href="https://testnet.greenfieldscan.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--accent)] hover:underline"
            >
              Explorer ↗
            </a>
          </div>
        </div>
      </div>

      {/* Filter */}
      <input
        type="text"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="Filter by agent address or object name…"
        className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-[var(--accent)] transition"
      />

      {/* Loading */}
      {loading && (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="skeleton rounded-lg h-16" />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && filteredLogs.length === 0 && (
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-12 text-center">
          <p className="text-4xl mb-3">📭</p>
          <p className="text-[var(--muted)]">
            {filter
              ? "No logs match your filter"
              : "No audit logs found yet. Logs are created when agents submit parameter updates."}
          </p>
        </div>
      )}

      {/* Log list */}
      {!loading && filteredLogs.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-[var(--muted)]">
            {filteredLogs.length} log{filteredLogs.length !== 1 ? "s" : ""} found
          </p>
          {filteredLogs.map((entry) => {
            const agent = extractAgent(entry.objectName);
            const agentShort = agent.slice(0, 6) + "…" + agent.slice(-4);
            const dateStr = entry.createAt
              ? new Date(entry.createAt * 1000).toLocaleString()
              : "Unknown";

            return (
              <div
                key={entry.objectName}
                className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-4 hover:border-[var(--accent)] transition cursor-pointer"
                onClick={() => fetchLogContent(entry)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-lg">
                      {entry.data?.action === "parameter_update"
                        ? "⚙️"
                        : entry.data?.action === "registration"
                        ? "🆕"
                        : "📊"}
                    </span>
                    <div>
                      <p className="text-sm font-mono text-[var(--foreground)]">
                        Agent: {agentShort}
                      </p>
                      <p className="text-xs text-[var(--muted)]">{dateStr}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-[var(--muted)]">
                      {(entry.size / 1024).toFixed(1)} KB
                    </span>
                    <a
                      href={entry.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-[var(--accent)] hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      View on Greenfield ↗
                    </a>
                  </div>
                </div>

                {/* Expanded detail */}
                {selectedLog?.objectName === entry.objectName && selectedLog.data && (
                  <div className="mt-3 pt-3 border-t border-[var(--border)] text-xs space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <span className="text-[var(--muted)]">Action:</span>{" "}
                        <span className="text-[var(--foreground)] font-mono">
                          {selectedLog.data.action}
                        </span>
                      </div>
                      {selectedLog.data.data.feeBps !== undefined && (
                        <div>
                          <span className="text-[var(--muted)]">Fee:</span>{" "}
                          <span className="text-[var(--foreground)] font-mono">
                            {selectedLog.data.data.feeBps} bps
                          </span>
                        </div>
                      )}
                      {selectedLog.data.data.curveModeName && (
                        <div>
                          <span className="text-[var(--muted)]">Curve:</span>{" "}
                          <span className="text-[var(--foreground)] font-mono">
                            {selectedLog.data.data.curveModeName}
                          </span>
                        </div>
                      )}
                      {selectedLog.data.data.txHash && (
                        <div>
                          <span className="text-[var(--muted)]">TX:</span>{" "}
                          <a
                            href={`https://testnet.bscscan.com/tx/${selectedLog.data.data.txHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[var(--accent)] hover:underline font-mono"
                          >
                            {selectedLog.data.data.txHash.slice(0, 10)}…
                          </a>
                        </div>
                      )}
                    </div>
                    {selectedLog.data.data.reason && (
                      <p className="text-[var(--muted)]">
                        💡 {selectedLog.data.data.reason}
                      </p>
                    )}
                    <details className="mt-2">
                      <summary className="text-[var(--accent)] cursor-pointer hover:underline">
                        Raw JSON
                      </summary>
                      <pre className="mt-1 bg-[var(--bg)] rounded p-2 overflow-x-auto text-[10px] text-[var(--muted)]">
                        {JSON.stringify(selectedLog.data, null, 2)}
                      </pre>
                    </details>
                  </div>
                )}

                {entry.loading && (
                  <p className="mt-2 text-xs text-[var(--muted)] animate-pulse">
                    Loading log content…
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
