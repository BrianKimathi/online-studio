import React, { useRef, useState, useEffect, useCallback } from 'react';
import { usePianoRollStore } from '../../stores/usePianoRollStore';
import { useTransportStore } from '../../stores/useTransportStore';
import { AudioEngine } from '../../audio/engine';
import { Note } from '../../types';
import { Trash2, Activity } from 'lucide-react';

// Semitone keys across 3 octaves (C3 to B5) — top to bottom
const PITCHES = [
  'B5', 'A#5', 'A5', 'G#5', 'G5', 'F#5', 'F5', 'E5', 'D#5', 'D5', 'C#5', 'C5',
  'B4', 'A#4', 'A4', 'G#4', 'G4', 'F#4', 'F4', 'E4', 'D#4', 'D4', 'C#4', 'C4',
  'B3', 'A#3', 'A3', 'G#3', 'G3', 'F#3', 'F3', 'E3', 'D#3', 'D3', 'C#3', 'C3'
];

const isBlackKey = (pitchName: string) => pitchName.replace(/\d/, '').includes('#');

const SNAP_TO_COLS: Record<string, number> = {
  '16n': 1,
  '8n': 2,
  '4n': 4,
  '32n': 1,
  off: 1,
};

type DragState =
  | { kind: 'move'; noteId: string; startCol: number; startRow: number; origTime: number; origPitchIdx: number }
  | { kind: 'resize'; noteId: string; startCol: number; origDuration: number }
  | { kind: 'velocity'; noteId: string; startY: number; origVelocity: number }
  | null;

