export type ToastType = "info" | "success" | "error" | "warning";

export interface ToastPayload {
  message: string;
  type?: ToastType;
  duration?: number;
}

type ToastListener = (toast: ToastPayload) => void;

const listeners = new Set<ToastListener>();

export const subscribeToToasts = (listener: ToastListener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const showToast = (
  message: string,
  type: ToastType = "info",
  duration?: number
) => {
  const payload: ToastPayload = { message, type, duration };
  for (const listener of listeners) {
    listener(payload);
  }
};

