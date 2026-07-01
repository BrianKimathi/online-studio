import { create } from 'zustand';
import { Note } from '../types';
import { InstrumentPresetId, INSTRUMENT_PRESETS } from '../audio/instrumentPresets';

export interface InstrumentTrack {
  id: string;
  name: string;
  presetId: InstrumentPresetId;
  color: string;
  notes: Note[];
  volume: number;   // 0..1
  pan: number;      // -1..1
  mute: boolean;
  // Optional imported audio sample (e.g. an 808 WAV). When present, the track
  // plays the sample (pitched via Tone.Sampler) instead of a synth preset.
  sampleUrl?: string;
  sampleName?: string;
}

interface InstrumentsState {
  tracks: InstrumentTrack[];
  activeTrackId: string;

  addTrack: (presetId: InstrumentPresetId, name?: string) => string;
  addSampleTrack: (presetId: InstrumentPresetId, sampleUrl: string, sampleName: string, name?: string) => string;
  removeTrack: (trackId: string) => void;
  setActiveTrack: (trackId: string) => void;
  renameTrack: (trackId: string, name: string) => void;
  setTrackPreset: (trackId: string, presetId: InstrumentPresetId) => void;
  setTrackVolume: (trackId: string, volume: number) => void;
  setTrackPan: (trackId: string, pan: number) => void;
  setTrackMute: (trackId: string, mute: boolean) => void;

  // Note editing (operates on the active track's pattern)
  addNote: (trackId: string, note: Omit<Note, 'id'>) => string;
  removeNote: (trackId: string, noteId: string) => void;
  updateNote: (trackId: string, noteId: string, updates: Partial<Note>) => void;
  clearNotes: (trackId: string) => void;

  loadTracks: (tracks: InstrumentTrack[]) => void;
}

const uid = () => `inst-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

// Seed with a Piano track so the piano roll is immediately usable.
const pianoPreset = INSTRUMENT_PRESETS.piano;
const initialTracks: InstrumentTrack[] = [
  {
    id: 'inst-piano',
    name: 'Piano',
    presetId: 'piano',
    color: pianoPreset.color,
    notes: [
      { id: 'n1', pitch: 'E4', time: 0.0, duration: 0.25, velocity: 0.8 },
      { id: 'n2', pitch: 'G4', time: 0.5, duration: 0.25, velocity: 0.8 },
      { id: 'n3', pitch: 'A4', time: 1.0, duration: 0.5, velocity: 0.9 },
    ],
    volume: 0.8,
    pan: 0,
    mute: false,
  },
];

export const useInstrumentsStore = create<InstrumentsState>((set) => ({
  tracks: initialTracks,
  activeTrackId: 'inst-piano',

  addTrack: (presetId, name) => {
    const id = uid();
    const def = INSTRUMENT_PRESETS[presetId];
    const track: InstrumentTrack = {
      id,
      name: name ?? def.name,
      presetId,
      color: def.color,
      notes: [],
      volume: 0.8,
      pan: 0,
      mute: false,
    };
    set((state) => ({ tracks: [...state.tracks, track], activeTrackId: id }));
    return id;
  },

  addSampleTrack: (presetId, sampleUrl, sampleName, name) => {
    const id = uid();
    const def = INSTRUMENT_PRESETS[presetId];
    const track: InstrumentTrack = {
      id,
      name: name ?? sampleName.replace(/\.[^.]+$/, ''),
      presetId,
      color: def.color,
      notes: [],
      volume: 0.8,
      pan: 0,
      mute: false,
      sampleUrl,
      sampleName,
    };
    set((state) => ({ tracks: [...state.tracks, track], activeTrackId: id }));
    return id;
  },

  removeTrack: (trackId) => set((state) => {
    if (state.tracks.length <= 1) return {};
    const tracks = state.tracks.filter((t) => t.id !== trackId);
    const activeTrackId = state.activeTrackId === trackId ? tracks[0].id : state.activeTrackId;
    return { tracks, activeTrackId };
  }),

  setActiveTrack: (activeTrackId) => set({ activeTrackId }),

  renameTrack: (trackId, name) => set((state) => ({
    tracks: state.tracks.map((t) => (t.id === trackId ? { ...t, name } : t)),
  })),

  setTrackPreset: (trackId, presetId) => set((state) => ({
    tracks: state.tracks.map((t) =>
      t.id === trackId
        ? { ...t, presetId, color: INSTRUMENT_PRESETS[presetId].color, name: t.name }
        : t
    ),
  })),

  setTrackVolume: (trackId, volume) => set((state) => ({
    tracks: state.tracks.map((t) => (t.id === trackId ? { ...t, volume } : t)),
  })),

  setTrackPan: (trackId, pan) => set((state) => ({
    tracks: state.tracks.map((t) => (t.id === trackId ? { ...t, pan } : t)),
  })),

  setTrackMute: (trackId, mute) => set((state) => ({
    tracks: state.tracks.map((t) => (t.id === trackId ? { ...t, mute } : t)),
  })),

  addNote: (trackId, noteData) => {
    const id = `note-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const newNote: Note = { ...noteData, id };
    set((state) => ({
      tracks: state.tracks.map((t) =>
        t.id === trackId ? { ...t, notes: [...t.notes, newNote] } : t
      ),
    }));
    return id;
  },

  removeNote: (trackId, noteId) => set((state) => ({
    tracks: state.tracks.map((t) =>
      t.id === trackId ? { ...t, notes: t.notes.filter((n) => n.id !== noteId) } : t
    ),
  })),

  updateNote: (trackId, noteId, updates) => set((state) => ({
    tracks: state.tracks.map((t) =>
      t.id === trackId
        ? { ...t, notes: t.notes.map((n) => (n.id === noteId ? { ...n, ...updates } : n)) }
        : t
    ),
  })),

  clearNotes: (trackId) => set((state) => ({
    tracks: state.tracks.map((t) => (t.id === trackId ? { ...t, notes: [] } : t)),
  })),

  loadTracks: (tracks) => set({ tracks, activeTrackId: tracks[0]?.id ?? '' }),
}));
