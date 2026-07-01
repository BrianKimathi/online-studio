import { create } from 'zustand';
import { RecordingTake, AudioClip, TimelineTrack, MidiClip } from '../types';

interface RecordingState {
  micEnabled: boolean;
  monitoringEnabled: boolean;
  micGain: number; // 0 to 1
  recordingMode: 'beat' | 'vocals' | 'both';
  takes: RecordingTake[];
  clips: AudioClip[];
  midiClips: MidiClip[];
  tracks: TimelineTrack[];
  selectedClipId: string | null;
  
  // Auto-tune voice editor parameters
  autoTuneEnabled: boolean;
  autoTuneKey: string;
  autoTuneScale: 'major' | 'minor';
  autoTuneSpeed: number; // 0 to 100
  autoTunePitch: number; // -12 to 12 semitones

  setAutoTuneEnabled: (enabled: boolean) => void;
  setAutoTuneKey: (key: string) => void;
  setAutoTuneScale: (scale: 'major' | 'minor') => void;
  setAutoTuneSpeed: (speed: number) => void;
  setAutoTunePitch: (pitch: number) => void;

  setMicEnabled: (enabled: boolean) => void;
  setMonitoringEnabled: (enabled: boolean) => void;
  setMicGain: (gain: number) => void;
  setRecordingMode: (mode: 'beat' | 'vocals' | 'both') => void;
  addTake: (take: RecordingTake) => void;
  deleteTake: (takeId: string) => void;
  
  // Track arrangement timeline
  addClip: (clip: AudioClip) => void;
  removeClip: (clipId: string) => void;
  updateClip: (clipId: string, updates: Partial<AudioClip>) => void;
  selectClip: (clipId: string | null) => void;
  
  // Track settings
  updateTrack: (trackId: string, updates: Partial<TimelineTrack>) => void;
  
  clearAllRecordingData: () => void;
  loadRecordingData: (takes: RecordingTake[], clips: AudioClip[], tracks: TimelineTrack[], midiClips: MidiClip[]) => void;
}

const DEFAULT_TRACKS: TimelineTrack[] = [
  { id: 'drums', name: 'Drums (Sequencer)', type: 'drums', color: '#8b5cf6', volume: 0.8, pan: 0, mute: false, solo: false },
  { id: 'synth', name: 'Synthesizer (MIDI)', type: 'synth', color: '#3b82f6', volume: 0.8, pan: 0, mute: false, solo: false },
  { id: 'vocals', name: 'Mic Recording (Audio)', type: 'audio', color: '#10b981', volume: 0.8, pan: 0, mute: false, solo: false }
];

export const useRecordingStore = create<RecordingState>((set) => ({
  micEnabled: false,
  monitoringEnabled: false,
  micGain: 0.7,
  recordingMode: 'vocals',
  takes: [],
  clips: [],
  midiClips: [],
  tracks: DEFAULT_TRACKS,
  selectedClipId: null,

  autoTuneEnabled: false,
  autoTuneKey: 'C',
  autoTuneScale: 'major',
  autoTuneSpeed: 50,
  autoTunePitch: 0,

  setAutoTuneEnabled: (autoTuneEnabled) => set({ autoTuneEnabled }),
  setAutoTuneKey: (autoTuneKey) => set({ autoTuneKey }),
  setAutoTuneScale: (autoTuneScale) => set({ autoTuneScale }),
  setAutoTuneSpeed: (autoTuneSpeed) => set({ autoTuneSpeed }),
  setAutoTunePitch: (autoTunePitch) => set({ autoTunePitch }),

  setMicEnabled: (micEnabled) => set({ micEnabled }),
  setMonitoringEnabled: (monitoringEnabled) => set({ monitoringEnabled }),
  setMicGain: (micGain) => set({ micGain }),
  setRecordingMode: (recordingMode) => set({ recordingMode }),
  
  addTake: (take) => set((state) => ({ takes: [...state.takes, take] })),
  
  deleteTake: (takeId) => set((state) => ({
    takes: state.takes.filter(t => t.id !== takeId)
  })),

  addClip: (clip) => set((state) => ({ clips: [...state.clips, clip] })),
  
  removeClip: (clipId) => set((state) => ({
    clips: state.clips.filter(c => c.id !== clipId),
    selectedClipId: state.selectedClipId === clipId ? null : state.selectedClipId
  })),

  updateClip: (clipId, updates) => set((state) => ({
    clips: state.clips.map((c) => c.id === clipId ? { ...c, ...updates } : c)
  })),

  selectClip: (selectedClipId) => set({ selectedClipId }),

  updateTrack: (trackId, updates) => set((state) => ({
    tracks: state.tracks.map((t) => t.id === trackId ? { ...t, ...updates } : t)
  })),

  clearAllRecordingData: () => set({ takes: [], clips: [], midiClips: [], selectedClipId: null }),

  loadRecordingData: (takes, clips, tracks, midiClips) => set({
    takes,
    clips,
    tracks,
    midiClips: midiClips || []
  })
}));
