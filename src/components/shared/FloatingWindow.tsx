import React, { useCallback, useRef, useEffect } from 'react';
import { X, Minus, Square, Copy } from 'lucide-react';
import { useWindowStore, WindowState } from '../../stores/useWindowStore';

interface FloatingWindowProps {
  win: WindowState;
  children: React.ReactNode;
  accentColor?: string;
  onActivate?: () => void;
}

type DragMode =
  | { kind: 'move'; offsetX: number; offsetY: number }
  | { kind: 'resize'; startX: number; startY: number; startW: number; startH: number }
  | null;

export const FloatingWindow: React.FC<FloatingWindowProps> = ({
  win,
  children,
  accentColor = '#6366f1',
  onActivate,
}) => {
  const { focusWindow, closeWindow, moveWindow, resizeWindow, toggleMaximized, setMinimized } = useWindowStore();
  const dragRef = useRef<DragMode>(null);

  const onTitlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      if (win.maximized) return; // no dragging while maximized
      focusWindow(win.id);
      const offsetX = e.clientX - win.x;
      const offsetY = e.clientY - win.y;
      dragRef.current = { kind: 'move', offsetX, offsetY };
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [focusWindow, win.id, win.x, win.y, win.maximized]
  );

  const onResizePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      e.stopPropagation();
      focusWindow(win.id);
      dragRef.current = {
        kind: 'resize',
        startX: e.clientX,
        startY: e.clientY,
        startW: win.width,
        startH: win.height,
      };
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [focusWindow, win.id, win.width, win.height]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      if (d.kind === 'move') {
        const nx = e.clientX - d.offsetX;
        const ny = e.clientY - d.offsetY;
        // keep title bar within reach
        const minY = 0;
        moveWindow(win.id, Math.max(-win.width + 80, nx), Math.max(minY, ny));
      } else if (d.kind === 'resize') {
        const nw = Math.max(360, d.startW + (e.clientX - d.startX));
        const nh = Math.max(240, d.startH + (e.clientY - d.startY));
        resizeWindow(win.id, nw, nh);
      }
    },
    [moveWindow, resizeWindow, win.id, win.width]
  );

  const endDrag = useCallback(
    (e: React.PointerEvent) => {
      if (dragRef.current) {
        try { (e.target as HTMLElement).releasePointerCapture(e.pointerId); } catch { /* noop */ }
        dragRef.current = null;
      }
    },
    []
  );

  useEffect(() => {
    const prevent = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && dragRef.current) {
        dragRef.current = null;
      }
    };
    window.addEventListener('keydown', prevent);
    return () => window.removeEventListener('keydown', prevent);
  }, []);

  if (win.minimized) return null;

  const style: React.CSSProperties = win.maximized
    ? { left: 0, top: 0, width: '100%', height: '100%', zIndex: win.z }
    : {
        left: win.x,
        top: win.y,
        width: win.width,
        height: win.height,
        zIndex: win.z,
      };

  return (
    <div
      className={`absolute flex flex-col bg-[#0a0f1d] border rounded-xl shadow-2xl shadow-black/60 overflow-hidden ${
        win.maximized ? 'rounded-none border-0' : 'border-slate-700/70'
      }`}
      style={style}
      onPointerDown={() => {
        focusWindow(win.id);
        onActivate?.();
      }}
    >
      {/* Title bar */}
      <div
        onPointerDown={onTitlePointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onDoubleClick={() => toggleMaximized(win.id)}
        className="h-9 shrink-0 flex items-center justify-between px-2 cursor-grab active:cursor-grabbing select-none border-b border-slate-800"
        style={{
          background: `linear-gradient(90deg, ${accentColor}22, transparent)`,
        }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="h-2 w-2 rounded-full shrink-0"
            style={{ backgroundColor: accentColor, boxShadow: `0 0 6px ${accentColor}` }}
          />
          <span className="text-xs font-bold text-slate-200 truncate">{win.title}</span>
        </div>
        <div className="flex items-center gap-0.5">
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => setMinimized(win.id, true)}
            className="p-1 rounded hover:bg-slate-700/60 text-slate-400 hover:text-white cursor-pointer"
            title="Minimize"
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => toggleMaximized(win.id)}
            className="p-1 rounded hover:bg-slate-700/60 text-slate-400 hover:text-white cursor-pointer"
            title="Maximize"
          >
            {win.maximized ? <Copy className="h-3 w-3" /> : <Square className="h-3 w-3" />}
          </button>
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => closeWindow(win.id)}
            className="p-1 rounded hover:bg-red-600/80 text-slate-400 hover:text-white cursor-pointer"
            title="Close"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-hidden bg-[#090e18] relative">
        {children}
      </div>

      {/* Resize handle */}
      {!win.maximized && (
        <div
          onPointerDown={onResizePointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          className="absolute bottom-0 right-0 h-4 w-4 cursor-nwse-resize"
          style={{
            background:
              'linear-gradient(135deg, transparent 50%, rgba(148,163,184,0.4) 50%)',
          }}
          title="Drag to resize"
        />
      )}
    </div>
  );
};
