import React, { useEffect, useState, useRef } from 'react';
import { useMixerStore } from '../../stores/useMixerStore';
import { AudioEngine } from '../../audio/engine';
import { MixerChannel } from '../../types';
import { Knob } from '../shared/Knob';
import { 
  Volume2, 
  VolumeX, 
  Settings, 
  Plus, 
  Power,
  Trash2,
  Activity
} from 'lucide-react';

export const Mixer: React.FC = () => {
  const { 
    channels, 
    setVolume, 
    setPan, 
    setMute, 
    setSolo, 
    updateEq, 
    updateSends,
    addEffect,
    removeEffect,
    toggleEffectBypass
  } = useMixerStore();

  return (
    <div className="h-full w-full bg-[#080d16] p-6 flex gap-4 overflow-x-auto select-none items-stretch">
      {channels.map((channel) => {
        const isMaster = channel.id === 'master';
        return (
          <ChannelStrip
            key={channel.id}
            channel={channel}
            isMaster={isMaster}
            setVolume={setVolume}
            setPan={setPan}
            setMute={setMute}
            setSolo={setSolo}
            updateEq={updateEq}
            updateSends={updateSends}
            addEffect={addEffect}
            removeEffect={removeEffect}
            toggleEffectBypass={toggleEffectBypass}
          />
        );
      })}
    </div>
  );
};

interface StripProps {
  channel: MixerChannel;
  isMaster: boolean;
  setVolume: (id: string, vol: number) => void;
  setPan: (id: string, pan: number) => void;
  setMute: (id: string, mute: boolean) => void;
  setSolo: (id: string, solo: boolean) => void;
  updateEq: (id: string, band: 'low' | 'mid' | 'high', gain: number) => void;
  updateSends: (id: string, type: 'sendReverb' | 'sendDelay', val: number) => void;
  addEffect: (id: string, type: any) => void;
  removeEffect: (id: string, fxId: string) => void;
  toggleEffectBypass: (id: string, fxId: string) => void;
}

