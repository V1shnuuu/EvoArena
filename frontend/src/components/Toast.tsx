"use client";

import { createContext, useContext, useState, useCallback, ReactNode } from "react";

export type ToastType = "success" | "error" | "info" | "loading";

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  txHash?: string;
  duration?: number; // ms, 0 = persistent
}

interface ToastContextType {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, "id">) => string;
  updateToast: (id: string, updates: Partial<Omit<Toast, "id">>) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType>({
  toasts: [],
  addToast: () => "",
  updateToast: () => {},
  removeToast: () => {},
});

let toastCounter = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((toast: Omit<Toast, "id">) => {
    const id = `toast-${++toastCounter}`;
    const duration = toast.duration ?? (toast.type === "loading" ? 0 : 5000);
    setToasts((prev) => [...prev, { ...toast, id, duration }]);
    if (duration > 0) {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration);
    }
    return id;
  }, []);

  const updateToast = useCallback((id: string, updates: Partial<Omit<Toast, "id">>) => {
    setToasts((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t;
        const updated = { ...t, ...updates };
        // Auto-dismiss after update if type changed from loading
        if (t.type === "loading" && updates.type && updates.type !== "loading") {
          const dur = updates.duration ?? 5000;
          if (dur > 0) {
            setTimeout(() => {
              setToasts((p) => p.filter((tt) => tt.id !== id));
            }, dur);
          }
        }
        return updated;
      })
    );
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, addToast, updateToast, removeToast }}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}

/* ─── Visual Toast Container ─────────────────────────────────── */

function ToastContainer({ toasts, onRemove }: { toasts: Toast[]; onRemove: (id: string) => void }) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onRemove={onRemove} />
      ))}
    </div>
  );
}

const ICONS: Record<ToastType, string> = {
  success: "✅",
  error: "❌",
  info: "ℹ️",
  loading: "⏳",
};

const BORDER_COLORS: Record<ToastType, string> = {
  success: "border-[var(--green)]",
  error: "border-[var(--red)]",
  info: "border-[var(--accent)]",
  loading: "border-[var(--accent)]",
};

function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: (id: string) => void }) {
  return (
    <div
      className={`pointer-events-auto bg-[var(--card)] border ${BORDER_COLORS[toast.type]} rounded-xl p-4 shadow-lg shadow-black/30 animate-slide-in flex items-start gap-3`}
    >
      <span className={`text-lg flex-shrink-0 ${toast.type === "loading" ? "animate-pulse" : ""}`}>
        {ICONS[toast.type]}
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-[var(--text)]">{toast.title}</div>
        {toast.message && (
          <div className="text-xs text-[var(--muted)] mt-0.5 break-words">{toast.message}</div>
        )}
        {toast.txHash && (
          <a
            href={`https://testnet.bscscan.com/tx/${toast.txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-[var(--accent)] hover:underline mt-1 inline-block"
          >
            View on BscScan ↗
          </a>
        )}
      </div>
      <button
        onClick={() => onRemove(toast.id)}
        className="text-[var(--muted)] hover:text-[var(--text)] text-sm flex-shrink-0 cursor-pointer"
      >
        ✕
      </button>
    </div>
  );
}
