import type { Metadata } from "next";
import "./globals.css";
import { WalletProvider } from "@/hooks/useWallet";
import { ToastProvider } from "@/components/Toast";
import { Navbar } from "@/components/Navbar";
import { PoolEventListener } from "@/components/PoolEventListener";
import { KeyboardShortcuts } from "@/components/KeyboardShortcuts";
import { OnboardingTour } from "@/components/OnboardingTour";

export const metadata: Metadata = {
  title: "EvoArena — Adaptive Liquidity Dashboard",
  description: "AI-driven AMM parameter control on BNB Chain",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <WalletProvider>
          <ToastProvider>
          <PoolEventListener />
          <KeyboardShortcuts />
          <OnboardingTour />
          <Navbar />
          <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">{children}</main>
          <footer className="border-t border-[var(--border)] py-4 text-center text-xs text-[var(--muted)]">
            <span>EvoArena — Adaptive AI-driven AMM on </span>
            <a href="https://www.bnbchain.org" target="_blank" rel="noopener noreferrer" className="text-[var(--accent)] hover:underline">BNB Chain</a>
          </footer>
          </ToastProvider>
        </WalletProvider>
      </body>
    </html>
  );
}
