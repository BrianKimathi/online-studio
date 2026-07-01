import React, { useRef, useState } from 'react';
import { useRecordingStore } from '../../stores/useRecordingStore';
import { useTransportStore } from '../../stores/useTransportStore';
import { useSequencerStore } from '../../stores/useSequencerStore';
import { usePianoRollStore } from '../../stores/usePianoRollStore';
import { 
  Play, 
  Trash2, 
  Layers, 
  Mic, 
  Activity, 
  Scissors,
  Plus
} from 'lucide-react';

export const Timeline: React.FC = () => {
  const { 
    tracks, 
    clips, 
    removeClip, 
    updateClip, 
    selectedClipId, 
    selectClip,
    updateTrack
  } = useRecordingStore();
  
  const { activeStep, loopLength } = useTransportStore();
  const { patterns, activePatternId } = useSequencerStore();
  const { notes } = usePianoRollStore();

  const rulerRef = useRef<HTMLDivElement>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const flash = (m: string) => { setStatusMsg(m); setTimeout(() => setStatusMsg(null), 2500); };
  const trackWidth = 1024; // Width of timeline ruler
  const totalSteps = loopLength * 16;
  const colWidth = trackWidth / totalSteps;

  const handleClipClick = (clipId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    selectClip(selectedClipId === clipId ? null : clipId);
  };

  const handleSplitClip = (clipId: string) => {
    const clip = clips.find(c => c.id === clipId);
    if (!clip) return;
    
    // Split clip at the current playhead step
    const stepDuration = 0.25; // in seconds
    const playheadTime = (activeStep % totalSteps) * stepDuration;

    if (playheadTime > clip.startTime && playheadTime < clip.startTime + clip.duration) {
      const firstPartDuration = playheadTime - clip.startTime;
      const secondPartDuration = clip.duration - firstPartDuration;

      // Update current clip to end at playhead
      updateClip(clipId, { duration: firstPartDuration });

      // Add a new clip starting at playhead
      const newClipId = `clip-${Date.now()}`;
      // Access recording store direct trigger
      const addClipDirect = useRecordingStore.getState().addClip;
      addClipDirect({
        id: newClipId,
        trackId: clip.trackId,
        name: `${clip.name} (Split)`,
        startTime: playheadTime,
        duration: secondPartDuration,
        blobUrl: clip.blobUrl,
        offset: clip.offset + firstPartDuration,
        gain: clip.gain
      });
      
      flash('Split clip at playhead');
    } else {
      flash('Playhead must be inside the selected clip to split it');
    }
  };

  return (
    <div className="h-full w-full bg-[#090e18] p-4 flex flex-col overflow-hidden select-none">
      
      {/* 1. Timeline Action Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#0c1221] border border-slate-900 rounded-xl p-3 mb-4 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Timeline Tools:</span>
          <button
            onClick={() => {
              if (selectedClipId) {
                handleSplitClip(selectedClipId);
              } else {
                flash('Select a recorded clip on the vocal track to split');
              }
            }}
            disabled={!selectedClipId}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg border text-xs font-bold transition-colors ${
              selectedClipId
                ? 'bg-slate-900 border-slate-800 text-slate-300 hover:text-white cursor-pointer'
                : 'border-transparent text-slate-700 cursor-not-allowed'
            }`}
          >
            <Scissors className="h-3.5 w-3.5" /> Split Clip
          </button>
          {statusMsg && (
            <span className="text-[10px] font-semibold text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 px-2 py-1 rounded-lg">
              {statusMsg}
            </span>
          )}

          <button
            onClick={() => {
              if (selectedClipId) {
                removeClip(selectedClipId);
              }
            }}
            disabled={!selectedClipId}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg border text-xs font-bold transition-colors ${
              selectedClipId
                ? 'bg-slate-900 hover:bg-red-950/20 border-slate-800 text-slate-400 hover:text-red-500 cursor-pointer'
                : 'border-transparent text-slate-700 cursor-not-allowed'
            }`}
          >
            <Trash2 className="h-3.5 w-3.5" /> Delete Selected
          </button>
        </div>

        {/* Selected Clip Inspector details */}
        {selectedClipId && (
          <div className="text-[10px] bg-indigo-500/10 border border-indigo-500/20 py-1 px-3 rounded-lg text-indigo-400 font-semibold">
            SELECTED CLIP: {clips.find(c => c.id === selectedClipId)?.name} | Gain:{' '}
            {Math.round((clips.find(c => c.id === selectedClipId)?.gain || 1) * 100)}%
          </div>
        )}
      </div>

      {/* 2. Arranger Timeline */}
      <div className="flex-1 overflow-auto border border-slate-900 rounded-2xl bg-[#0b101c]/40 flex flex-col relative">
        
        {/* Ruler Row */}
        <div 
          ref={rulerRef}
          className="h-8 w-full border-b border-slate-900 flex items-center bg-[#0d1322] relative shrink-0"
        >
          <div className="w-48 border-r border-slate-900 h-full shrink-0 flex items-center px-4 text-[9px] font-bold text-slate-500 uppercase tracking-widest">
            Tracks
          </div>
          
          {/* Time markings */}
          <div className="flex-1 h-full relative" style={{ width: `${trackWidth}px` }}>
            {Array.from({ length: loopLength }).map((_, barIdx) => (
              <div 
                key={barIdx} 
                className="absolute top-0 bottom-0 border-l border-slate-800/80 pl-1 pt-1.5 text-[9px] font-mono font-bold text-slate-500"
                style={{ left: `${barIdx * 16 * colWidth}px` }}
              >
                BAR {barIdx + 1}
              </div>
            ))}
          </div>
        </div>

        {/* Timeline Tracks Grid */}
        <div className="flex-1 flex flex-col divide-y divide-slate-900 relative">
          
          {/* Timeline Playhead Highlight Line */}
          <div 
            className="absolute top-0 bottom-0 w-0.5 bg-indigo-500 led-blue pointer-events-none z-10 transition-all duration-100"
            style={{ left: `calc(12rem + ${(activeStep % totalSteps) * colWidth}px)` }}
          />

          {tracks.map((track) => {
            return (
              <div key={track.id} className="h-20 w-full flex items-stretch hover:bg-slate-950/10">
                {/* Left Track Header */}
                <div className="w-48 border-r border-slate-900 bg-[#0c1221] shrink-0 p-3 flex flex-col justify-between select-none">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full" style={{ backgroundColor: track.color }} />
                    <span className="text-xs font-bold text-slate-200 truncate">{track.name}</span>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <div className="flex gap-1">
                      <button
                        onClick={() => updateTrack(track.id, { mute: !track.mute })}
                        className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded border transition-colors cursor-pointer ${
                          track.mute
                            ? 'bg-red-500/25 border-red-500/40 text-red-400'
                            : 'border-slate-800 text-slate-500 hover:text-slate-300'
                        }`}
                      >
                        M
                      </button>
                      <button
                        onClick={() => updateTrack(track.id, { solo: !track.solo })}
                        className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded border transition-colors cursor-pointer ${
                          track.solo
                            ? 'bg-yellow-500/25 border-yellow-500/40 text-yellow-400'
                            : 'border-slate-800 text-slate-500 hover:text-slate-300'
                        }`}
                      >
                        S
                      </button>
                    </div>

                    <div className="w-16 flex items-center gap-1 opacity-60">
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.1"
                        value={track.volume}
                        onChange={(e) => updateTrack(track.id, { volume: parseFloat(e.target.value) })}
                        className="w-full accent-indigo-500 h-0.5 bg-slate-950 rounded cursor-pointer"
                      />
                    </div>
                  </div>
                </div>

                {/* Right Track Lane grid contents */}
                <div 
                  className="flex-1 relative bg-slate-950/5" 
                  style={{ 
                    width: `${trackWidth}px`,
                    backgroundImage: 'linear-gradient(90deg, rgba(255, 255, 255, 0.015) 1px, transparent 1px)',
                    backgroundSize: `${colWidth * 4}px 100%` // beat lines
                  }}
                  onClick={() => selectClip(null)}
                >
                  
                  {/* Track Type Specific Visualizers */}
                  {track.type === 'drums' && (
                    <div className="absolute inset-0 flex items-center justify-start opacity-20 pointer-events-none px-4">
                      <div className="flex gap-2">
                        {patterns.map((p, idx) => (
                          <div key={p.id} className="text-[10px] font-bold border border-dashed border-indigo-500/30 px-3 py-1 rounded bg-indigo-500/5">
                            Pattern {idx + 1}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {track.type === 'synth' && notes.length > 0 && (
                    <div className="absolute inset-0 flex items-center justify-start opacity-25 pointer-events-none px-4">
                      <div className="text-[10px] font-bold border border-dashed border-sky-500/30 px-3 py-1 rounded bg-sky-500/5">
                        {notes.length} Drawn Midi Notes active
                      </div>
                    </div>
                  )}

                  {/* Audio Clips (Vocal recordings) */}
                  {track.type === 'audio' && clips.filter(c => c.trackId === track.id).map((clip) => {
                    const stepDuration = 0.25; // duration of 1 sixteenth-note step in sec (default approximation at 120BPM)
                    const clipLeft = (clip.startTime / stepDuration) * colWidth;
                    const clipWidth = (clip.duration / stepDuration) * colWidth;
                    const isSelected = selectedClipId === clip.id;

                    return (
                      <div
                        key={clip.id}
                        onClick={(e) => handleClipClick(clip.id, e)}
                        className={`absolute top-2 bottom-2 rounded-xl border flex flex-col justify-between p-2 cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-indigo-600/30 border-indigo-400 shadow-lg shadow-indigo-500/20'
                            : 'bg-emerald-600/15 border-emerald-500/35 hover:bg-emerald-600/25 hover:border-emerald-400'
                        }`}
                        style={{
                          left: `${clipLeft}px`,
                          width: `${clipWidth}px`
                        }}
                      >
                        <span className="text-[9px] font-bold text-white truncate leading-none">
                          {clip.name}
                        </span>

                        {/* Mock Waveform Canvas Display */}
                        <div className="flex-1 mt-1.5 relative overflow-hidden flex items-center justify-center opacity-65">
                          <svg className="w-full h-full" viewBox="0 0 100 20" preserveAspectRatio="none">
                            <path 
                              d="M0,10 L5,2 L10,18 L15,5 L20,15 L25,3 L30,17 L35,6 L40,14 L45,4 L50,16 L55,8 L60,12 L65,5 L70,15 L75,3 L80,17 L85,6 L90,14 L95,8 L100,10" 
                              fill="none" 
                              stroke={isSelected ? '#818cf8' : '#34d399'} 
                              strokeWidth="1.5" 
                            />
                          </svg>
                        </div>
                      </div>
                    );
                  })}

                </div>
              </div>
            );
          })}
        </div>

      </div>

      <div className="flex items-center gap-1.5 text-[10px] text-slate-500 mt-3 shrink-0">
        <Layers className="h-3.5 w-3.5 text-indigo-500" />
        <span>Vocal takes recorded from Bottom transport appear here. Use Split tool at playhead mark to slice clips.</span>
      </div>

    </div>
  );
};
