"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";

export type ToastOptions = {
  description?: string;
  variant?: "default" | "success" | "error" | "warning";
  /** Default 5s for simple toasts; use `Infinity` until dismissed or for action toasts. */
  duration?: number;
  action?: { label: string; onClick: () => void };
  cancel?: { label: string; onClick?: () => void };
};

type ToastState = { id: string; message: string } & ToastOptions;

type ToastContextValue = {
  toast: (message: string, options?: ToastOptions) => void;
  success: (message: string, options?: Omit<ToastOptions, "variant">) => void;
  error: (message: string, options?: Omit<ToastOptions, "variant">) => void;
  dismiss: () => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function useAppToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useAppToast must be used within ToastProvider");
  return ctx;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [current, setCurrent] = useState<ToastState | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const liveId = useId();

  const dismiss = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setCurrent(null);
  }, []);

  const toast = useCallback(
    (message: string, options?: ToastOptions) => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      const id = crypto.randomUUID();
      const duration =
        options?.duration ??
        (options?.action || options?.cancel ? Number.POSITIVE_INFINITY : 5000);

      setCurrent({ id, message, ...options });

      if (Number.isFinite(duration) && duration > 0) {
        timerRef.current = setTimeout(dismiss, duration as number);
      }
    },
    [dismiss]
  );

  const success = useCallback(
    (message: string, options?: Omit<ToastOptions, "variant">) => toast(message, { ...options, variant: "success" }),
    [toast]
  );

  const error = useCallback(
    (message: string, options?: Omit<ToastOptions, "variant">) =>
      toast(message, { ...options, variant: "error", duration: options?.duration ?? 6500 }),
    [toast]
  );

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    []
  );

  const shellClass =
    "flex w-full flex-col gap-3 rounded-2xl border p-4 shadow-2xl backdrop-blur-md ring-1 ring-black/5 dark:ring-white/10";

  const palette =
    current?.variant === "error"
      ? "border-rose-200/80 bg-rose-50/95 text-rose-950 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-100"
      : current?.variant === "success"
        ? "border-emerald-200/80 bg-emerald-50/95 text-emerald-950 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-100"
        : current?.variant === "warning"
          ? "border-amber-200/80 bg-amber-50/95 text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100"
          : "border-slate-200/80 bg-white/95 text-navy-950 dark:border-white/10 dark:bg-navy-900/95 dark:text-white";

  return (
    <ToastContext.Provider value={{ toast, success, error, dismiss }}>
      {children}
      {current ? (
        <div
          className="animate-fade-in fixed bottom-6 left-1/2 z-[200] flex w-[calc(100vw-2rem)] max-w-md -translate-x-1/2"
          style={{ animationDuration: "0.2s" }}
          role="status"
          aria-live="polite"
          aria-labelledby={`${liveId}-toast-title`}
          id={`${liveId}-toast`}
        >
          <div className={`${shellClass} ${palette}`}>
            <div id={`${liveId}-toast-title`} className="text-sm font-bold leading-snug">
              {current.message}
            </div>
            {current.description ? (
              <div className="text-sm leading-relaxed opacity-90">{current.description}</div>
            ) : null}
            {current.action || current.cancel ? (
              <div className="flex flex-wrap justify-end gap-2 pt-1">
                {current.cancel ? (
                  <button
                    type="button"
                    className="rounded-xl border border-slate-200/90 bg-white/80 px-3 py-2 text-xs font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-white/15 dark:bg-navy-800/80 dark:text-slate-200 dark:hover:bg-navy-800"
                    onClick={() => {
                      current.cancel?.onClick?.();
                      dismiss();
                    }}
                  >
                    {current.cancel.label}
                  </button>
                ) : null}
                {current.action ? (
                  <button
                    type="button"
                    className="rounded-xl bg-brand-600 px-3 py-2 text-xs font-bold text-white shadow-md shadow-brand-600/25 transition hover:bg-brand-500"
                    onClick={() => {
                      const fn = current.action?.onClick;
                      dismiss();
                      queueMicrotask(() => fn?.());
                    }}
                  >
                    {current.action.label}
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </ToastContext.Provider>
  );
}
