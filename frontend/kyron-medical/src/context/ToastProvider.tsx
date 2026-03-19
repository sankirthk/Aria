import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  subscribeToToasts,
  type ToastPayload,
} from "../utils/toastService";
import "../styles/Toast.css";

interface ActiveToast extends ToastPayload {
  id: number;
}

const DEFAULT_DURATION = 3500;

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [toasts, setToasts] = useState<ActiveToast[]>([]);

  useEffect(() => {
    return subscribeToToasts((toast) => {
      setToasts((prev) => [
        ...prev,
        {
          ...toast,
          id: Date.now() + Math.random(),
        },
      ]);
    });
  }, []);

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  useEffect(() => {
    if (!toasts.length) return;

    const timers = toasts.map((toast) =>
      setTimeout(
        () => removeToast(toast.id),
        toast.duration ?? DEFAULT_DURATION
      )
    );

    return () => {
      for (const timer of timers) clearTimeout(timer);
    };
  }, [toasts, removeToast]);

  const renderedToasts = useMemo(
    () =>
      toasts.map((toast) => (
        <div
          key={toast.id}
          role="status"
          className={`toast toast-${toast.type ?? "info"}`}
          onClick={() => removeToast(toast.id)}
        >
          {toast.message}
        </div>
      )),
    [toasts, removeToast]
  );

  return (
    <>
      {children}
      <div className="toast-container">{renderedToasts}</div>
    </>
  );
};

