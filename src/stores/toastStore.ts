import { create } from "zustand";

export type ToastVariant = "success" | "error" | "warning" | "info";

export interface ToastItem {
  id: string;
  variant: ToastVariant;
  title: string;
  body?: string;
  /** ms until auto-dismiss; 0 = never */
  duration: number;
}

interface ToastState {
  items: ToastItem[];
  push: (t: Omit<ToastItem, "id">) => void;
  dismiss: (id: string) => void;
}

export const useToastStore = create<ToastState>((set) => ({
  items: [],

  push(t) {
    const id = Math.random().toString(36).slice(2, 10);
    const item: ToastItem = { ...t, id, duration: t.duration ?? 4500 };
    set((s) => ({ items: [...s.items, item] }));
    if (item.duration > 0) {
      setTimeout(
        () => set((s) => ({ items: s.items.filter((x) => x.id !== id) })),
        item.duration,
      );
    }
  },

  dismiss(id) {
    set((s) => ({ items: s.items.filter((x) => x.id !== id) }));
  },
}));

// Callable outside React components (e.g. from Zustand stores)
export const toast = {
  success: (title: string, body?: string) =>
    useToastStore.getState().push({ variant: "success", title, body, duration: 4500 }),
  error: (title: string, body?: string) =>
    useToastStore.getState().push({ variant: "error", title, body, duration: 6000 }),
  warning: (title: string, body?: string) =>
    useToastStore.getState().push({ variant: "warning", title, body, duration: 5000 }),
  info: (title: string, body?: string) =>
    useToastStore.getState().push({ variant: "info", title, body, duration: 4000 }),
};
