import { create } from 'zustand';

interface TransportState {
  isPlaying: boolean;
  isRecording: boolean;
  bpm: number;
  swing: number;
  metronome: boolean;
  loopEnabled: boolean;
  loopLength: number; // in bars, e.g. 1, 2, 4, 8
  position: string; // "bars:beats:sixteenths"
  activeStep: number; // 0-15 (or up to 63)
  
  setPlaying: (isPlaying: boolean) => void;
  setRecording: (isRecording: boolean) => void;
  setBpm: (bpm: number) => void;
  setSwing: (swing: number) => void;
  setMetronome: (enabled: boolean) => void;
  setLoopEnabled: (enabled: boolean) => void;
  setLoopLength: (length: number) => void;
  setPosition: (position: string) => void;
  setActiveStep: (step: number) => void;
  reset: () => void;
}

export const useTransportStore = create<TransportState>((set) => ({
  isPlaying: false,
  isRecording: false,
  bpm: 120,
  swing: 0,
  metronome: false,
  loopEnabled: true,
  loopLength: 4,
  position: '0:0:0',
  activeStep: 0,

  setPlaying: (isPlaying) => set({ isPlaying }),
  setRecording: (isRecording) => set({ isRecording }),
  setBpm: (bpm) => set({ bpm }),
  setSwing: (swing) => set({ swing }),
  setMetronome: (metronome) => set({ metronome }),
  setLoopEnabled: (loopEnabled) => set({ loopEnabled }),
  setLoopLength: (loopLength) => set({ loopLength }),
  setPosition: (position) => set({ position }),
  setActiveStep: (activeStep) => set({ activeStep }),
  reset: () => set({ isPlaying: false, isRecording: false, position: '0:0:0', activeStep: 0 }),
}));
