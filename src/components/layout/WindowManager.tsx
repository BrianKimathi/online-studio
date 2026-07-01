import React from 'react';
import { useWindowStore, WindowKind } from '../../stores/useWindowStore';
import { FloatingWindow } from '../shared/FloatingWindow';
import { InstrumentPianoRoll } from '../pianoRoll/InstrumentPianoRoll';
import { Mixer } from '../mixer/Mixer';
import { DrumMachine } from '../drumMachine/DrumMachine';
import { StepSequencer } from '../sequencer/StepSequencer';
import { Timeline } from '../timeline/Timeline';
import { VoiceEditor } from '../voiceEditor/VoiceEditor';
import { useInstrumentsStore } from '../../stores/useInstrumentsStore';
import { useUIStore } from '../../stores/useUIStore';
import { INSTRUMENT_PRESETS } from '../../audio/instrumentPresets';

const ACCENT: Record<WindowKind, string> = {
  'piano-roll': '#a78bfa',
  mixer: '#34d399',
  drums: '#f472b6',
  sequencer: '#facc15',
  timeline: '#60a5fa',
  'voice-editor': '#22d3ee',
};

export const WindowManager: React.FC = () => {
  const windows = useWindowStore((s) => s.windows);
  const focusWindow = useWindowStore((s) => s.focusWindow);
  const setMinimized = useWindowStore((s) => s.setMinimized);
  const setActiveWorkspaceTab = useUIStore((s) => s.setActiveWorkspaceTab);

  const tracks = useInstrumentsStore((s) => s.tracks);

  const renderContent = (win: (typeof windows)[number]) => {
    switch (win.kind) {
      case 'piano-roll':
        return win.trackId ? <InstrumentPianoRoll trackId={win.trackId} /> : null;
      case 'mixer':
        return <Mixer />;
      case 'drums':
        return <DrumMachine />;
      case 'sequencer':
        return <StepSequencer />;
      case 'timeline':
        return <Timeline />;
      case 'voice-editor':
        return <VoiceEditor />;
      default:
        return null;
    }
  };

  const accentFor = (win: (typeof windows)[number]) => {
    if (win.kind === 'piano-roll' && win.trackId) {
      const t = tracks.find((tr) => tr.id === win.trackId);
      if (t) return t.color;
    }
    return ACCENT[win.kind];
  };

  return (
    <>
      {windows.map((win) => (
        <FloatingWindow
          key={win.id}
          win={win}
          accentColor={accentFor(win)}
          onActivate={() => {
            // Keep the RightPanel inspector roughly in sync.
            if (win.kind === 'piano-roll') setActiveWorkspaceTab('piano-roll');
            else if (win.kind === 'voice-editor') setActiveWorkspaceTab('voice-editor');
            else if (win.kind !== 'timeline') setActiveWorkspaceTab(win.kind as any);
          }}
        >
          {renderContent(win)}
        </FloatingWindow>
      ))}

      {/* Minimized taskbar */}
      {windows.some((w) => w.minimized) && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-[9999] flex items-center gap-1.5 bg-[#0a0f1d]/95 border border-slate-800 rounded-xl px-2 py-1.5 shadow-2xl backdrop-blur">
          {windows
            .filter((w) => w.minimized)
            .map((w) => (
              <button
                key={w.id}
                onClick={() => {
                  setMinimized(w.id, false);
                  focusWindow(w.id);
                }}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-[10px] font-semibold text-slate-300 hover:text-white cursor-pointer transition-colors"
              >
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: accentFor(w) }} />
                <span className="max-w-[140px] truncate">{w.title}</span>
              </button>
            ))}
        </div>
      )}
    </>
  );
};

/** Small helper used by the Windows menu to compute a default title. */
export function windowTitleFor(kind: WindowKind, trackId?: string): string {
  if (kind === 'piano-roll' && trackId) {
    const t = useInstrumentsStore.getState().tracks.find((tr) => tr.id === trackId);
    const name = t?.name ?? 'Instrument';
    return `${name} — Piano Roll`;
  }
  const map: Record<WindowKind, string> = {
    'piano-roll': 'Piano Roll',
    mixer: 'Mixer',
    drums: 'Drum Pads',
    sequencer: 'Step Sequencer',
    timeline: 'Timeline',
    'voice-editor': 'Voice Editor',
  };
  return map[kind];
}

export { INSTRUMENT_PRESETS };
