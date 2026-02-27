"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Global keyboard shortcuts:
 * - Ctrl/Cmd + 1..7: Navigate to pages
 * - Ctrl/Cmd + K: Focus search / swap input (if on swap page)
 */
export function useKeyboardShortcuts() {
  const router = useRouter();

  useEffect(() => {
    const routes = ["/", "/agents", "/swap", "/liquidity", "/history", "/settings", "/demo"];

    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;

      // Number keys 1-7 for navigation
      const num = parseInt(e.key);
      if (num >= 1 && num <= 7) {
        e.preventDefault();
        router.push(routes[num - 1]);
        return;
      }

      // Ctrl+K → focus amount input on swap page
      if (e.key === "k" || e.key === "K") {
        e.preventDefault();
        const input = document.querySelector<HTMLInputElement>('input[placeholder="0.0"]');
        if (input) input.focus();
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [router]);
}
