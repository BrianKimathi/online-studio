import React, { useEffect } from 'react';
import { useRecordingStore } from '../../stores/useRecordingStore';
import { useTransportStore } from '../../stores/useTransportStore';
import { AudioEngine } from '../../audio/engine';
import { Knob } from '../shared/Knob';
import { Mic, Power, Music2, Waves, Activity, Radio, Users, Grid3x3, Upload, Play } from 'lucide-react';

const KEYS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

// Harmony voice presets: [label, default interval in semitones]
const HARMONY_PRESETS: { label: string; interval: number }[] = [
  { label: 'Oct Down', interval: -12 },
  { label: '3rd', interval: 4 },
  { label: '5th', interval: 7 },
  { label: 'Oct Up', interval: 12 },
];

export const VoiceEditor: React.FC = () => {
  const {
    micEnabled, setMicEnabled,
    monitoringEnabled, setMonitoringEnabled,
    micGain, setMicGain,
    autoTuneEnabled, setAutoTuneEnabled,
    autoTuneKey, setAutoTuneKey,
    autoTuneScale, setAutoTuneScale,
    autoTuneSpeed, setAutoTuneSpeed,
    autoTunePitch, setAutoTunePitch,
    takes,
  } = useRecordingStore();

  const { isRecording } = useTransportStore();

  // Local-only formant + mix state (kept out of the persisted store for brevity)
  const [formant, setFormant] = React.useState(1.0);
  const [wetMix, setWetMix] = React.useState(1.0);
  const [pitchDetected, setPitchDetected] = React.useState<number | null>(null);

  // Harmony voices (background vocals)
  const [harmony, setHarmony] = React.useState(HARMONY_PRESETS.map((p) => ({ ...p, enabled: false, level: 0.6 })));

  // Adlib pads
  const ADLIB_PAD_COUNT = 8;
  const [adlibLoaded, setAdlibLoaded] = React.useState(false);
  const [adlibLoading, setAdlibLoading] = React.useState(false);
  const [adlibSourceName, setAdlibSourceName] = React.useState<string | null>(null);

  // Sync autotune params to the engine whenever they change.
  useEffect(() => { AudioEngine.setAutotuneEnabled(autoTuneEnabled); }, [autoTuneEnabled]);
  useEffect(() => { AudioEngine.setAutotuneKey(KEYS.indexOf(autoTuneKey)); }, [autoTuneKey]);
  useEffect(() => { AudioEngine.setAutotuneScale(autoTuneScale); }, [autoTuneScale]);
  useEffect(() => { AudioEngine.setAutotuneSpeed(autoTuneSpeed / 100); }, [autoTuneSpeed]);
  useEffect(() => { AudioEngine.setAutotunePitch(autoTunePitch); }, [autoTunePitch]);
  useEffect(() => { AudioEngine.setAutotuneFormant(formant); }, [formant]);
  useEffect(() => { AudioEngine.setAutotuneMix(wetMix); }, [wetMix]);

  const handleMicToggle = async () => {
    await AudioEngine.init();
    if (!micEnabled) {
      const ok = await AudioEngine.enableMic(true);
      if (ok) {
        setMicEnabled(true);
        AudioEngine.setMicMonitoring(true);
        setMonitoringEnabled(true);
      }
    } else {
      await AudioEngine.enableMic(false);
      setMicEnabled(false);
      AudioEngine.setMicMonitoring(false);
      setMonitoringEnabled(false);
    }
  };

  const handleMonitorToggle = () => {
    const next = !monitoringEnabled;
    setMonitoringEnabled(next);
    AudioEngine.setMicMonitoring(next);
  };

  // ── Harmony voice controls ──────────────────────────────────────────
  const toggleHarmony = (index: number) => {
    setHarmony((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], enabled: !next[index].enabled };
      AudioEngine.setHarmonyVoice(index, next[index].enabled, next[index].level);
      return next;
    });
  };

  const setHarmonyLevel = (index: number, level: number) => {
    setHarmony((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], level };
      if (next[index].enabled) AudioEngine.setHarmonyVoice(index, true, level);
      return next;
    });
  };

  const setHarmonyInterval = (index: number, interval: number) => {
    setHarmony((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], interval };
      AudioEngine.setHarmonyInterval(index, interval);
      return next;
    });
  };

  // ── Adlib pads ──────────────────────────────────────────────────────
  const latestTake = takes.length > 0 ? takes[takes.length - 1] : null;

  const handleLoadAdlibs = async () => {
    if (!latestTake) return;
    setAdlibLoading(true);
    try {
      await AudioEngine.init();
      await AudioEngine.loadAdlibPads(latestTake.blobUrl, ADLIB_PAD_COUNT);
      setAdlibLoaded(true);
      setAdlibSourceName(latestTake.name);
    } catch (e) {
      console.error('Failed to load adlib pads', e);
    } finally {
      setAdlibLoading(false);
    }
  };

  const handleTriggerAdlib = (index: number) => {
    AudioEngine.triggerAdlib(index);
  };

  // Simple animated "input level" indicator driven by the vocal meter.
  useEffect(() => {
    if (!micEnabled || !monitoringEnabled) {
      setPitchDetected(null);
      return;
    }
    let raf = 0;
    const tick = () => {
      const level = AudioEngine.getChannelLevel('vocals');
      // Map dB to a 0..1 glow (roughly -60dB..0dB)
      const norm = Math.max(0, Math.min(1, (level + 60) / 60));
      setPitchDetected(norm);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [micEnabled, monitoringEnabled]);

  const levelPct = pitchDetected != null ? Math.round(pitchDetected * 100) : 0;

  return (
    <div className="h-full w-full bg-[#090e18] p-6 flex flex-col gap-5 overflow-y-auto select-none">
      {/* Header */}
      <div className="flex items-center justify-between bg-[#0c1221] border border-slate-900 rounded-xl p-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
            <Mic className="h-5 w-5 text-emerald-400" />
          </div>
          <div>
            <h2 className="text-sm font-black text-white tracking-wide">Voice Editor</h2>
            <p className="text-[10px] text-slate-500">Live mic input, pitch correction &amp; autotune</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleMonitorToggle}
            disabled={!micEnabled}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-bold border transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
              monitoringEnabled
                ? 'bg-sky-500/20 border-sky-500/40 text-sky-300'
                : 'bg-transparent border-slate-800 text-slate-500 hover:text-slate-300'
            }`}
          >
            <Radio className="h-3.5 w-3.5 inline mr-1" /> MONITOR
          </button>
          <button
            onClick={handleMicToggle}
            className={`px-4 py-1.5 rounded-lg text-[11px] font-black border transition-all cursor-pointer ${
              micEnabled
                ? 'bg-red-500/20 border-red-500/40 text-red-300'
                : 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
            }`}
          >
            <Power className="h-3.5 w-3.5 inline mr-1" /> {micEnabled ? 'STOP MIC' : 'START MIC'}
          </button>
        </div>
      </div>

      {/* Input meter */}
      <div className="bg-[#0c1221] border border-slate-900 rounded-xl p-4 shrink-0">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
            <Activity className="h-3.5 w-3.5 text-emerald-400" /> Input Level
          </span>
          <span className="text-[10px] font-mono text-slate-500">{micEnabled ? `${levelPct}%` : 'mic off'}</span>
        </div>
        <div className="h-3 w-full bg-slate-950 rounded-full overflow-hidden border border-slate-900">
          <div
            className="h-full bg-gradient-to-r from-emerald-500 via-lime-400 to-amber-400 transition-[width] duration-75"
            style={{ width: `${levelPct}%` }}
          />
        </div>
      </div>

      {/* Autotune master */}
      <div className="bg-[#0c1221] border border-slate-900 rounded-xl p-4 shrink-0">
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm font-bold text-white flex items-center gap-2">
            <Waves className="h-4 w-4 text-indigo-400" /> Autotune
          </span>
          <button
            onClick={() => setAutoTuneEnabled(!autoTuneEnabled)}
            disabled={!micEnabled}
            className={`px-3 py-1 rounded-lg text-[11px] font-black border transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
              autoTuneEnabled
                ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300'
                : 'bg-transparent border-slate-800 text-slate-500 hover:text-slate-300'
            }`}
          >
            {autoTuneEnabled ? 'ON' : 'OFF'}
          </button>
        </div>

        {/* Key + Scale */}
        <div className="grid grid-cols-2 gap-4 mb-5">
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Music2 className="h-3 w-3" /> Key
            </label>
            <div className="grid grid-cols-6 gap-1">
              {KEYS.map((k, i) => (
                <button
                  key={k}
                  onClick={() => setAutoTuneKey(k)}
                  className={`py-1.5 rounded-md text-[10px] font-bold border transition-all cursor-pointer ${
                    autoTuneKey === k
                      ? 'bg-indigo-600/20 border-indigo-500/50 text-indigo-300'
                      : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-300'
                  }`}
                >
                  {k}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Scale</label>
            <div className="grid grid-cols-2 gap-1">
              {(['major', 'minor'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setAutoTuneScale(s)}
                  className={`py-2 rounded-md text-[11px] font-bold border capitalize transition-all cursor-pointer ${
                    autoTuneScale === s
                      ? 'bg-indigo-600/20 border-indigo-500/50 text-indigo-300'
                      : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-300'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Correction knobs */}
        <div className="grid grid-cols-5 gap-2 pt-3 border-t border-slate-900 justify-items-center">
          <Knob
            size={44}
            label="Retune"
            value={autoTuneSpeed}
            min={0}
            max={100}
            step={1}
            unit="%"
            onChange={(v) => setAutoTuneSpeed(v)}
          />
          <Knob
            size={44}
            label="Pitch"
            value={autoTunePitch}
            min={-12}
            max={12}
            step={1}
            unit="st"
            onChange={(v) => setAutoTunePitch(v)}
          />
          <Knob
            size={44}
            label="Formant"
            value={formant}
            min={0.5}
            max={2.0}
            step={0.05}
            onChange={(v) => setFormant(v)}
          />
          <Knob
            size={44}
            label="Mix"
            value={wetMix}
            min={0}
            max={1}
            step={0.05}
            onChange={(v) => setWetMix(v)}
          />
          <Knob
            size={44}
            label="Gain"
            value={micGain}
            min={0}
            max={1}
            step={0.05}
            onChange={(v) => { setMicGain(v); AudioEngine.setMicGain(v); }}
          />
        </div>
      </div>

      {/* Background vocals — harmony voices */}
      <div className="bg-[#0c1221] border border-slate-900 rounded-xl p-4 shrink-0">
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm font-bold text-white flex items-center gap-2">
            <Users className="h-4 w-4 text-emerald-400" /> Background Vocals
          </span>
          <span className="text-[9px] text-slate-500 uppercase tracking-wider">Live harmony stacker</span>
        </div>

        <div className="grid grid-cols-4 gap-2">
          {harmony.map((voice, i) => (
            <div
              key={i}
              className={`rounded-lg border p-2 flex flex-col items-center gap-2 transition-colors ${
                voice.enabled
                  ? 'bg-emerald-500/10 border-emerald-500/40'
                  : 'bg-slate-900/50 border-slate-800'
              }`}
            >
              <button
                onClick={() => toggleHarmony(i)}
                disabled={!micEnabled}
                className={`w-full py-1 text-[10px] font-bold rounded border transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                  voice.enabled
                    ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                    : 'bg-transparent border-slate-800 text-slate-500 hover:text-slate-300'
                }`}
              >
                {voice.label}
              </button>
              <input
                type="number"
                value={voice.interval}
                onChange={(e) => setHarmonyInterval(i, parseInt(e.target.value) || 0)}
                disabled={!micEnabled}
                className="w-12 text-center bg-slate-950 border border-slate-800 rounded text-[10px] font-mono text-slate-300 py-0.5 disabled:opacity-40"
                title="Interval in semitones"
              />
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={voice.level}
                disabled={!micEnabled || !voice.enabled}
                onChange={(e) => setHarmonyLevel(i, parseFloat(e.target.value))}
                className="w-full accent-emerald-500 h-1 disabled:opacity-30"
              />
            </div>
          ))}
        </div>
        <p className="text-[9px] text-slate-500 mt-2 leading-relaxed">
          Enable the mic, then toggle harmonies to stack live background vocals. Edit the semitone interval to taste (3rd, 5th, octave…).
        </p>
      </div>

      {/* Adlibs — vocal chop trigger pads */}
      <div className="bg-[#0c1221] border border-slate-900 rounded-xl p-4 shrink-0">
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm font-bold text-white flex items-center gap-2">
            <Grid3x3 className="h-4 w-4 text-indigo-400" /> Adlib Pads
          </span>
          <button
            onClick={handleLoadAdlibs}
            disabled={adlibLoading || !latestTake}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-[11px] font-bold border transition-all cursor-pointer ${
              adlibLoading || !latestTake
                ? 'bg-slate-900 border-slate-800 text-slate-600 cursor-not-allowed'
                : 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300 hover:bg-indigo-500/30'
            }`}
          >
            <Upload className="h-3.5 w-3.5" />
            {adlibLoading ? 'Slicing…' : adlibLoaded ? 'Reload' : 'Load Latest Take'}
          </button>
        </div>

        <div className="grid grid-cols-4 gap-2">
          {Array.from({ length: ADLIB_PAD_COUNT }).map((_, i) => (
            <button
              key={i}
              onClick={() => handleTriggerAdlib(i)}
              disabled={!adlibLoaded}
              className={`aspect-square rounded-lg border flex flex-col items-center justify-center transition-all cursor-pointer ${
                adlibLoaded
                  ? 'bg-slate-900 hover:bg-indigo-600/20 border-slate-800 hover:border-indigo-500/50 text-slate-300 hover:text-indigo-300 active:scale-95'
                  : 'bg-slate-950/50 border-slate-900 text-slate-700 cursor-not-allowed'
              }`}
            >
              <Play className="h-4 w-4 mb-1" />
              <span className="text-[9px] font-bold">ADL {i + 1}</span>
            </button>
          ))}
        </div>
        <p className="text-[9px] text-slate-500 mt-2 leading-relaxed">
          {!latestTake
            ? 'Record a vocal take first (press R), then load it to slice into 8 adlib chops.'
            : adlibLoaded
            ? `Loaded from "${adlibSourceName}". Click pads (1–8) to trigger vocal chops.`
            : `Latest take "${latestTake.name}" ready to slice into 8 adlib pads.`}
        </p>
      </div>

      {/* Info */}
      <div className="bg-[#0b101c]/50 rounded-xl p-3 border border-slate-900/80 flex gap-2 shrink-0">
        <Activity className="h-4.5 w-4.5 text-emerald-500 shrink-0 mt-0.5" />
        <p className="text-[10px] leading-relaxed text-slate-400">
          Start the mic, enable monitoring to hear yourself, then turn Autotune ON. Pick a key &amp; scale,
          raise <span className="text-indigo-300 font-semibold">Retune</span> for a harder snap (T-Pain style)
          or lower it for subtle correction. <span className="text-indigo-300 font-semibold">Formant</span>
          reshapes the vocal timbre independently of pitch. Press <span className="font-bold text-white bg-slate-800 border border-slate-700 px-1 rounded">R</span> to record.
        </p>
      </div>

      {isRecording && (
        <div className="text-center text-[11px] font-bold text-red-400 animate-pulse shrink-0">
          ● REC — vocal take in progress
        </div>
      )}
    </div>
  );
};
