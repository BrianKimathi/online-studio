import { create } from 'zustand';

export type WindowKind =
  | 'piano-roll'
  | 'mixer'
  | 'drums'
  | 'sequencer'
  | 'timeline'
  | 'voice-editor';

export interface WindowState {
  id: string;
  kind: WindowKind;
  title: string;
  x: number;
  y: number;
  width: number;
  height: number;
  z: number;
  minimized: boolean;
  maximized: boolean;
  // optional payload, e.g. trackId for piano-roll windows
  trackId?: string;
  // cached geometry to restore from maximized
  prev?: { x: number; y: number; width: number; height: number };
}

interface WindowManagerState {
  windows: WindowState[];
  topZ: number;
  activeId: string | null;

  openWindow: (opts: {
    kind: WindowKind;
    title: string;
    trackId?: string;
    width?: number;
    height?: number;
  }) => string;
  closeWindow: (id: string) => void;
  focusWindow: (id: string) => void;
  moveWindow: (id: string, x: number, y: number) => void;
  resizeWindow: (id: string, width: number, height: number) => void;
  setMinimized: (id: string, minimized: boolean) => void;
  toggleMaximized: (id: string) => void;
  closeAll: (kind?: WindowKind) => void;
}

const uid = () => `win-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

const DEFAULT_SIZE: Record<WindowKind, { width: number; height: number }> = {
  'piano-roll': { width: 760, height: 480 },
  mixer: { width: 720, height: 420 },
  drums: { width: 640, height: 480 },
  sequencer: { width: 720, height: 360 },
  timeline: { width: 800, height: 360 },
  'voice-editor': { width: 640, height: 480 },
};

export const useWindowStore = create<WindowManagerState>((set, get) => ({
  windows: [],
  topZ: 10,
  activeId: null,

  openWindow: ({ kind, title, trackId, width, height }) => {
    const state = get();
    // If a window with the same kind+trackId exists, just focus it.
    const existing = state.windows.find(
      (w) => w.kind === kind && (kind !== 'piano-roll' || w.trackId === trackId)
    );
    if (existing) {
      get().focusWindow(existing.id);
      if (existing.minimized) get().setMinimized(existing.id, false);
      return existing.id;
    }

    const id = uid();
    const size = { width: width ?? DEFAULT_SIZE[kind].width, height: height ?? DEFAULT_SIZE[kind].height };
    const z = state.topZ + 1;
    // Cascade new windows so they don't perfectly overlap.
    const offset = (state.windows.length % 6) * 28;
    const win: WindowState = {
      id,
      kind,
      title,
      x: 80 + offset,
      y: 60 + offset,
      ...size,
      z,
      minimized: false,
      maximized: false,
      trackId,
    };
    set({ windows: [...state.windows, win], topZ: z, activeId: id });
    return id;
  },

  closeWindow: (id) =>
    set((s) => ({ windows: s.windows.filter((w) => w.id !== id) })),

  focusWindow: (id) =>
    set((s) => {
      const z = s.topZ + 1;
      return {
        topZ: z,
        activeId: id,
        windows: s.windows.map((w) => (w.id === id ? { ...w, z } : w)),
      };
    }),

  moveWindow: (id, x, y) =>
    set((s) => ({
      windows: s.windows.map((w) => (w.id === id ? { ...w, x, y } : w)),
    })),

  resizeWindow: (id, width, height) =>
    set((s) => ({
      windows: s.windows.map((w) =>
        w.id === id ? { ...w, width, height } : w
      ),
    })),

  setMinimized: (id, minimized) =>
    set((s) => ({
      windows: s.windows.map((w) => (w.id === id ? { ...w, minimized } : w)),
    })),

  toggleMaximized: (id) =>
    set((s) => ({
      windows: s.windows.map((w) => {
        if (w.id !== id) return w;
        if (w.maximized && w.prev) {
          return { ...w, maximized: false, ...w.prev, prev: undefined };
        }
        return {
          ...w,
          maximized: true,
          prev: { x: w.x, y: w.y, width: w.width, height: w.height },
        };
      }),
    })),

  closeAll: (kind) =>
    set((s) => ({
      windows: kind
        ? s.windows.filter((w) => w.kind !== kind)
        : [],
      activeId: null,
    })),
}));
