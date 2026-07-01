import React, { useState } from 'react';
import { useWindowStore, WindowKind } from '../../stores/useWindowStore';
import { useInstrumentsStore } from '../../stores/useInstrumentsStore';
import { WindowManager, windowTitleFor } from './WindowManager';
import { INSTRUMENT_PRESETS, ALL_INSTRUMENT_PRESETS } from '../../audio/instrumentPresets';
import {
  Grid, PlaySquare, SlidersHorizontal, Layers, Mic, Music, Plus, ChevronDown, Piano
} from 'lucide-react';

const PANEL_OPTIONS: { kind: WindowKind; label: string; icon: React.ComponentType<any> }[] = [
  { kind: 'drums', label: 'Drum Pads', icon: Grid },
  { kind: 'sequencer', label: 'Step Sequencer', icon: PlaySquare },
  { kind: 'mixer', label: 'Mixer', icon: SlidersHorizontal },
  { kind: 'timeline', label: 'Timeline', icon: Layers },
  { kind: 'voice-editor', label: 'Voice Editor', icon: Mic },
];

export const CenterWorkspace: React.FC = () => {
  const openWindow = useWindowStore((s) => s.openWindow);
  const windows = useWindowStore((s) => s.windows);
  const tracks = useInstrumentsStore((s) => s.tracks);
  const addTrack = useInstrumentsStore((s) => s.addTrack);
  const [menuOpen, setMenuOpen] = useState(false);

  const openPanel = (kind: WindowKind) => {
    openWindow({ kind, title: windowTitleFor(kind) });
    setMenuOpen(false);
  };

  const openTrackRoll = (trackId: string, name: string) => {
    openWindow({ kind: 'piano-roll', title: `${name} — Piano Roll`, trackId });
  };

  const addInstrument = (presetId: typeof ALL_INSTRUMENT_PRESETS[number]) => {
    const id = addTrack(presetId);
    const def = INSTRUMENT_PRESETS[presetId];
    openTrackRoll(id, def.name);
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden select-none">
      {/* Desktop header / Windows menu */}
      <div className="h-10 w-full bg-[#0a0f1d] border-b border-slate-900 flex items-center justify-between px-3 shrink-0 relative">
        <div className="flex items-center gap-2">
          <div className="relative">
            <button
              onClick={() => setMenuOpen((o) => !o)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600/15 border border-indigo-500/30 text-indigo-300 hover:bg-indigo-600/25 text-xs font-bold cursor-pointer transition-colors"
            >
              <Plus className="h-3.5 w-3.5" /> Add Window
              <ChevronDown className="h-3 w-3" />
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                <div className="absolute left-0 top-full mt-1 z-50 w-60 bg-[#0c1221] border border-slate-800 rounded-xl shadow-2xl p-2">
                  <div className="text-[9px] font-bold text-slate-500 uppercase tracking-widest px-1 py-1">Panels</div>
                  {PANEL_OPTIONS.map(({ kind, label, icon: Icon }) => (
                    <button
                      key={kind}
                      onClick={() => openPanel(kind)}
                      className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800 cursor-pointer transition-colors"
                    >
                      <Icon className="h-3.5 w-3.5 text-indigo-400" /> {label}
                    </button>
                  ))}

                  <div className="text-[9px] font-bold text-slate-500 uppercase tracking-widest px-1 pt-2 pb-1 mt-1 border-t border-slate-800">
                    Instrument Piano Rolls
                  </div>
                  {tracks.length === 0 && (
                    <div className="text-[10px] text-slate-600 px-2 py-1">No tracks yet — add one below.</div>
                  )}
                  {tracks.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => { openTrackRoll(t.id, t.name); setMenuOpen(false); }}
                      className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800 cursor-pointer transition-colors"
                    >
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: t.color }} />
                      <Piano className="h-3 w-3 text-slate-500" />
                      <span className="truncate">{t.name}</span>
                    </button>
                  ))}

                  <div className="text-[9px] font-bold text-slate-500 uppercase tracking-widest px-1 pt-2 pb-1 mt-1 border-t border-slate-800">
                    Add Instrument
                  </div>
                  <div className="grid grid-cols-2 gap-1">
                    {ALL_INSTRUMENT_PRESETS.map((pid) => {
                      const def = INSTRUMENT_PRESETS[pid];
                      return (
                        <button
                          key={pid}
                          onClick={() => { addInstrument(pid); setMenuOpen(false); }}
                          className="flex items-center gap-1 px-1.5 py-1 rounded-lg text-[10px] font-bold bg-slate-900/60 border border-slate-800 text-slate-300 hover:text-white hover:border-slate-700 cursor-pointer transition-colors"
                        >
                          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: def.color }} />
                          <span className="truncate">{def.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Quick open chips for existing instrument tracks */}
          <div className="flex items-center gap-1 overflow-x-auto">
            {tracks.map((t) => (
              <button
                key={t.id}
                onClick={() => openTrackRoll(t.id, t.name)}
                className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-900/60 border border-slate-800 text-[10px] font-semibold text-slate-300 hover:text-white hover:border-slate-700 cursor-pointer transition-colors shrink-0"
                title={`Open ${t.name} piano roll`}
              >
                <Music className="h-3 w-3" style={{ color: t.color }} />
                <span className="max-w-[80px] truncate">{t.name}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="text-[10px] text-slate-500 font-medium font-mono hidden md:block">
          {windows.length === 0
            ? 'OPEN A WINDOW TO BEGIN'
            : `${windows.length} WINDOW${windows.length > 1 ? 'S' : ''} OPEN`}
        </div>
      </div>

      {/* Desktop area hosting floating windows */}
      <div className="flex-1 min-h-0 bg-[#090e18] relative overflow-hidden">
        {windows.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
            <div className="h-16 w-16 rounded-2xl bg-gradient-to-tr from-indigo-500/20 to-violet-600/20 border border-indigo-500/30 flex items-center justify-center mb-4">
              <Layers className="h-7 w-7 text-indigo-400" />
            </div>
            <p className="text-sm font-bold text-slate-300">
              Online<span className="text-indigo-400">Studio</span> Workspace
            </p>
            <p className="text-xs text-slate-500 mt-1 max-w-xs">
              Click <span className="text-indigo-400 font-semibold">Add Window</span> to open panels, or add an
              instrument to open its piano roll. Drag windows by their title bar, resize from the corner, and close with the ×.
            </p>
          </div>
        )}
        <WindowManager />
      </div>
    </div>
  );
};
