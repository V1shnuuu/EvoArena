"use client";

import { useState, useCallback } from "react";

export function CopyButton({ text, className }: { text: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  }, [text]);

  return (
    <button
      onClick={handleCopy}
      title="Copy to clipboard"
      className={`inline-flex items-center text-[var(--muted)] hover:text-[var(--accent)] transition cursor-pointer ${className || ""}`}
    >
      {copied ? (
        <span className="text-[var(--green)] text-xs">✓ Copied</span>
      ) : (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
      )}
    </button>
  );
}

/** Truncated address with copy button */
export function AddressDisplay({
  address,
  chars = 6,
  linkPrefix,
}: {
  address: string;
  chars?: number;
  linkPrefix?: string; // e.g. "https://testnet.bscscan.com/address/"
}) {
  const short = `${address.slice(0, chars + 2)}…${address.slice(-chars)}`;

  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-sm">
      {linkPrefix ? (
        <a href={`${linkPrefix}${address}`} target="_blank" rel="noopener noreferrer" className="hover:text-[var(--accent)] transition">
          {short}
        </a>
      ) : (
        <span>{short}</span>
      )}
      <CopyButton text={address} />
    </span>
  );
}
