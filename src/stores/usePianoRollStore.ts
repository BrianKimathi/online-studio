import { create } from 'zustand';
import { Note, InstrumentPreset } from '../types';

interface PianoRollState {
  notes: Note[];
  selectedNoteIds: string[];
  activeInstrument: 'synth' | 'fm' | 'am' | 'mono';
  instrumentPreset: InstrumentPreset;
  snapValue: string; // '4n' | '8n' | '16n' | '32n' | 'off'
  
  addNote: (note: Omit<Note, 'id'>) => string;
  removeNote: (id: string) => void;
  updateNote: (id: string, updates: Partial<Note>) => void;
  selectNotes: (ids: string[]) => void;
  clearSelection: () => void;
  setInstrument: (type: 'synth' | 'fm' | 'am' | 'mono') => void;
  updatePreset: (updates: Partial<InstrumentPreset>) => void;
  setSnapValue: (snap: string) => void;
  clearNotes: () => void;
  loadNotesData: (notes: Note[], preset: InstrumentPreset, activeInstrument: 'synth' | 'fm' | 'am' | 'mono') => void;
}

const DEFAULT_PRESET: InstrumentPreset = {
  id: 'preset-default',
  name: 'Retro Lead',
  type: 'synth',
  envelope: {
    attack: 0.05,
    decay: 0.2,
    sustain: 0.6,
    release: 0.4
  },
  filter: {
    cutoff: 1200,
    resonance: 1.5,
    type: 'lowpass'
  }
};

// Initial melody placeholder to get the user started
const initialNotes: Note[] = [
  { id: 'note-1', pitch: 'E4', time: 0.0, duration: 0.25, velocity: 0.8 },
  { id: 'note-2', pitch: 'G4', time: 0.5, duration: 0.25, velocity: 0.8 },
  { id: 'note-3', pitch: 'A4', time: 1.0, duration: 0.5, velocity: 0.9 },
  { id: 'note-4', pitch: 'E4', time: 2.0, duration: 0.25, velocity: 0.8 },
  { id: 'note-5', pitch: 'G4', time: 2.5, duration: 0.25, velocity: 0.8 },
  { id: 'note-6', pitch: 'A4', time: 3.0, duration: 0.5, velocity: 0.9 }
];

export const usePianoRollStore = create<PianoRollState>((set) => ({
  notes: initialNotes,
  selectedNoteIds: [],
  activeInstrument: 'synth',
  instrumentPreset: DEFAULT_PRESET,
  snapValue: '16n',

  addNote: (noteData) => {
    const id = `note-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newNote: Note = {
      ...noteData,
      id
    };
    set((state) => ({
      notes: [...state.notes, newNote]
    }));
    return id;
  },

  removeNote: (id) => set((state) => ({
    notes: state.notes.filter((n) => n.id !== id),
    selectedNoteIds: state.selectedNoteIds.filter((nid) => nid !== id)
  })),

  updateNote: (id, updates) => set((state) => ({
    notes: state.notes.map((n) => (n.id === id ? { ...n, ...updates } : n))
  })),

  selectNotes: (selectedNoteIds) => set({ selectedNoteIds }),

  clearSelection: () => set({ selectedNoteIds: [] }),

  setInstrument: (activeInstrument) => set((state) => ({
    activeInstrument,
    instrumentPreset: {
      ...state.instrumentPreset,
      type: activeInstrument
    }
  })),

  updatePreset: (updates) => set((state) => ({
    instrumentPreset: {
      ...state.instrumentPreset,
      ...updates,
      envelope: {
        ...state.instrumentPreset.envelope,
        ...updates.envelope
      },
      filter: {
        ...state.instrumentPreset.filter,
        ...updates.filter
      }
    }
  })),

  setSnapValue: (snapValue) => set({ snapValue }),

  clearNotes: () => set({ notes: [], selectedNoteIds: [] }),

  loadNotesData: (notes, preset, activeInstrument) => set({
    notes,
    instrumentPreset: preset,
    activeInstrument
  })
}));
