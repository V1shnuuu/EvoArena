"use client";

import { useWallet } from "@/hooks/useWallet";
import { CopyButton } from "./CopyButton";

export function WalletButton() {
  const { address, connected, connecting, connect, disconnect } = useWallet();

  if (connecting) {
    return (
      <button
        disabled
        className="px-3 py-1.5 rounded-lg bg-[var(--card)] border border-[var(--border)] text-xs text-[var(--muted)] cursor-not-allowed"
      >
        Connecting…
      </button>
    );
  }

  if (connected && address) {
    return (
      <div className="flex items-center gap-2">
        <span className="px-3 py-1.5 rounded-lg bg-[var(--bg)] border border-[var(--accent)] text-xs font-mono text-[var(--accent)] inline-flex items-center gap-1.5">
          {address.slice(0, 6)}…{address.slice(-4)}
          <CopyButton text={address} />
        </span>
        <button
          onClick={disconnect}
          className="px-2 py-1.5 rounded-lg bg-[var(--bg)] border border-[var(--border)] text-xs text-[var(--red)] hover:bg-[var(--border)] transition cursor-pointer"
        >
          ✕
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => connect()}
      className="px-4 py-1.5 rounded-lg bg-[var(--accent)] text-[#0B0E11] text-xs font-bold hover:bg-[var(--accent-hover)] transition cursor-pointer"
    >
      Connect Wallet
    </button>
  );
}
