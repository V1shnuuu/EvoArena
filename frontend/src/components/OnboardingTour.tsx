"use client";

import { useState, useEffect } from "react";

interface TourStep {
  target: string; // CSS selector
  title: string;
  content: string;
  position?: "top" | "bottom" | "left" | "right";
}

const TOUR_STEPS: TourStep[] = [
  {
    target: 'a[href="/swap"]',
    title: "Swap Tokens",
    content: "Trade EVOA ↔ EVOB with adaptive fees that change based on market conditions.",
    position: "bottom",
  },
  {
    target: 'a[href="/liquidity"]',
    title: "Provide Liquidity",
    content: "Add or remove liquidity from EvoPool and earn LP tokens.",
    position: "bottom",
  },
  {
    target: 'a[href="/agents"]',
    title: "AI Agents",
    content: "View registered AI agents that compete to optimize pool parameters.",
    position: "bottom",
  },
  {
    target: 'a[href="/settings"]',
    title: "Agent Settings",
    content: "Register as an agent and submit parameter updates to the pool.",
    position: "bottom",
  },
];

const STORAGE_KEY = "evo-tour-completed";

export function OnboardingTour() {
  const [step, setStep] = useState(-1); // -1 = not started / dismissed
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);

  useEffect(() => {
    const done = localStorage.getItem(STORAGE_KEY);
    if (!done) {
      // Auto-start after a brief delay
      const timer = setTimeout(() => setStep(0), 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  useEffect(() => {
    if (step < 0 || step >= TOUR_STEPS.length) {
      setPos(null);
      return;
    }
    const el = document.querySelector(TOUR_STEPS[step].target);
    if (el) {
      const rect = el.getBoundingClientRect();
      setPos({ top: rect.bottom + window.scrollY + 8, left: rect.left + rect.width / 2, width: rect.width });
    }
  }, [step]);

  const finish = () => {
    setStep(-1);
    localStorage.setItem(STORAGE_KEY, "true");
  };

  const next = () => {
    if (step >= TOUR_STEPS.length - 1) {
      finish();
    } else {
      setStep(step + 1);
    }
  };

  const skip = () => finish();

  if (step < 0 || step >= TOUR_STEPS.length || !pos) return null;

  const current = TOUR_STEPS[step];

  return (
    <>
      {/* Dimmed overlay */}
      <div className="fixed inset-0 z-[60] bg-black/40 pointer-events-none" />

      {/* Tooltip */}
      <div
        className="fixed z-[61] bg-[var(--card)] border border-[var(--accent)] rounded-xl p-4 shadow-2xl max-w-xs animate-slide-in"
        style={{ top: pos.top, left: Math.max(16, pos.left - 140) }}
      >
        {/* Arrow */}
        <div
          className="absolute -top-2 w-4 h-4 bg-[var(--card)] border-l border-t border-[var(--accent)] rotate-45"
          style={{ left: Math.min(pos.left - Math.max(16, pos.left - 140), 260) }}
        />
        <p className="text-sm font-bold text-[var(--accent)] mb-1">{current.title}</p>
        <p className="text-xs text-[var(--muted)] mb-3">{current.content}</p>
        <div className="flex items-center justify-between">
          <span className="text-xs text-[var(--muted)]">{step + 1} / {TOUR_STEPS.length}</span>
          <div className="flex gap-2">
            <button onClick={skip} className="text-xs text-[var(--muted)] hover:text-[var(--foreground)] transition">
              Skip
            </button>
            <button onClick={next} className="text-xs bg-[var(--accent)] text-[#0B0E11] font-bold px-3 py-1 rounded-lg hover:brightness-110 transition">
              {step === TOUR_STEPS.length - 1 ? "Done" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
