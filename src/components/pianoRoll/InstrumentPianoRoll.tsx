import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useInstrumentsStore } from '../../stores/useInstrumentsStore';
import { useTransportStore } from '../../stores/useTransportStore';
import { AudioEngine } from '../../audio/engine';
import { Note } from '../../types';
import { Trash2, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import { INSTRUMENT_PRESETS, ALL_INSTRUMENT_PRESETS, InstrumentPresetId } from '../../audio/instrumentPresets';

// Semitone keys across 3 octaves (C3 to B5) — top to bottom
const PITCHES = [
  'B5', 'A#5', 'A5', 'G#5', 'G5', 'F#5', 'F5', 'E5', 'D#5', 'D5', 'C#5', 'C5',
  'B4', 'A#4', 'A4', 'G#4', 'G4', 'F#4', 'F4', 'E4', 'D#4', 'D4', 'C#4', 'C4',
  'B3', 'A#3', 'A3', 'G#3', 'G3', 'F#3', 'F3', 'E3', 'D#3', 'D3', 'C#3', 'C3'
];

const isBlackKey = (pitchName: string) => pitchName.replace(/\d/, '').includes('#');

const SNAP_TO_COLS: Record<string, number> = {
  '16n': 1, '8n': 2, '4n': 4, '32n': 1, off: 1,
};

// Zoom limits
const MIN_COL = 14, MAX_COL = 72;
const MIN_ROW = 12, MAX_ROW = 44;
const DEFAULT_COL = 30, DEFAULT_ROW = 22;

type DragState =
  | { kind: 'move'; noteId: string; startCol: number; startRow: number; origTime: number; origPitchIdx: number }
  | { kind: 'resize'; noteId: string; startCol: number; origDuration: number }
  | { kind: 'velocity'; noteId: string; startY: number; origVelocity: number }
  | null;

interface Props {
  trackId: string;
}

export const InstrumentPianoRoll: React.FC<Props> = ({ trackId }) => {
  const tracks = useInstrumentsStore((s) => s.tracks);
  const addNote = useInstrumentsStore((s) => s.addNote);
  const removeNote = useInstrumentsStore((s) => s.removeNote);
  const updateNote = useInstrumentsStore((s) => s.updateNote);
  const clearNotes = useInstrumentsStore((s) => s.clearNotes);
  const setTrackPreset = useInstrumentsStore((s) => s.setTrackPreset);

  const track = tracks.find((t) => t.id === trackId);
  const { activeStep, loopLength, bpm } = useTransportStore();
  const scrollRef = useRef<HTMLDivElement>(null);
  const gridContainerRef = useRef<HTMLDivElement>(null);

  const [snapValue, setSnapValue] = useState('16n');
  const [drag, setDrag] = useState<DragState>(null);
  const [colWidth, setColWidth] = useState(DEFAULT_COL);
  const [rowHeight, setRowHeight] = useState(DEFAULT_ROW);

  const totalSteps = loopLength * 16;
  const velocityLaneHeight = 56;
  const keysWidth = 52;

  const stepDuration = 60 / bpm / 4;
  const snapCols = SNAP_TO_COLS[snapValue] ?? 1;

  const notes = track?.notes ?? [];
  const accent = track?.color ?? '#6366f1';

  // Ensure the audio engine has a synth for this track + preset/sample.
  useEffect(() => {
    if (!track) return;
    AudioEngine.ensureInstrumentSynth(track.id, track.presetId, track.sampleUrl);
  }, [track?.id, track?.presetId, track?.sampleUrl]);

  const snapCol = useCallback((col: number) => Math.max(0, Math.round(col / snapCols) * snapCols), [snapCols]);

  const handleGridClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (drag || e.button !== 0 || !gridContainerRef.current || !track) return;
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
      removeNote(track.id, existing.id);
    } else {
      addNote(track.id, { pitch, time: noteTime, duration: stepDuration * snapCols, velocity: 0.8 });
      AudioEngine.playInstrumentNote(track.id, pitch, '16n');
    }
  };

  const onNotePointerDown = (e: React.PointerEvent, note: Note) => {
    if (e.button === 2 || !gridContainerRef.current || !track) return;
    e.stopPropagation();
    const rect = gridContainerRef.current.getBoundingClientRect();
    const startCol = Math.round((e.clientX - rect.left) / colWidth);
    const startRow = Math.floor((e.clientY - rect.top) / rowHeight);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setDrag({ kind: 'move', noteId: note.id, startCol, startRow, origTime: note.time, origPitchIdx: PITCHES.indexOf(note.pitch) });
  };

  const onResizePointerDown = (e: React.PointerEvent, note: Note) => {
    if (!gridContainerRef.current || !track) return;
    e.stopPropagation();
    const rect = gridContainerRef.current.getBoundingClientRect();
    const startCol = Math.round((e.clientX - rect.left) / colWidth);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setDrag({ kind: 'resize', noteId: note.id, startCol, origDuration: note.duration });
  };

  const onVelocityPointerDown = (e: React.PointerEvent, note: Note) => {
    if (!track) return;
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setDrag({ kind: 'velocity', noteId: note.id, startY: e.clientY, origVelocity: note.velocity });
  };

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!drag || !gridContainerRef.current || !track) return;
      const rect = gridContainerRef.current.getBoundingClientRect();
      if (drag.kind === 'move') {
        const curCol = Math.round((e.clientX - rect.left) / colWidth);
        const curRow = Math.floor((e.clientY - rect.top) / rowHeight);
        const newCol = snapCol(Math.round(drag.origTime / stepDuration) + (curCol - drag.startCol));
        const newRow = drag.origPitchIdx + (curRow - drag.startRow);
        if (newRow < 0 || newRow >= PITCHES.length) return;
        updateNote(track.id, drag.noteId, { pitch: PITCHES[newRow], time: newCol * stepDuration });
      } else if (drag.kind === 'resize') {
        const dCols = Math.round((e.clientX - rect.left) / colWidth) - drag.startCol;
        const origCols = Math.max(1, Math.round(drag.origDuration / stepDuration));
        const newCols = Math.max(snapCols, snapCol(origCols + dCols));
        updateNote(track.id, drag.noteId, { duration: newCols * stepDuration });
      } else if (drag.kind === 'velocity') {
        const v = Math.max(0.1, Math.min(1, drag.origVelocity + (drag.startY - e.clientY) / 80));
        updateNote(track.id, drag.noteId, { velocity: v });
      }
    },
    [drag, colWidth, rowHeight, snapCols, stepDuration, updateNote, snapCol, track]
  );

  const endDrag = (e: React.PointerEvent) => {
    if (drag && track) {
      if (drag.kind === 'move') {
        const moved = notes.find((n) => n.id === drag.noteId);
        if (moved) AudioEngine.playInstrumentNote(track.id, moved.pitch, '16n');
      }
      try { (e.target as HTMLElement).releasePointerCapture(e.pointerId); } catch { /* noop */ }
      setDrag(null);
    }
  };

  useEffect(() => {
    const el = gridContainerRef.current;
    if (!el) return;
    const prevent = (e: Event) => e.preventDefault();
    el.addEventListener('contextmenu', prevent);
    return () => el.removeEventListener('contextmenu', prevent);
  }, []);

  const zoomIn = () => {
    setColWidth((c) => Math.min(MAX_COL, c + 6));
    setRowHeight((r) => Math.min(MAX_ROW, r + 3));
  };
  const zoomOut = () => {
    setColWidth((c) => Math.max(MIN_COL, c - 6));
    setRowHeight((r) => Math.max(MIN_ROW, r - 3));
  };
  const zoomReset = () => {
    setColWidth(DEFAULT_COL);
    setRowHeight(DEFAULT_ROW);
  };

  if (!track) {
    return (
      <div className="h-full w-full flex items-center justify-center text-slate-500 text-sm">
        Track not found.
      </div>
    );
  }

  const gridWidth = totalSteps * colWidth;
  const gridHeight = PITCHES.length * rowHeight;

  return (
    <div className="h-full w-full bg-[#090e18] p-3 flex flex-col overflow-hidden select-none">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-[#0c1221] border border-slate-900 rounded-lg p-2 mb-2 shrink-0">
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full" style={{ backgroundColor: accent }} />
          <span className="text-xs font-bold text-slate-200">{track.name}</span>
          {track.sampleName && (
            <span className="text-[9px] font-semibold text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 px-1.5 py-0.5 rounded-full truncate max-w-[120px]" title={track.sampleName}>
              🎧 {track.sampleName}
            </span>
          )}
          {!track.sampleUrl && (
            <select
              value={track.presetId}
              onChange={(e) => {
                const presetId = e.target.value as InstrumentPresetId;
                setTrackPreset(track.id, presetId);
                AudioEngine.ensureInstrumentSynth(track.id, presetId);
              }}
              className="bg-slate-900 border border-slate-800 text-[10px] font-semibold px-1.5 py-1 rounded focus:outline-none cursor-pointer"
              title="Instrument preset"
            >
              {ALL_INSTRUMENT_PRESETS.map((pid) => (
                <option key={pid} value={pid}>{INSTRUMENT_PRESETS[pid].name}</option>
              ))}
            </select>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-bold text-slate-500 uppercase">Snap</span>
          <select
            value={snapValue}
            onChange={(e) => setSnapValue(e.target.value)}
            className="bg-slate-900 border border-slate-800 text-[10px] font-semibold px-1.5 py-1 rounded focus:outline-none cursor-pointer"
          >
            <option value="16n">1/16</option>
            <option value="8n">1/8</option>
            <option value="4n">1/4</option>
          </select>
          <div className="flex items-center gap-0.5 bg-slate-900 border border-slate-800 rounded">
            <button onClick={zoomOut} disabled={colWidth <= MIN_COL} className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed" title="Zoom out">
              <ZoomOut className="h-3 w-3" />
            </button>
            <button onClick={zoomReset} className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer" title="Reset zoom">
              <Maximize2 className="h-3 w-3" />
            </button>
            <button onClick={zoomIn} disabled={colWidth >= MAX_COL} className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed" title="Zoom in">
              <ZoomIn className="h-3 w-3" />
            </button>
          </div>
          <button
            onClick={() => clearNotes(track.id)}
            className="flex items-center gap-1 px-2 py-1 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded text-[10px] font-bold text-slate-400 hover:text-white cursor-pointer"
          >
            <Trash2 className="h-3 w-3" /> Clear
          </button>
        </div>
      </div>

      {/* Workspace: single scroll container so piano keys stay aligned vertically */}
      <div className="flex-1 flex overflow-hidden border border-slate-900 rounded-lg bg-[#0b101c]/40 relative">
        <div
          ref={scrollRef}
          className="flex-1 overflow-auto relative"
        >
          <div className="flex">
            {/* Piano keys — sticky left so they stay visible on horizontal scroll,
                but scroll vertically in sync with the grid so keys match rows. */}
            <div
              className="sticky left-0 z-20 shrink-0 bg-[#0d1322] border-r border-slate-900"
              style={{ width: `${keysWidth}px`, height: `${gridHeight}px` }}
            >
              {PITCHES.map((pitch) => {
                const black = isBlackKey(pitch);
                return (
                  <button
                    key={pitch}
                    onClick={() => AudioEngine.playInstrumentNote(track.id, pitch, '4n')}
                    className={`w-full flex items-center justify-between px-1.5 text-[8px] font-black leading-none border-b border-slate-900/60 cursor-pointer transition-colors ${
                      black ? 'bg-slate-950 hover:bg-slate-900 text-slate-400' : 'bg-slate-200 hover:bg-white text-slate-800'
                    }`}
                    style={{ height: `${rowHeight}px` }}
                  >
                    <span>{pitch}</span>
                  </button>
                );
              })}
            </div>

            {/* Grid + velocity column */}
            <div className="flex flex-col shrink-0">
              <div
                ref={gridContainerRef}
                onClick={handleGridClick}
                onPointerMove={onPointerMove}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
                className="relative bg-slate-950/20"
                style={{
                  width: `${gridWidth}px`,
                  height: `${gridHeight}px`,
                  backgroundImage:
                    'linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)',
                  backgroundSize: `${colWidth}px ${rowHeight}px`,
                }}
              >
                {/* Playhead */}
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-indigo-500 pointer-events-none z-10"
                  style={{ left: `${(activeStep % totalSteps) * colWidth}px` }}
                />
                {/* Octave separators */}
                {PITCHES.map((p, i) =>
                  p.startsWith('C') ? (
                    <div key={`sep-${p}`} className="absolute left-0 right-0 border-t border-slate-800/60 pointer-events-none" style={{ top: `${i * rowHeight}px` }} />
                  ) : null
                )}
                {/* Notes — height exactly matches the piano-key row height */}
                {notes.map((note) => {
                  const colIdx = Math.round(note.time / stepDuration);
                  const rowIdx = PITCHES.indexOf(note.pitch);
                  if (rowIdx === -1) return null;
                  const noteLeft = colIdx * colWidth;
                  const noteWidth = Math.max(1, Math.round(note.duration / stepDuration)) * colWidth;
                  return (
                    <div
                      key={note.id}
                      onPointerDown={(e) => onNotePointerDown(e, note)}
                      onContextMenu={(e) => { e.preventDefault(); removeNote(track.id, note.id); }}
                      className="absolute rounded-sm border flex items-center px-1 text-[8px] font-black text-white overflow-hidden cursor-move"
                      style={{
                        left: `${noteLeft + 1}px`,
                        top: `${rowIdx * rowHeight}px`,
                        width: `${Math.max(noteWidth - 2, 4)}px`,
                        height: `${rowHeight - 1}px`,
                        background: `linear-gradient(180deg, ${accent}, ${accent}cc)`,
                        borderColor: `${accent}`,
                        opacity: 0.5 + note.velocity * 0.5,
                      }}
                      title={`${note.pitch} · drag to move · right-click to delete`}
                    >
                      <span className="truncate pointer-events-none">{colWidth >= 22 ? note.pitch : ''}</span>
                      <div
                        onPointerDown={(e) => onResizePointerDown(e, note)}
                        className="absolute right-0 top-0 bottom-0 w-1.5 bg-white/30 hover:bg-white/60 cursor-ew-resize"
                      />
                    </div>
                  );
                })}
              </div>

              {/* Velocity lane */}
              <div
                className="border-t border-slate-900 bg-[#0a0f1d] relative shrink-0"
                style={{ width: `${gridWidth}px`, height: `${velocityLaneHeight}px` }}
              >
                <div className="absolute top-1 left-2 text-[9px] font-bold text-slate-600 uppercase tracking-widest pointer-events-none">Velocity</div>
                {notes.map((note) => {
                  const colIdx = Math.round(note.time / stepDuration);
                  const left = colIdx * colWidth;
                  const barH = Math.max(3, note.velocity * (velocityLaneHeight - 8));
                  return (
                    <div
                      key={`vel-${note.id}`}
                      onPointerDown={(e) => onVelocityPointerDown(e, note)}
                      className="absolute bottom-0 flex flex-col items-center justify-end cursor-ns-resize group"
                      style={{ left: `${left + 1}px`, width: `${Math.max(colWidth - 2, 4)}px`, height: `${velocityLaneHeight}px` }}
                    >
                      <div className="w-full rounded-t-sm" style={{ height: `${barH}px`, background: `linear-gradient(to top, ${accent}, ${accent}88)` }} />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
