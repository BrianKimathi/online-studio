import React from 'react';
import { useUIStore } from '../../stores/useUIStore';
import { useSequencerStore } from '../../stores/useSequencerStore';
import { usePianoRollStore } from '../../stores/usePianoRollStore';
import { useMixerStore } from '../../stores/useMixerStore';
import { Knob } from '../shared/Knob';
import { AudioEngine } from '../../audio/engine';
import { Sliders, Activity, Info, Plus, Trash2, ShieldCheck, Power } from 'lucide-react';
import { EffectType, DrumPadId } from '../../types';

export const RightPanel: React.FC = () => {
  const { activeWorkspaceTab, selectedPadId } = useUIStore();
  const { pads, updatePadConfig } = useSequencerStore();
  const { instrumentPreset, updatePreset, activeInstrument, setInstrument } = usePianoRollStore();
  const { channels, addEffect, removeEffect, toggleEffectBypass, updateEffectParam } = useMixerStore();

  const selectedPad = pads.find(p => p.id === selectedPadId) || pads[0];

  // FX rack local state
  const [fxTargetChannelId, setFxTargetChannelId] = React.useState('drums');
  const [fxAddType, setFxAddType] = React.useState<EffectType>('reverb');

  const handlePadVolumeChange = (val: number) => {
    updatePadConfig(selectedPadId, { volume: val });
    // Update audio engine (we convert 0-1 linear to dB using approximation or direct mapping)
    const db = 20 * Math.log10(val || 0.001);
    // Let's keep it simple: we can adjust the pad config in store, and the trigger method reads the velocity!
    // Since pads are triggered with volume/velocity, updating pad config volume works beautifully.
  };

  const handlePadPanChange = (val: number) => {
    updatePadConfig(selectedPadId, { pan: val });
  };

  const handlePadPitchChange = (val: number) => {
    updatePadConfig(selectedPadId, { pitch: val });
  };

  // Synths updates
  const handleEnvelopeChange = (param: 'attack' | 'decay' | 'sustain' | 'release', val: number) => {
    updatePreset({
      envelope: {
        ...instrumentPreset.envelope,
        [param]: val
      }
    });
    // Sync with AudioEngine
    AudioEngine.updateSynthPreset({
      ...instrumentPreset,
      envelope: {
        ...instrumentPreset.envelope,
        [param]: val
      }
    });
  };

  const handleFilterChange = (param: 'cutoff' | 'resonance', val: number) => {
    updatePreset({
      filter: {
        ...instrumentPreset.filter,
        [param]: val
      }
    });
    // Sync with AudioEngine
    AudioEngine.updateSynthPreset({
      ...instrumentPreset,
      filter: {
        ...instrumentPreset.filter,
        [param]: val
      }
    });
  };

  // Render context-sensitive panel contents
  const renderContent = () => {
    if (activeWorkspaceTab === 'drums' || activeWorkspaceTab === 'sequencer') {
      return (
        <div className="space-y-6">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
            <Sliders className="h-4 w-4 text-indigo-400" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Pad Inspector</h3>
          </div>
          
          <div className="bg-slate-950/60 rounded-xl p-4 border border-slate-900 text-center">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Active Pad</span>
            <span className="text-lg font-black text-indigo-400 drop-shadow-[0_0_10px_rgba(99,102,241,0.2)]">{selectedPad.name}</span>
            <span className="text-[10px] block text-slate-500 mt-1.5 font-mono">Key mapping: "{selectedPad.key.toUpperCase()}"</span>
            <span className="text-[9px] font-semibold block text-slate-400 bg-slate-900 border border-slate-800 py-1 px-2 rounded mt-2.5 max-w-xs mx-auto truncate">
              Sample: {selectedPad.userSampleName || 'Synthetic Generator'}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-y-6 gap-x-4 pt-2">
            <Knob
              label="Volume"
              value={selectedPad.volume}
              min={0}
              max={1}
              step={0.01}
              onChange={handlePadVolumeChange}
            />
            <Knob
              label="Pan"
              value={selectedPad.pan}
              min={-1}
              max={1}
              step={0.1}
              onChange={handlePadPanChange}
            />
            <Knob
              label="Pitch Shift"
              value={selectedPad.pitch}
              min={-12}
              max={12}
              step={1}
              unit="st"
              onChange={handlePadPitchChange}
            />
            <div className="flex flex-col items-center justify-center gap-1.5">
              <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mb-1">State</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => updatePadConfig(selectedPadId, { mute: !selectedPad.mute })}
                  className={`px-3 py-1 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                    selectedPad.mute
                      ? 'bg-red-500/20 border-red-500/40 text-red-400'
                      : 'bg-transparent border-slate-800 text-slate-500 hover:text-slate-300'
                  }`}
                >
                  MUTE
                </button>
                <button
                  onClick={() => updatePadConfig(selectedPadId, { solo: !selectedPad.solo })}
                  className={`px-3 py-1 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                    selectedPad.solo
                      ? 'bg-yellow-500/20 border-yellow-500/40 text-yellow-400'
                      : 'bg-transparent border-slate-800 text-slate-500 hover:text-slate-300'
                  }`}
                >
                  SOLO
                </button>
              </div>
            </div>
          </div>
          
          <div className="bg-[#0b101c]/50 rounded-xl p-3 border border-slate-900/80 flex gap-2">
            <Info className="h-4.5 w-4.5 text-indigo-500 shrink-0 mt-0.5" />
            <p className="text-[10px] leading-relaxed text-slate-400">
              Customize pad gain and panning parameters. Load WAV/MP3 files into the sidebar sample bank to assign custom user samples to pads.
            </p>
          </div>
        </div>
      );
    }

    if (activeWorkspaceTab === 'piano-roll') {
      return (
        <div className="space-y-6">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
            <Sliders className="h-4 w-4 text-sky-400" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Synth Settings</h3>
          </div>

          {/* Synth Type */}
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Oscillator Engine</label>
            <div className="grid grid-cols-2 gap-1">
              {(['synth', 'fm', 'am', 'mono'] as const).map(type => (
                <button
                  key={type}
                  onClick={() => {
                    setInstrument(type);
                    AudioEngine.setInstrumentType(type);
                  }}
                  className={`py-1.5 px-2 rounded-lg text-xs font-bold border transition-colors cursor-pointer capitalize ${
                    activeInstrument === type
                      ? 'bg-sky-600/10 border-sky-500/30 text-sky-400'
                      : 'bg-slate-900 border-slate-850 text-slate-500 hover:text-slate-300'
                  }`}
                >
                  {type === 'synth' ? 'Classic Sub' : type.toUpperCase() + ' Synth'}
                </button>
              ))}
            </div>
          </div>

          {/* ADSR Envelope */}
          <div>
            <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">Envelope ADSR</h4>
            <div className="grid grid-cols-4 gap-1 justify-items-center">
              <Knob
                size={40}
                label="Attack"
                value={instrumentPreset.envelope.attack}
                min={0.001}
                max={2.0}
                step={0.01}
                unit="s"
                onChange={(val) => handleEnvelopeChange('attack', val)}
              />
              <Knob
                size={40}
                label="Decay"
                value={instrumentPreset.envelope.decay}
                min={0.01}
                max={2.0}
                step={0.01}
                unit="s"
                onChange={(val) => handleEnvelopeChange('decay', val)}
              />
              <Knob
                size={40}
                label="Sustain"
                value={instrumentPreset.envelope.sustain}
                min={0.0}
                max={1.0}
                step={0.05}
                onChange={(val) => handleEnvelopeChange('sustain', val)}
              />
              <Knob
                size={40}
                label="Release"
                value={instrumentPreset.envelope.release}
                min={0.01}
                max={3.0}
                step={0.05}
                unit="s"
                onChange={(val) => handleEnvelopeChange('release', val)}
              />
            </div>
          </div>

          {/* Filter Section */}
          <div className="border-t border-slate-900 pt-4">
            <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">Lowpass Filter</h4>
            <div className="grid grid-cols-2 gap-4">
              <Knob
                label="Cutoff"
                value={instrumentPreset.filter.cutoff}
                min={50}
                max={5000}
                step={10}
                unit="Hz"
                onChange={(val) => handleFilterChange('cutoff', val)}
              />
              <Knob
                label="Resonance"
                value={instrumentPreset.filter.resonance}
                min={0.1}
                max={10.0}
                step={0.1}
                unit="Q"
                onChange={(val) => handleFilterChange('resonance', val)}
              />
            </div>
          </div>
        </div>
      );
    }

    // Mixer or Timeline: Show Channel FX Rack
    const nonMaster = channels.filter((c) => c.id !== 'master');
    const selectedChannel = nonMaster.find((c) => c.id === fxTargetChannelId) ?? nonMaster[0];
    const EFFECT_TYPES: EffectType[] = ['reverb', 'delay', 'compressor', 'distortion', 'chorus', 'gate', 'tremolo'];
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
          <Activity className="h-4 w-4 text-emerald-400" />
          <h3 className="text-sm font-bold text-white uppercase tracking-wider font-sans">Mixer FX Rack</h3>
        </div>

        <div className="space-y-3">
          {/* Channel selector */}
          <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-900">
            <span className="text-[10px] font-bold text-slate-500 uppercase block mb-2">Target Mixer Strip</span>
            <div className="flex gap-1">
              {nonMaster.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setFxTargetChannelId(c.id)}
                  className={`flex-1 py-1 text-[10px] font-bold rounded border transition-all cursor-pointer ${
                    selectedChannel?.id === c.id
                      ? 'bg-indigo-600/20 border-indigo-500/40 text-indigo-300'
                      : 'bg-transparent border-slate-800 text-slate-500 hover:text-slate-300'
                  }`}
                >
                  {c.name}
                </button>
              ))}
            </div>
          </div>

          {/* Add FX */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Active Inserts</span>
              <div className="flex items-center gap-1">
                <select
                  value={fxAddType}
                  onChange={(e) => setFxAddType(e.target.value as EffectType)}
                  className="bg-slate-900 border border-slate-800 text-[10px] font-semibold px-1 py-0.5 rounded focus:outline-none cursor-pointer"
                >
                  {EFFECT_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
                <button
                  onClick={() => {
                    if (!selectedChannel) return;
                    const id = addEffect(selectedChannel.id, fxAddType);
                    AudioEngine.addChannelEffect(selectedChannel.id, id, fxAddType, {});
                  }}
                  className="flex items-center gap-1 text-[9px] font-semibold text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 py-0.5 px-1.5 rounded cursor-pointer hover:bg-indigo-600/20"
                >
                  <Plus className="h-2.5 w-2.5" /> ADD
                </button>
              </div>
            </div>

            {!selectedChannel || selectedChannel.effects.length === 0 ? (
              <div className="text-center py-6 text-xs text-slate-600 border border-dashed border-slate-800 rounded-lg">
                Empty FX Rack. Pick an effect type and click ADD.
              </div>
            ) : (
              selectedChannel.effects.map((fx) => (
                <div key={fx.id} className="bg-slate-900 border border-slate-800 p-2.5 rounded-lg flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        toggleEffectBypass(selectedChannel.id, fx.id);
                        AudioEngine.setChannelEffectBypass(selectedChannel.id, fx.id, !fx.bypass);
                      }}
                      className={`p-1 rounded cursor-pointer ${
                        fx.bypass ? 'text-slate-600 bg-slate-950' : 'text-emerald-500 bg-emerald-500/10'
                      }`}
                      title={fx.bypass ? 'Bypassed' : 'Active (click to bypass)'}
                    >
                      <Power className="h-3 w-3" />
                    </button>
                    <div>
                      <span className="text-xs font-semibold text-slate-200 capitalize">{fx.type}</span>
                      <span className="text-[9px] block text-slate-500">{fx.bypass ? 'Bypassed' : 'Active insert'}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      removeEffect(selectedChannel.id, fx.id);
                      AudioEngine.removeChannelEffect(selectedChannel.id, fx.id);
                    }}
                    className="p-1 text-slate-500 hover:text-red-500 cursor-pointer transition-colors"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <aside className="w-64 bg-[#0a0f1d] border-l border-slate-900 p-4 h-full overflow-y-auto select-none z-30 shrink-0">
      {renderContent()}
    </aside>
  );
};