const ChannelStrip: React.FC<StripProps> = ({
  channel,
  isMaster,
  setVolume,
  setPan,
  setMute,
  setSolo,
  updateEq,
  updateSends,
  addEffect,
  removeEffect,
  toggleEffectBypass
}) => {
  const [level, setLevel] = useState(-60); // dB
  const animationFrameRef = useRef<number | null>(null);

  // Peak level meter loop
  useEffect(() => {
    const updateMeter = () => {
      const db = AudioEngine.getChannelLevel(channel.id);
      // Smooth falloff
      setLevel(prev => Math.max(db, prev - 1.2));
      animationFrameRef.current = requestAnimationFrame(updateMeter);
    };

    animationFrameRef.current = requestAnimationFrame(updateMeter);
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [channel.id]);

  // Convert level from dB to height percentage (0 to 100)
  const peakPercent = Math.min(100, Math.max(0, ((level + 60) / 60) * 100));

  // Convert slider volume representation (0-100) to actual dB (-60 to +6)
  // Slider 0 -> -60dB
  // Slider 80 -> 0dB
  // Slider 100 -> +6dB
  const dbToSlider = (db: number) => {
    if (db <= -60) return 0;
    if (db >= 6) return 100;
    // Map -60 to 0dB linearly to 0 to 80, 0 to 6dB to 80 to 100
    if (db <= 0) {
      return ((db + 60) / 60) * 80;
    } else {
      return 80 + (db / 6) * 20;
    }
  };

  const sliderToDb = (slider: number) => {
    if (slider <= 0) return -Infinity;
    if (slider >= 100) return 6;
    if (slider <= 80) {
      return (slider / 80) * 60 - 60;
    } else {
      return ((slider - 80) / 20) * 6;
    }
  };

  const sliderVal = dbToSlider(channel.volume);

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    const db = sliderToDb(val);
    setVolume(channel.id, db);
    AudioEngine.updateChannelVolume(channel.id, db);
  };

  return (
    <div className={`w-36 bg-slate-900 border flex flex-col justify-between p-3 rounded-2xl ${
      isMaster
        ? 'border-indigo-500/40 bg-gradient-to-b from-[#111625] to-[#0a0f1d] shadow-indigo-950/20 shadow-xl'
        : 'border-slate-800'
    }`}>
      
      {/* 1. Header label */}
      <div className="text-center pb-2 border-b border-slate-800 select-none">
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">CH</span>
        <span className={`text-[11px] font-bold truncate max-w-full block ${
          isMaster ? 'text-indigo-400 font-extrabold' : 'text-slate-300'
        }`}>
          {channel.name}
        </span>
      </div>

      {/* 2. EQ section (no EQ on master channel in this configuration) */}
      {!isMaster && (
        <div className="grid grid-cols-3 gap-0.5 pt-3 pb-2 border-b border-slate-800/80 justify-items-center">
          <Knob
            label="High"
            size={34}
            value={channel.eq.high}
            min={-12}
            max={12}
            step={0.5}
            unit="dB"
            onChange={(val) => {
              updateEq(channel.id, 'high', val);
              AudioEngine.updateChannelEq(channel.id, 'high', val);
            }}
          />
          <Knob
            label="Mid"
            size={34}
            value={channel.eq.mid}
            min={-12}
            max={12}
            step={0.5}
            unit="dB"
            onChange={(val) => {
              updateEq(channel.id, 'mid', val);
              AudioEngine.updateChannelEq(channel.id, 'mid', val);
            }}
          />
          <Knob
            label="Low"
            size={34}
            value={channel.eq.low}
            min={-12}
            max={12}
            step={0.5}
            unit="dB"
            onChange={(val) => {
              updateEq(channel.id, 'low', val);
              AudioEngine.updateChannelEq(channel.id, 'low', val);
            }}
          />
        </div>
      )}

      {/* 3. Send Levels Bus (no sends on master) */}
      {!isMaster && (
        <div className="flex justify-around pt-2 pb-2 border-b border-slate-800/60">
          <Knob
            label="Rvrb"
            size={36}
            value={channel.sendReverb}
            min={0}
            max={1}
            step={0.05}
            onChange={(val) => {
              updateSends(channel.id, 'sendReverb', val);
              AudioEngine.updateChannelSends(channel.id, 'reverb', val);
            }}
          />
          <Knob
            label="Dly"
            size={36}
            value={channel.sendDelay}
            min={0}
            max={1}
            step={0.05}
            onChange={(val) => {
              updateSends(channel.id, 'sendDelay', val);
              AudioEngine.updateChannelSends(channel.id, 'delay', val);
            }}
          />
        </div>
      )}

      {/* 4. Panning Dial */}
      {!isMaster && (
        <div className="pt-2 pb-2 flex items-center justify-center border-b border-slate-850">
          <Knob
            label="Pan"
            size={38}
            value={channel.pan}
            min={-1}
            max={1}
            step={0.1}
            onChange={(val) => {
              setPan(channel.id, val);
              AudioEngine.updateChannelPan(channel.id, val);
            }}
          />
        </div>
      )}

      {/* 5. Channel strip body: Peak meter & Vertical slider fader */}
      <div className="flex-1 flex gap-3.5 items-stretch py-4 min-h-[140px]">
        {/* LED Peak level bar */}
        <div className="w-2.5 bg-slate-950/80 rounded-full border border-slate-850/60 relative overflow-hidden flex flex-col justify-end">
          <div 
            className="w-full meter-fill rounded-full transition-all duration-75"
            style={{ height: `${peakPercent}%` }}
          />
        </div>

        {/* Volume Fader slider */}
        <div className="flex-1 flex items-center justify-center relative">
          <input
            type="range"
            min="0"
            max="100"
            step="1"
            value={sliderVal}
            onChange={handleVolumeChange}
            className="accent-indigo-500 cursor-ns-resize h-full w-4 bg-slate-950 rounded border border-slate-850/80"
            style={{
              writingMode: 'vertical-lr',
              direction: 'rtl',
              WebkitAppearance: 'slider-vertical' as any,
            }}
          />
        </div>
      </div>

      {/* 6. Mute (M) / Solo (S) Buttons */}
      <div className="flex gap-1.5 pt-2 border-t border-slate-800/80">
        <button
          onClick={() => {
            const next = !channel.mute;
            setMute(channel.id, next);
            AudioEngine.updateChannelMute(channel.id, next);
          }}
          className={`flex-1 py-1 text-[10px] font-black rounded-lg border transition-all cursor-pointer ${
            channel.mute
              ? 'bg-red-500/25 border-red-500/40 text-red-400 font-extrabold shadow-inner'
              : 'bg-transparent border-slate-800 text-slate-500 hover:text-slate-300'
          }`}
        >
          M
        </button>

        <button
          onClick={() => {
            const next = !channel.solo;
            setSolo(channel.id, next);
            AudioEngine.updateChannelSolo(channel.id, next);
          }}
          className={`flex-1 py-1 text-[10px] font-black rounded-lg border transition-all cursor-pointer ${
            channel.solo
              ? 'bg-yellow-500/25 border-yellow-500/40 text-yellow-400 font-extrabold shadow-inner'
              : 'bg-transparent border-slate-800 text-slate-500 hover:text-slate-300'
          }`}
        >
          S
        </button>
      </div>

    </div>
  );
};
