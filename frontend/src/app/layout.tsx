import type { Metadata } from "next";
import "./globals.css";
import { WalletProvider } from "@/hooks/useWallet";
import { WalletButton } from "@/components/WalletButton";

export const metadata: Metadata = {
  title: "EvoArena — Adaptive Liquidity Dashboard",
  description: "AI-driven AMM parameter control on BNB Chain",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <WalletProvider>
          <nav className="border-b border-[var(--border)] px-4 sm:px-6 py-3 sm:py-4 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="text-xl font-bold text-[var(--accent)]">⚔️ EvoArena</span>
              <span className="text-sm text-[var(--muted)] hidden sm:inline">Adaptive Liquidity Dashboard</span>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4 text-sm text-[var(--muted)]">
              <a href="/" className="hover:text-white transition">Pool</a>
              <a href="/agents" className="hover:text-white transition">Agents</a>
              <a href="/swap" className="hover:text-white transition">Swap</a>
              <a href="/liquidity" className="hover:text-white transition">Liquidity</a>
              <a href="/history" className="hover:text-white transition">History</a>
              <a href="/settings" className="hover:text-white transition">Settings</a>
              <a href="/demo" className="hover:text-white transition">Demo</a>
              <WalletButton />
            </div>
          </nav>
          <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">{children}</main>
        </WalletProvider>
      </body>
    </html>
  );
}
