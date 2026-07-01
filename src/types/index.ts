// Types for the Online DAW Studio

export type DrumPadId =
  | 'kick'
  | 'snare'
  | 'clap'
  | 'closedHat'
  | 'openHat'
  | 'tom'
  | 'crash'
  | 'ride'
  | '808'
  | 'fx';

export interface DrumPadConfig {
  id: DrumPadId;
  name: string;
  key: string; // Keyboard mapping key (e.g., 'a', 's', 'd')
  volume: number; // 0 to 1
  pan: number; // -1 to 1
  pitch: number; // -12 to 12 semitones
  mute: boolean;
  solo: boolean;
  userSampleUrl?: string; // Custom uploaded sample data URL or Blob URL
  userSampleName?: string;
}

export type SequencerStep = {
  active: boolean;
  velocity: number; // 0 to 1
};

export interface Pattern {
  id: string;
  name: string;
  // Map of drum pad ID to array of steps (e.g., 16, 32, or 64 steps)
  steps: Record<DrumPadId, SequencerStep[]>;
}

export interface Note {
  id: string;
  pitch: string; // e.g. "C4", "D#3"
  time: number; // Start time in seconds or ticks
  duration: number; // Duration in seconds or ticks
  velocity: number; // 0 to 1
}

export interface InstrumentPreset {
  id: string;
  name: string;
  type: 'synth' | 'fm' | 'am' | 'mono';
  envelope: {
    attack: number;
    decay: number;
    sustain: number;
    release: number;
  };
  filter: {
    cutoff: number;
    resonance: number;
    type: 'lowpass' | 'highpass' | 'bandpass';
  };
}

export type EffectType =
  | 'reverb'
  | 'delay'
  | 'compressor'
  | 'limiter'
  | 'chorus'
  | 'distortion'
  | 'eq3'
  | 'gate'
  | 'tremolo';

export interface EffectConfig {
  id: string;
  type: EffectType;
  bypass: boolean;
  params: Record<string, number | string | boolean>;
}

export interface MixerChannel {
  id: string; // Pad ID or 'synth' or 'vocals' or 'master'
  name: string;
  volume: number; // in dB (-60 to +6)
  pan: number; // -1 to 1
  mute: boolean;
  solo: boolean;
  effects: EffectConfig[];
  eq: {
    low: number; // -12 to +12 dB
    mid: number;
    high: number;
  };
  sendReverb: number; // 0 to 1
  sendDelay: number; // 0 to 1
}

export interface RecordingTake {
  id: string;
  name: string;
  timestamp: number;
  duration: number;
  blobUrl: string;
  type: 'vocals' | 'master' | 'mix';
}

export interface AudioClip {
  id: string;
  trackId: string;
  name: string;
  startTime: number; // in seconds on timeline
  duration: number; // in seconds
  blobUrl: string;
  offset: number; // offset within the audio file in seconds
  gain: number; // 0 to 2 (multiplier)
}

export interface MidiClip {
  id: string;
  trackId: string;
  name: string;
  startTime: number; // in bars/beats or seconds
  duration: number;
  notes: Note[];
}

export interface TimelineTrack {
  id: string;
  name: string;
  type: 'drums' | 'synth' | 'audio';
  color: string; // hex or Tailwind color class
  volume: number;
  pan: number;
  mute: boolean;
  solo: boolean;
}

export interface Project {
  id: string;
  name: string;
  bpm: number;
  swing: number;
  loopLength: number; // in bars (e.g. 1, 2, 4, 8)
  patterns: Pattern[];
  activePatternId: string;
  pads: DrumPadConfig[];
  notes: Note[]; // Piano roll notes for synth
  instrumentPreset: InstrumentPreset;
  activeInstrument: 'synth' | 'fm' | 'am' | 'mono';
  tracks: TimelineTrack[];
  audioClips: AudioClip[];
  midiClips: MidiClip[];
  mixerChannels: MixerChannel[];
  takes: RecordingTake[];
  createdAt: number;
  modifiedAt: number;
}

