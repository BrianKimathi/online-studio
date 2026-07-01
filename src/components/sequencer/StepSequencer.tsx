import React from 'react';
import { useSequencerStore } from '../../stores/useSequencerStore';
import { useTransportStore } from '../../stores/useTransportStore';
import { useUIStore } from '../../stores/useUIStore';
import { DrumPadId } from '../../types';
import { AudioEngine } from '../../audio/engine';
import { 
  Play, 
  Copy, 
  Trash2, 
  Plus, 
  RotateCcw,
  Sparkles,
  Layers,
  ChevronRight
} from 'lucide-react';

export const StepSequencer: React.FC = () => {
  const { 
    pads, 
    patterns, 
    activePatternId, 
    stepCount, 
    toggleStep, 
    setActivePattern,
    setStepCount,
    addPattern,
    duplicatePattern,
    deletePattern,
    clearPattern
  } = useSequencerStore();

  const { activeStep, swing, setSwing } = useTransportStore();
  const { setSelectedPadId } = useUIStore();

  const activePattern = patterns.find(p => p.id === activePatternId) || patterns[0];

  const handleStepClick = (padId: DrumPadId, stepIndex: number) => {
    toggleStep(activePatternId, padId, stepIndex);
    setSelectedPadId(padId);
    
    // Play sound on click to audit triggers
    if (!activePattern.steps[padId][stepIndex].active) {
      AudioEngine.playDrum(padId);
    }
  };

  return (
    <div className="h-full w-full bg-[#090e18] p-4 flex flex-col overflow-hidden select-none">
      
      {/* 1. Top Pattern & Grid Options Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#0c1221] border border-slate-900 rounded-xl p-3 mb-4 shrink-0">
        
        {/* Pattern List */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Pattern:</span>
          <div className="flex items-center gap-1.5 overflow-x-auto max-w-[320px] pb-1">
            {patterns.map((pat, idx) => (
              <button
                key={pat.id}
                onClick={() => setActivePattern(pat.id)}
                className={`px-3 py-1 text-xs font-bold rounded-lg border transition-colors cursor-pointer whitespace-nowrap ${
                  activePatternId === pat.id
                    ? 'bg-indigo-600/10 border-indigo-500/40 text-indigo-400'
                    : 'bg-slate-900 border-slate-850 text-slate-500 hover:text-slate-300'
                }`}
              >
                P{idx + 1}
              </button>
            ))}
          </div>
          
          <button
            onClick={addPattern}
            className="p-1 bg-slate-900 hover:bg-slate-850 border border-slate-800 rounded text-slate-400 hover:text-white cursor-pointer"
            title="Add Pattern"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Pattern Control Options */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => duplicatePattern(activePatternId)}
            className="flex items-center gap-1 px-2.5 py-1 bg-slate-900 hover:bg-slate-850 border border-slate-800 rounded-lg text-xs font-bold text-slate-400 hover:text-white cursor-pointer transition-colors"
            title="Duplicate Current Pattern"
          >
            <Copy className="h-3 w-3" /> Duplicate
          </button>
          
          <button
            onClick={() => clearPattern(activePatternId)}
            className="flex items-center gap-1 px-2.5 py-1 bg-slate-900 hover:bg-slate-850 border border-slate-800 rounded-lg text-xs font-bold text-slate-400 hover:text-white cursor-pointer transition-colors"
            title="Clear Pattern Grid"
          >
            <RotateCcw className="h-3 w-3" /> Clear
          </button>
          
          <button
            onClick={() => deletePattern(activePatternId)}
            disabled={patterns.length <= 1}
            className={`flex items-center gap-1 px-2.5 py-1 border rounded-lg text-xs font-bold transition-colors ${
              patterns.length <= 1
                ? 'border-transparent text-slate-700 cursor-not-allowed'
                : 'bg-slate-900 hover:bg-red-950/20 border-slate-800 text-slate-400 hover:text-red-500 cursor-pointer'
            }`}
            title="Delete Pattern"
          >
            <Trash2 className="h-3 w-3" /> Delete
          </button>
        </div>

        {/* Grid settings & Swing */}
        <div className="flex items-center gap-4">
          {/* Steps count toggle */}
          <div className="flex items-center gap-1 bg-slate-950 p-1 border border-slate-900 rounded-lg">
            {([16, 32] as const).map((len) => (
              <button
                key={len}
                onClick={() => setStepCount(len)}
                className={`px-2 py-0.5 text-[10px] font-bold rounded cursor-pointer ${
                  stepCount === len
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                {len} Steps
              </button>
            ))}
          </div>

          {/* Swing Slider */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Swing:</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={swing}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                setSwing(val);
                AudioEngine.setSwing(val);
              }}
              className="w-16 accent-indigo-500 h-1 bg-slate-900 rounded-lg cursor-pointer"
            />
            <span className="text-[9px] font-mono text-slate-400 font-semibold">{Math.round(swing * 100)}%</span>
          </div>
        </div>

      </div>

      {/* 2. Step Sequencer Grid (Scrollable Container) */}
      <div className="flex-1 overflow-auto border border-slate-900 rounded-2xl bg-[#0b101c]/40 relative">
        <table className="w-full border-collapse select-none">
          <thead>
            {/* Step header highlight counter */}
            <tr className="border-b border-slate-900">
              <th className="w-28 sticky left-0 z-10 bg-[#0c111e] border-r border-slate-900 px-3 py-1.5 text-left text-[9px] font-bold text-slate-500 uppercase tracking-widest leading-none">
                Drum Track
              </th>
              {Array.from({ length: stepCount }).map((_, stepIdx) => {
                const isStepActive = activeStep === stepIdx;
                // Highlight every 4th step block (e.g. beats 1, 2, 3, 4)
                const isBeatStart = stepIdx % 4 === 0;
                
                return (
                  <th 
                    key={stepIdx} 
                    className={`py-1 text-[10px] font-mono font-black ${
                      isStepActive 
                        ? 'text-indigo-400 bg-indigo-500/5' 
                        : isBeatStart 
                        ? 'text-slate-400 bg-slate-900/20' 
                        : 'text-slate-600'
                    }`}
                  >
                    {stepIdx + 1}
                  </th>
                );
              })}
            </tr>
          </thead>
          
          <tbody>
            {pads.map((pad) => {
              const stepsForPad = activePattern.steps[pad.id] || [];
              
              return (
                <tr 
                  key={pad.id} 
                  className="border-b border-slate-900 hover:bg-slate-950/20"
                >
                  {/* Pad labels (sticky column) */}
                  <td className="sticky left-0 z-10 bg-[#0c111e] border-r border-slate-900 px-3 py-2 text-left w-28 flex items-center justify-between">
                    <button
                      onClick={() => {
                        AudioEngine.playDrum(pad.id);
                        setSelectedPadId(pad.id);
                      }}
                      className="text-xs font-bold text-slate-300 hover:text-indigo-400 text-left truncate max-w-[80px] cursor-pointer"
                    >
                      {pad.name}
                    </button>
                    {pad.mute && <span className="text-[8px] bg-red-950/40 border border-red-900/30 text-red-500 font-extrabold px-1 rounded scale-90">M</span>}
                  </td>

                  {/* Steps list */}
                  {Array.from({ length: stepCount }).map((_, stepIdx) => {
                    const stepObj = stepsForPad[stepIdx] || { active: false, velocity: 0.8 };
                    const isStepActive = activeStep === stepIdx;
                    const isBeatStart = stepIdx % 4 === 0;
                    
                    return (
                      <td 
                        key={stepIdx} 
                        onClick={() => handleStepClick(pad.id, stepIdx)}
                        className={`p-1 text-center cursor-pointer transition-all ${
                          isStepActive ? 'bg-indigo-500/5' : ''
                        }`}
                      >
                        <div 
                          className={`h-7 rounded-md transition-all flex items-center justify-center font-black text-[9px] relative ${
                            stepObj.active
                              ? 'bg-indigo-600 hover:bg-indigo-500 shadow-md shadow-indigo-600/30 text-white border-b-2 border-indigo-400'
                              : isBeatStart
                              ? 'bg-slate-800 hover:bg-slate-750 border border-slate-700/55'
                              : 'bg-[#121826]/80 hover:bg-slate-800 border border-slate-900'
                          }`}
                        >
                          {/* Beat divider marker dot */}
                          {!stepObj.active && isBeatStart && (
                            <div className="h-1 w-1 bg-slate-600 rounded-full" />
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      
      {/* 3. Bottom Guide Info */}
      <div className="flex items-center gap-1.5 text-[10px] text-slate-500 mt-3 shrink-0">
        <Sparkles className="h-3.5 w-3.5 text-indigo-500" />
        <span>Click cells to toggle trigger notes. Steps are grouped in beats of 4 (e.g. 1/16th notes). Highlighted track names trigger sample plays instantly.</span>
      </div>

    </div>
  );
};
