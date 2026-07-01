import React, { useState, useEffect, useRef } from 'react';
import { useTransportStore } from '../../stores/useTransportStore';
import { useRecordingStore } from '../../stores/useRecordingStore';
import { AudioEngine } from '../../audio/engine';
import { 
  Play, 
  Square, 
  Pause, 
  Circle, 
  Volume2, 
  HelpCircle, 
  VolumeX, 
  Mic, 
  Activity,
  Maximize2
} from 'lucide-react';
import { Knob } from '../shared/Knob';

export const BottomTransport: React.FC = () => {
  const {
    isPlaying,
    isRecording,
    bpm,
    metronome,
    loopEnabled,
    loopLength,
    position,
    setPlaying,
    setRecording,
    setBpm,
    setMetronome,
    setLoopEnabled,
    setPosition
  } = useTransportStore();

  const {
    micEnabled,
    monitoringEnabled,
    micGain,
    recordingMode,
    setMicEnabled,
    setMonitoringEnabled,
    setMicGain,
    setRecordingMode,
    addTake
  } = useRecordingStore();

  const [bpmInput, setBpmInput] = useState(bpm.toString());
  const [masterPeak, setMasterPeak] = useState(-60); // in dB
  const animationFrameRef = useRef<number | null>(null);
  const recordStartRef = useRef<number | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const flash = (m: string) => { setStatusMsg(m); setTimeout(() => setStatusMsg(null), 3000); };

  // Sync BPM input when changed via store
  useEffect(() => {
    setBpmInput(bpm.toString());
  }, [bpm]);

  const handlePlayToggle = async () => {
    await AudioEngine.init();
    // Ensure the transport loop matches the store before starting
    AudioEngine.setLoopEnabled(loopEnabled, loopLength);
    if (isPlaying) {
      AudioEngine.stopTransport();
      setPlaying(false);
      setRecording(false);
    } else {
      AudioEngine.startTransport();
      setPlaying(true);
    }
  };

  const handleStopClick = () => {
    // If we're recording, finalize the take (otherwise the recorder keeps
    // running in the background and the mic stays hot).
    if (isRecording) {
      setRecording(false);
      AudioEngine.stopRecording(recordingMode === 'vocals' ? 'vocals' : 'mix').then((url) => {
        const duration = recordStartRef.current ? (Date.now() - recordStartRef.current) / 1000 : 0;
        recordStartRef.current = null;
        if (url) {
          addTake({
            id: `take-${Date.now()}`,
            name: `${recordingMode === 'vocals' ? 'Vocal' : 'Mix'} Take ${new Date().toLocaleTimeString()}`,
            timestamp: Date.now(),
            duration,
            blobUrl: url,
            type: recordingMode === 'vocals' ? 'vocals' : 'mix'
          });
        }
      });
      // Stop the mic so it doesn't stay active after recording stops.
      if (micEnabled) {
        AudioEngine.enableMic(false);
        setMicEnabled(false);
        setMonitoringEnabled(false);
      }
    }
    AudioEngine.stopTransport();
    setPlaying(false);
    setRecording(false);
  };

  const handleRecordToggle = async () => {
    await AudioEngine.init();
    
    if (isRecording) {
      // Stop recording
      setRecording(false);
      const url = await AudioEngine.stopRecording(recordingMode === 'vocals' ? 'vocals' : 'mix');
      const duration = recordStartRef.current ? (Date.now() - recordStartRef.current) / 1000 : 0;
      recordStartRef.current = null;
      // Stop the mic so it doesn't stay active (audible) after recording stops.
      if (micEnabled) {
        await AudioEngine.enableMic(false);
        setMicEnabled(false);
        setMonitoringEnabled(false);
      }
      if (url) {
        addTake({
          id: `take-${Date.now()}`,
          name: `${recordingMode === 'vocals' ? 'Vocal' : 'Mix'} Take ${new Date().toLocaleTimeString()}`,
          timestamp: Date.now(),
          duration,
          blobUrl: url,
          type: recordingMode === 'vocals' ? 'vocals' : 'mix'
        });
        flash(`Recorded ${duration.toFixed(1)}s — saved to Projects › Takes`);
      }
    } else {
      // Start recording
      if (recordingMode === 'vocals' && !micEnabled) {
        const opened = await handleMicToggle();
        if (!opened) return;
      }
      setRecording(true);
      recordStartRef.current = Date.now();
      if (!isPlaying) {
        AudioEngine.startTransport();
        setPlaying(true);
      }
      AudioEngine.startRecording(recordingMode === 'vocals' ? 'vocals' : 'mix');
    }
  };

  const handleMicToggle = async (): Promise<boolean> => {
    await AudioEngine.init();
    const nextState = !micEnabled;
    const success = await AudioEngine.enableMic(nextState);
    if (success) {
      setMicEnabled(nextState);
      return true;
    } else if (!nextState) {
      setMicEnabled(false);
      return true;
    }
    alert('Could not open microphone. Please allow microphone permissions in your browser.');
    return false;
  };

  const handleMonitorToggle = () => {
    const nextState = !monitoringEnabled;
    setMonitoringEnabled(nextState);
    AudioEngine.setMicMonitoring(nextState);
  };

  const handleBpmSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const numericBpm = parseInt(bpmInput);
    if (!isNaN(numericBpm) && numericBpm >= 20 && numericBpm <= 300) {
      setBpm(numericBpm);
      AudioEngine.setBPM(numericBpm);
    } else {
      setBpmInput(bpm.toString());
    }
  };

  // Peak level meter loop
  useEffect(() => {
    const updateMeter = () => {
      const db = AudioEngine.getChannelLevel('master');
      // Smooth meter falloff
      setMasterPeak(prev => Math.max(db, prev - 1.5));
      animationFrameRef.current = requestAnimationFrame(updateMeter);
    };

    animationFrameRef.current = requestAnimationFrame(updateMeter);
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, []);

  // Map masterPeak dB to a percentage (0 to 100)
  // Standard range is roughly -60dB (silence) to 0dB (clipping)
  const peakPercent = Math.min(100, Math.max(0, ((masterPeak + 60) / 60) * 100));

  return (
    <footer className="h-16 w-full bg-[#0a0f1d] border-t border-slate-900 flex items-center justify-between px-4 z-40 select-none shrink-0 text-slate-300">
      {/* 1. Transport Controls */}
      <div className="flex items-center gap-1">
        <button
          onClick={handlePlayToggle}
          className={`h-9 w-9 rounded-lg flex items-center justify-center cursor-pointer transition-colors ${
            isPlaying 
              ? 'bg-emerald-600 hover:bg-emerald-500 text-white' 
              : 'bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white'
          }`}
          title={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? <Pause className="h-4.5 w-4.5 fill-current" /> : <Play className="h-4.5 w-4.5 fill-current ml-0.5" />}
        </button>

        <button
          onClick={handleStopClick}
          className="h-9 w-9 rounded-lg flex items-center justify-center bg-slate-900 hover:bg-slate-800 active:bg-slate-950 text-slate-400 hover:text-white cursor-pointer transition-colors"
          title="Stop"
        >
          <Square className="h-4 w-4 fill-current" />
        </button>

        <button
          onClick={handleRecordToggle}
          className={`h-9 w-9 rounded-lg flex items-center justify-center cursor-pointer transition-colors ${
            isRecording 
              ? 'bg-red-600 hover:bg-red-500 text-white animate-pulse' 
              : 'bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-red-500'
          }`}
          title="Record Vocals / Mix"
        >
          <Circle className="h-4.5 w-4.5 fill-current" />
        </button>
      </div>

      {/* 2. Metronome & Loop Settings */}
      <div className="hidden lg:flex items-center gap-3 border-l border-slate-800 pl-3">
        <button
          onClick={() => {
            const next = !metronome;
            setMetronome(next);
            AudioEngine.setMetronomeEnabled(next);
          }}
          className={`px-2.5 py-1 text-xs font-bold rounded-md border cursor-pointer transition-all ${
            metronome
              ? 'bg-indigo-600/15 border-indigo-500/40 text-indigo-400'
              : 'bg-transparent border-slate-850 text-slate-500 hover:text-slate-300'
          }`}
        >
          METRO
        </button>

        <button
          onClick={() => {
            const next = !loopEnabled;
            setLoopEnabled(next);
            AudioEngine.setLoopEnabled(next, loopLength);
          }}
          className={`px-2.5 py-1 text-xs font-bold rounded-md border cursor-pointer transition-all ${
            loopEnabled
              ? 'bg-indigo-600/15 border-indigo-500/40 text-indigo-400'
              : 'bg-transparent border-slate-850 text-slate-500 hover:text-slate-300'
          }`}
        >
          LOOP
        </button>
      </div>

      {/* 3. LCD Display: Tempo, Time Signatures, Position */}
      <div className="flex items-center gap-3 bg-slate-950 border border-slate-900 rounded-xl px-4 py-1.5 font-mono shadow-inner">
        {/* BPM Counter */}
        <form onSubmit={handleBpmSubmit} className="flex items-center gap-1.5 border-r border-slate-800 pr-3">
          <span className="text-[10px] text-indigo-400 font-bold uppercase tracking-wider">BPM</span>
          <input
            type="text"
            value={bpmInput}
            onChange={(e) => setBpmInput(e.target.value)}
            onBlur={handleBpmSubmit}
            className="w-12 text-center bg-transparent border-none font-bold text-white text-sm focus:outline-none"
          />
        </form>

        {/* Beats Position Display */}
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-indigo-400 font-bold uppercase tracking-wider">POS</span>
          <span className="text-sm font-black text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.15)] select-all">
            {position}
          </span>
        </div>
      </div>

      {/* 4. Microphone Monitoring Controls */}
      <div className="flex items-center gap-3 border-l border-slate-800 pl-3">
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleMicToggle}
            className={`p-1.5 rounded-lg flex items-center justify-center border cursor-pointer transition-colors ${
              micEnabled
                ? 'bg-emerald-600/10 border-emerald-500/30 text-emerald-400 font-bold shadow-lg shadow-emerald-600/5'
                : 'bg-transparent border-slate-850 text-slate-500 hover:text-slate-300'
            }`}
            title="Enable Microphone Monitoring"
          >
            <Mic className="h-4 w-4" />
          </button>
          
          <button
            onClick={handleMonitorToggle}
            disabled={!micEnabled}
            className={`px-2 py-1 text-[10px] font-bold rounded border transition-colors ${
              !micEnabled
                ? 'border-slate-850 text-slate-700 cursor-not-allowed'
                : monitoringEnabled
                ? 'bg-indigo-600/10 border-indigo-500/30 text-indigo-400 cursor-pointer'
                : 'bg-transparent border-slate-800 text-slate-500 hover:text-slate-300 cursor-pointer'
            }`}
            title="Live Monitoring (Use Headphones!)"
          >
            MONITOR
          </button>
        </div>

        <div className="w-16 flex items-center gap-1">
          <Volume2 className="h-3 w-3 text-slate-500" />
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={micGain}
            disabled={!micEnabled}
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              setMicGain(val);
              AudioEngine.setMicGain(val);
            }}
            className="w-full accent-indigo-500 h-1 bg-slate-900 rounded-lg cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
          />
        </div>

        <select
          value={recordingMode}
          onChange={(e: any) => setRecordingMode(e.target.value)}
          className="bg-slate-900 border border-slate-800 px-2 py-1 rounded text-[10px] font-semibold focus:outline-none"
        >
          <option value="vocals">Vocals Only</option>
          <option value="mix">Beat + Vocals</option>
        </select>
      </div>

      {/* 5. Master Output Peak Level Meter */}
      <div className="flex items-center gap-2 border-l border-slate-800 pl-3">
        {statusMsg && (
          <span className="text-[10px] font-semibold text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 px-2 py-1 rounded-lg max-w-[160px] truncate hidden xl:inline">
            {statusMsg}
          </span>
        )}
        <Activity className="h-3.5 w-3.5 text-indigo-500 hidden sm:block" />
        <div className="flex flex-col gap-1 w-24 sm:w-32">
          {/* LED meter strip */}
          <div className="h-2 w-full bg-slate-950 rounded border border-slate-900 relative overflow-hidden">
            <div
              className="h-full meter-fill-horizontal transition-all duration-75"
              style={{ width: `${peakPercent}%` }}
            />
          </div>
          <div className="flex justify-between text-[8px] font-mono text-slate-500 font-bold leading-none">
            <span>-60dB</span>
            <span>-18</span>
            <span>-6</span>
            <span>0</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
