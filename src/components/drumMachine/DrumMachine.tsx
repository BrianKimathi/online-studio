import React, { useEffect, useState } from 'react';
import { useSequencerStore } from '../../stores/useSequencerStore';
import { useUIStore } from '../../stores/useUIStore';
import { AudioEngine } from '../../audio/engine';
import { DrumPadId } from '../../types';
import { Volume2, Music, Key, Check } from 'lucide-react';

export const DrumMachine: React.FC = () => {
  const { pads, updatePadConfig } = useSequencerStore();
  const { selectedPadId, setSelectedPadId } = useUIStore();
  
  // Track active visual glow triggers for pad animation
  const [activeTriggers, setActiveTriggers] = useState<Record<string, boolean>>({});

  const triggerPad = (padId: DrumPadId) => {
    AudioEngine.playDrum(padId);
    
    // Trigger quick flash animation
    setActiveTriggers(prev => ({ ...prev, [padId]: true }));
    setTimeout(() => {
      setActiveTriggers(prev => ({ ...prev, [padId]: false }));
    }, 120);
  };

  // Keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Avoid triggering when user is typing in input fields
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      const pressedKey = e.key.toLowerCase();
      const pad = pads.find(p => p.key === pressedKey);
      
      if (pad && !pad.mute) {
        triggerPad(pad.id);
        setSelectedPadId(pad.id);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pads, setSelectedPadId]);

  return (
    <div className="h-full w-full p-6 flex flex-col md:flex-row gap-6 items-center justify-center bg-gradient-to-b from-[#090e18] to-[#060a12] select-none overflow-y-auto">
      
      {/* 1. MPC Pads Grid */}
      <div className="grid grid-cols-5 gap-3 bg-[#0d1322] p-5 rounded-2xl border border-slate-800 shadow-2xl shadow-black/40 w-full max-w-xl">
        {pads.map((pad) => {
          const isSelected = selectedPadId === pad.id;
          const isTriggered = activeTriggers[pad.id];
          
          return (
            <button
              key={pad.id}
              onClick={() => {
                triggerPad(pad.id);
                setSelectedPadId(pad.id);
              }}
              className={`aspect-square rounded-xl flex flex-col items-center justify-between p-3 transition-all relative overflow-hidden cursor-pointer ${
                isTriggered
                  ? 'bg-indigo-500 text-white scale-95 shadow-lg shadow-indigo-500/50 pad-active border-indigo-400'
                  : isSelected
                  ? 'bg-slate-800 border-2 border-indigo-500 text-indigo-400 font-bold shadow-indigo-900/10 shadow-lg scale-98'
                  : 'bg-slate-900 hover:bg-slate-850 hover:border-slate-750 active:scale-95 border border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              {/* Hotkey mapping indicator */}
              <div className="absolute top-1 right-2 text-[8px] font-black opacity-40 font-mono tracking-tighter">
                {pad.key.toUpperCase()}
              </div>

              {/* Pad LED light dot */}
              <div className={`h-1.5 w-1.5 rounded-full absolute top-2 left-2 ${
                pad.mute 
                  ? 'bg-red-500 led-red' 
                  : isSelected 
                  ? 'bg-indigo-400 led-blue animate-pulse' 
                  : 'bg-slate-700'
              }`} />

              <div className="flex-1 flex items-center justify-center pt-2">
                <Music className={`h-5 w-5 ${isTriggered ? 'text-white' : isSelected ? 'text-indigo-400' : 'text-slate-500'}`} />
              </div>

              <div className="text-[10px] font-black uppercase tracking-wider truncate max-w-full text-center">
                {pad.name}
              </div>
            </button>
          );
        })}
      </div>

      {/* 2. Side Fast Configuration Panel */}
      <div className="w-full md:w-56 p-4 rounded-2xl bg-slate-900/50 border border-slate-850 flex flex-col gap-4 self-stretch">
        <div className="border-b border-slate-800 pb-2 flex items-center gap-2">
          <Volume2 className="h-4 w-4 text-indigo-400" />
          <h3 className="text-xs font-bold text-slate-300 uppercase tracking-widest">Selected Pad</h3>
        </div>

        <div className="flex-1 flex flex-col justify-between gap-4">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Editing Pad</span>
            <span className="text-sm font-black text-indigo-300 capitalize">{pads.find(p => p.id === selectedPadId)?.name}</span>
          </div>

          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-[10px] text-slate-400 font-semibold mb-1">
                <span>GAIN LEVEL</span>
                <span>{Math.round((pads.find(p => p.id === selectedPadId)?.volume || 0) * 100)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={pads.find(p => p.id === selectedPadId)?.volume || 0}
                onChange={(e) => updatePadConfig(selectedPadId, { volume: parseFloat(e.target.value) })}
                className="w-full accent-indigo-500 bg-slate-950 h-1 rounded"
              />
            </div>

            <div>
              <div className="flex justify-between text-[10px] text-slate-400 font-semibold mb-1">
                <span>PANNING</span>
                <span>{pads.find(p => p.id === selectedPadId)?.pan || 0}</span>
              </div>
              <input
                type="range"
                min="-1"
                max="1"
                step="0.2"
                value={pads.find(p => p.id === selectedPadId)?.pan || 0}
                onChange={(e) => updatePadConfig(selectedPadId, { pan: parseFloat(e.target.value) })}
                className="w-full accent-indigo-500 bg-slate-950 h-1 rounded"
              />
            </div>
          </div>

          <div className="pt-2 border-t border-slate-800 flex items-center gap-2 bg-[#090d16]/30 p-2.5 rounded-lg border border-slate-900">
            <Key className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
            <p className="text-[9px] text-slate-400 leading-normal">
              Press key <span className="font-bold text-white bg-slate-800 border border-slate-700 px-1 py-0.5 rounded">{(pads.find(p => p.id === selectedPadId)?.key || '').toUpperCase()}</span> to trigger this sound.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