export const PianoRoll: React.FC = () => {
  const {
    notes,
    addNote,
    removeNote,
    updateNote,
    snapValue,
    setSnapValue,
    clearNotes
  } = usePianoRollStore();

  const { activeStep, loopLength, bpm } = useTransportStore();
  const gridContainerRef = useRef<HTMLDivElement>(null);

  const rowHeight = 24;
  const colWidth = 32;
  const totalSteps = loopLength * 16;
  const velocityLaneHeight = 64;

  const stepDuration = 60 / bpm / 4;
  const snapCols = SNAP_TO_COLS[snapValue] ?? 1;

  const [drag, setDrag] = useState<DragState>(null);

  const snapCol = useCallback((col: number) => Math.max(0, Math.round(col / snapCols) * snapCols), [snapCols]);

  // ── Add note on empty grid click ──────────────────────────────
  const handleGridClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (drag) return;
    if (e.button !== 0) return;
    if (!gridContainerRef.current) return;
    const rect = gridContainerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const colIndex = snapCol(Math.floor(x / colWidth));
    const rowIndex = Math.floor(y / rowHeight);
    if (colIndex < 0 || colIndex >= totalSteps || rowIndex < 0 || rowIndex >= PITCHES.length) return;

    const pitch = PITCHES[rowIndex];
    const noteTime = colIndex * stepDuration;

    const existing = notes.find((n) => {
      const nc = Math.round(n.time / stepDuration);
      return n.pitch === pitch && nc === colIndex;
    });
    if (existing) {
      removeNote(existing.id);
    } else {
      addNote({ pitch, time: noteTime, duration: stepDuration * snapCols, velocity: 0.8 });
      AudioEngine.playSynthNote(pitch, '16n');
    }
  };

  // ── Note body: start a move drag (or delete on right-click) ────
  const onNotePointerDown = (e: React.PointerEvent, note: Note) => {
    if (e.button === 2) return; // right-click handled by onContextMenu
    e.stopPropagation();
    const rect = gridContainerRef.current!.getBoundingClientRect();
    const startCol = Math.round((e.clientX - rect.left) / colWidth);
    const startRow = Math.floor((e.clientY - rect.top) / rowHeight);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setDrag({
      kind: 'move',
      noteId: note.id,
      startCol,
      startRow,
      origTime: note.time,
      origPitchIdx: PITCHES.indexOf(note.pitch),
    });
  };

  // ── Resize handle (right edge) ────────────────────────────────
  const onResizePointerDown = (e: React.PointerEvent, note: Note) => {
    e.stopPropagation();
    const rect = gridContainerRef.current!.getBoundingClientRect();
    const startCol = Math.round((e.clientX - rect.left) / colWidth);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setDrag({
      kind: 'resize',
      noteId: note.id,
      startCol,
      origDuration: note.duration,
    });
  };

  // ── Velocity handle drag ──────────────────────────────────────
  const onVelocityPointerDown = (e: React.PointerEvent, note: Note) => {
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setDrag({
      kind: 'velocity',
      noteId: note.id,
      startY: e.clientY,
      origVelocity: note.velocity,
    });
  };

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!drag || !gridContainerRef.current) return;
      const rect = gridContainerRef.current.getBoundingClientRect();

      if (drag.kind === 'move') {
        const curCol = Math.round((e.clientX - rect.left) / colWidth);
        const curRow = Math.floor((e.clientY - rect.top) / rowHeight);
        const dCol = curCol - drag.startCol;
        const dRow = curRow - drag.startRow;
        const newCol = snapCol(Math.round(drag.origTime / stepDuration) + dCol);
        const newRow = drag.origPitchIdx + dRow;
        if (newRow < 0 || newRow >= PITCHES.length) return;
        const newPitch = PITCHES[newRow];
        const newTime = newCol * stepDuration;
        updateNote(drag.noteId, { pitch: newPitch, time: newTime });
      } else if (drag.kind === 'resize') {
        const curCol = Math.round((e.clientX - rect.left) / colWidth);
        const dCols = curCol - drag.startCol;
        const origCols = Math.max(1, Math.round(drag.origDuration / stepDuration));
        const newCols = Math.max(snapCols, snapCol(origCols + dCols));
        updateNote(drag.noteId, { duration: newCols * stepDuration });
      } else if (drag.kind === 'velocity') {
        const deltaY = drag.startY - e.clientY; // up = louder
        const v = Math.max(0.1, Math.min(1, drag.origVelocity + deltaY / 80));
        updateNote(drag.noteId, { velocity: v });
      }
    },
    [drag, colWidth, rowHeight, snapCols, stepDuration, updateNote, snapCol]
  );

  const endDrag = (e: React.PointerEvent) => {
    if (drag) {
      // Preview pitch after a move
      if (drag.kind === 'move') {
        const moved = notes.find((n) => n.id === drag.noteId);
        if (moved) AudioEngine.playSynthNote(moved.pitch, '16n');
      }
      try { (e.target as HTMLElement).releasePointerCapture(e.pointerId); } catch { /* noop */ }
      setDrag(null);
    }
  };

  // Prevent default context menu so right-click delete works cleanly
  useEffect(() => {
    const el = gridContainerRef.current;
    if (!el) return;
    const prevent = (e: Event) => e.preventDefault();
    el.addEventListener('contextmenu', prevent);
    return () => el.removeEventListener('contextmenu', prevent);
  }, []);

  return (
    <div className="h-full w-full bg-[#090e18] p-4 flex flex-col overflow-hidden select-none">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#0c1221] border border-slate-900 rounded-xl p-3 mb-4 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Quantize:</span>
          <select
            value={snapValue}
            onChange={(e) => setSnapValue(e.target.value)}
            className="bg-slate-900 border border-slate-800 text-xs font-semibold px-2 py-1 rounded focus:outline-none cursor-pointer"
          >
            <option value="16n">1/16 Grid</option>
            <option value="8n">1/8 Grid</option>
            <option value="4n">1/4 Grid</option>
          </select>
        </div>
        <div className="flex items-center gap-3 text-[9px] text-slate-500">
          <span><span className="text-slate-300 font-semibold">Click</span> add</span>
          <span><span className="text-slate-300 font-semibold">Drag</span> move</span>
          <span><span className="text-slate-300 font-semibold">Right-edge</span> resize</span>
          <span><span className="text-slate-300 font-semibold">Right-click</span> delete</span>
        </div>
        <button
          onClick={clearNotes}
          className="flex items-center gap-1 px-3 py-1 bg-slate-900 hover:bg-slate-850 active:bg-slate-950 border border-slate-800 rounded-lg text-xs font-bold text-slate-400 hover:text-white cursor-pointer transition-colors"
        >
          <Trash2 className="h-3.5 w-3.5" /> Clear
        </button>
      </div>

      {/* Workspace Splitter */}
      <div className="flex-1 flex overflow-hidden border border-slate-900 rounded-2xl bg-[#0b101c]/40 relative">
        {/* Piano Keys */}
        <div className="w-16 flex flex-col bg-[#0d1322] border-r border-slate-900 select-none shrink-0 overflow-y-hidden z-20 shadow-md">
          {PITCHES.map((pitch) => {
            const black = isBlackKey(pitch);
            return (
              <button
                key={pitch}
                onClick={() => AudioEngine.playSynthNote(pitch, '4n')}
                className={`w-full flex items-center justify-between px-2 text-[9px] font-black tracking-tighter leading-none border-b border-slate-900/60 cursor-pointer transition-colors ${
                  black ? 'bg-slate-950 hover:bg-slate-900 text-slate-400' : 'bg-slate-200 hover:bg-white text-slate-800'
                }`}
                style={{ height: `${rowHeight}px` }}
              >
                <span>{pitch}</span>
                <div className={`h-1.5 w-1.5 rounded-full ${black ? 'bg-slate-800' : 'bg-slate-400'}`} />
              </button>
            );
          })}
        </div>

        {/* Grid + Velocity lane (scrollable) */}
        <div className="flex-1 overflow-auto relative flex flex-col">
          {/* Playhead */}
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-indigo-500 led-blue pointer-events-none z-10 transition-all duration-100"
            style={{ left: `${(activeStep % totalSteps) * colWidth}px` }}
          />

          <div
            ref={gridContainerRef}
            onClick={handleGridClick}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            className="relative bg-slate-950/20 shrink-0"
            style={{
              width: `${totalSteps * colWidth}px`,
              height: `${PITCHES.length * rowHeight}px`,
              backgroundImage:
                'linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)',
              backgroundSize: `${colWidth}px ${rowHeight}px`,
            }}
          >
            {/* Octave separator shading for C rows */}
            {PITCHES.map((p, i) =>
              p.startsWith('C') ? (
                <div
                  key={`sep-${p}`}
                  className="absolute left-0 right-0 border-t border-slate-800/60 pointer-events-none"
                  style={{ top: `${i * rowHeight}px` }}
                />
              ) : null
            )}

            {/* Notes */}
            {notes.map((note) => {
              const colIdx = Math.round(note.time / stepDuration);
              const rowIdx = PITCHES.indexOf(note.pitch);
              if (rowIdx === -1) return null;
              const noteLeft = colIdx * colWidth;
              const noteWidth = Math.max(1, Math.round(note.duration / stepDuration)) * colWidth;
              const noteTop = rowIdx * rowHeight;

              return (
                <div
                  key={note.id}
                  onPointerDown={(e) => onNotePointerDown(e, note)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    removeNote(note.id);
                  }}
                  className="absolute rounded-md bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 border border-sky-400/80 shadow-md shadow-indigo-900/20 flex items-center justify-between px-1 text-[8px] font-black text-white overflow-hidden cursor-move"
                  style={{
                    left: `${noteLeft + 1}px`,
                    top: `${noteTop + 1}px`,
                    width: `${Math.max(noteWidth - 2, 6)}px`,
                    height: `${rowHeight - 2}px`,
                    opacity: 0.4 + note.velocity * 0.6,
                  }}
                  title={`${note.pitch} · drag to move · right-click to delete`}
                >
                  <span className="truncate pointer-events-none">{note.pitch}</span>
                  {/* Resize handle */}
                  <div
                    onPointerDown={(e) => onResizePointerDown(e, note)}
                    className="absolute right-0 top-0 bottom-0 w-1.5 bg-white/30 hover:bg-white/60 cursor-ew-resize"
                    title="Drag to resize"
                  />
                </div>
              );
            })}
          </div>

          {/* Velocity lane */}
          <div
            className="border-t border-slate-900 bg-[#0a0f1d] relative shrink-0"
            style={{ width: `${totalSteps * colWidth}px`, height: `${velocityLaneHeight}px` }}
          >
            <div className="absolute top-1 left-2 text-[9px] font-bold text-slate-600 uppercase tracking-widest pointer-events-none">
              Velocity
            </div>
            {notes.map((note) => {
              const colIdx = Math.round(note.time / stepDuration);
              const left = colIdx * colWidth;
              const barH = Math.max(3, note.velocity * (velocityLaneHeight - 8));
              return (
                <div
                  key={`vel-${note.id}`}
                  onPointerDown={(e) => onVelocityPointerDown(e, note)}
                  className="absolute bottom-0 flex flex-col items-center justify-end cursor-ns-resize group"
                  style={{ left: `${left + 1}px`, width: `${colWidth - 2}px`, height: `${velocityLaneHeight}px` }}
                  title={`Velocity ${Math.round(note.velocity * 100)}%`}
                >
                  <div
                    className="w-full rounded-t-sm bg-gradient-to-t from-indigo-600 to-sky-400 group-hover:from-indigo-500 group-hover:to-sky-300 transition-colors"
                    style={{ height: `${barH}px` }}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1.5 text-[10px] text-slate-500 mt-3 shrink-0">
        <Activity className="h-3.5 w-3.5 text-indigo-500" />
        <span>
          Click empty cells to draw · drag notes to move · drag the right edge to resize · drag velocity bars to set loudness.
        </span>
      </div>
    </div>
  );
};
