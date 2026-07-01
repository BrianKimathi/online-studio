import { create } from 'zustand';
import { Project, Pattern, Note, MixerChannel, TimelineTrack, AudioClip, MidiClip } from '../types';

interface ProjectListItem {
  id: string;
  name: string;
  bpm: number;
  modifiedAt: number;
}

interface ProjectState {
  currentProjectId: string;
  projectName: string;
  projectList: ProjectListItem[];
  undoStack: string[]; // JSON representations of state
  redoStack: string[]; // JSON representations of state
  
  setProjectName: (name: string) => void;
  newProject: () => void;
  saveProject: () => void;
  loadProject: (id: string) => void;
  deleteProject: (id: string) => void;
  duplicateProject: (id: string) => void;
  refreshProjectList: () => void;
  
  // History Undo/Redo
  pushHistory: () => void;
  undo: () => void;
  redo: () => void;
}

// Key for index of projects
const STORAGE_PREFIX = 'daw_project_';
const LIST_KEY = 'daw_project_list';

const getSavedList = (): ProjectListItem[] => {
  try {
    const listStr = localStorage.getItem(LIST_KEY);
    return listStr ? JSON.parse(listStr) : [];
  } catch (e) {
    return [];
  }
};

export const useProjectStore = create<ProjectState>((set, get) => ({
  currentProjectId: 'default-proj',
  projectName: 'Cybernetic Beats',
  projectList: getSavedList(),
  undoStack: [],
  redoStack: [],

  setProjectName: (projectName) => {
    set({ projectName });
    // Push history when project name changes
    get().pushHistory();
  },

  refreshProjectList: () => {
    set({ projectList: getSavedList() });
  },

  newProject: () => {
    const newId = `proj-${Date.now()}`;
    set({
      currentProjectId: newId,
      projectName: 'New Project',
      undoStack: [],
      redoStack: []
    });

    // We also need to reset other stores (sequencer, piano roll, mixer, recording, transport)
    // The App or AudioEngine can trigger resets, but let's define resets in those stores
    // and let the component layer trigger them or trigger them inside App.tsx
  },

  saveProject: () => {
    const { currentProjectId, projectName } = get();
    
    // Dynamically query other stores to construct the full project object
    // We can resolve stores from import or dynamically inside components
    // Let's resolve them by importing the stores
    const { bpm, swing, loopLength } = (window as any)._transportStore?.getState?.() || { bpm: 120, swing: 0, loopLength: 4 };
    const { patterns, activePatternId, pads } = (window as any)._sequencerStore?.getState?.() || { patterns: [], activePatternId: '', pads: [] };
    const { notes, instrumentPreset, activeInstrument } = (window as any)._pianoRollStore?.getState?.() || { notes: [], instrumentPreset: null, activeInstrument: 'synth' };
    const { channels } = (window as any)._mixerStore?.getState?.() || { channels: [] };
    const { clips, tracks, takes, midiClips } = (window as any)._recordingStore?.getState?.() || { clips: [], tracks: [], takes: [], midiClips: [] };

    const projectData: Project = {
      id: currentProjectId,
      name: projectName,
      bpm,
      swing,
      loopLength,
      patterns,
      activePatternId,
      pads,
      notes,
      instrumentPreset,
      activeInstrument,
      tracks,
      audioClips: clips,
      midiClips,
      mixerChannels: channels,
      takes,
      createdAt: Date.now(),
      modifiedAt: Date.now()
    };

    try {
      localStorage.setItem(`${STORAGE_PREFIX}${currentProjectId}`, JSON.stringify(projectData));
      
      // Update list
      const list = getSavedList();
      const existingIdx = list.findIndex(p => p.id === currentProjectId);
      const listItem: ProjectListItem = {
        id: currentProjectId,
        name: projectName,
        bpm,
        modifiedAt: Date.now()
      };

      if (existingIdx >= 0) {
        list[existingIdx] = listItem;
      } else {
        list.push(listItem);
      }
      
      localStorage.setItem(LIST_KEY, JSON.stringify(list));
      set({ projectList: list });
    } catch (e) {
      console.error('Failed to save project:', e);
    }
  },

  loadProject: (id) => {
    try {
      const projStr = localStorage.getItem(`${STORAGE_PREFIX}${id}`);
      if (!projStr) return;
      
      const project: Project = JSON.parse(projStr);
      
      set({
        currentProjectId: project.id,
        projectName: project.name,
        undoStack: [],
        redoStack: []
      });

      // Restore states into other stores
      if ((window as any)._transportStore) {
        const { setBpm, setSwing, setLoopLength } = (window as any)._transportStore.getState();
        setBpm(project.bpm);
        setSwing(project.swing || 0);
        setLoopLength(project.loopLength || 4);
      }
      
      if ((window as any)._sequencerStore) {
        const { loadProjectData } = (window as any)._sequencerStore.getState();
        loadProjectData(project.patterns, project.activePatternId, project.pads || []);
      }
      
      if ((window as any)._pianoRollStore) {
        const { loadNotesData } = (window as any)._pianoRollStore.getState();
        loadNotesData(project.notes, project.instrumentPreset || (project as any).preset, (project as any).activeInstrument || 'synth');
      }
      
      if ((window as any)._mixerStore) {
        const { loadMixerData } = (window as any)._mixerStore.getState();
        loadMixerData(project.mixerChannels);
      }
      
      if ((window as any)._recordingStore) {
        const { loadRecordingData } = (window as any)._recordingStore.getState();
        loadRecordingData(project.takes || [], project.audioClips || [], project.tracks || [], project.midiClips || []);
      }

    } catch (e) {
      console.error('Failed to load project:', e);
    }
  },

  deleteProject: (id) => {
    try {
      localStorage.removeItem(`${STORAGE_PREFIX}${id}`);
      const list = getSavedList().filter(p => p.id !== id);
      localStorage.setItem(LIST_KEY, JSON.stringify(list));
      set({ projectList: list });
      
      if (get().currentProjectId === id) {
        get().newProject();
      }
    } catch (e) {
      console.error('Failed to delete project:', e);
    }
  },

  duplicateProject: (id) => {
    try {
      const projStr = localStorage.getItem(`${STORAGE_PREFIX}${id}`);
      if (!projStr) return;
      
      const project: Project = JSON.parse(projStr);
      const newId = `proj-${Date.now()}`;
      project.id = newId;
      project.name = `${project.name} (Copy)`;
      project.createdAt = Date.now();
      project.modifiedAt = Date.now();

      localStorage.setItem(`${STORAGE_PREFIX}${newId}`, JSON.stringify(project));
      
      const list = getSavedList();
      list.push({
        id: newId,
        name: project.name,
        bpm: project.bpm,
        modifiedAt: Date.now()
      });
      localStorage.setItem(LIST_KEY, JSON.stringify(list));
      
      set({ projectList: list });
    } catch (e) {
      console.error('Failed to duplicate project:', e);
    }
  },

  pushHistory: () => {
    // Collect snapshot of stores to push to undo stack
    const bpmState = (window as any)._transportStore?.getState?.() || {};
    const seqState = (window as any)._sequencerStore?.getState?.() || {};
    const pianoState = (window as any)._pianoRollStore?.getState?.() || {};
    const mixerState = (window as any)._mixerStore?.getState?.() || {};
    const recState = (window as any)._recordingStore?.getState?.() || {};

    const snapshot = JSON.stringify({
      projectName: get().projectName,
      bpm: bpmState.bpm,
      swing: bpmState.swing,
      loopLength: bpmState.loopLength,
      patterns: seqState.patterns,
      activePatternId: seqState.activePatternId,
      pads: seqState.pads,
      notes: pianoState.notes,
      instrumentPreset: pianoState.instrumentPreset,
      activeInstrument: pianoState.activeInstrument,
      channels: mixerState.channels,
      clips: recState.clips,
      tracks: recState.tracks,
      takes: recState.takes,
      midiClips: recState.midiClips
    });

    set((state) => {
      // Limit history stack size to 50
      const newUndo = [...state.undoStack, snapshot];
      if (newUndo.length > 50) newUndo.shift();
      return {
        undoStack: newUndo,
        redoStack: [] // Clear redo stack on new action
      };
    });
  },

  undo: () => {
    const { undoStack, redoStack } = get();
    if (undoStack.length === 0) return;

    // Collect current state to push to redo stack
    const bpmState = (window as any)._transportStore?.getState?.() || {};
    const seqState = (window as any)._sequencerStore?.getState?.() || {};
    const pianoState = (window as any)._pianoRollStore?.getState?.() || {};
    const mixerState = (window as any)._mixerStore?.getState?.() || {};
    const recState = (window as any)._recordingStore?.getState?.() || {};

    const currentSnapshot = JSON.stringify({
      projectName: get().projectName,
      bpm: bpmState.bpm,
      swing: bpmState.swing,
      loopLength: bpmState.loopLength,
      patterns: seqState.patterns,
      activePatternId: seqState.activePatternId,
      pads: seqState.pads,
      notes: pianoState.notes,
      instrumentPreset: pianoState.instrumentPreset,
      activeInstrument: pianoState.activeInstrument,
      channels: mixerState.channels,
      clips: recState.clips,
      tracks: recState.tracks,
      takes: recState.takes,
      midiClips: recState.midiClips
    });

    const previousSnapshot = undoStack[undoStack.length - 1];
    const newUndoStack = undoStack.slice(0, -1);
    
    try {
      const state = JSON.parse(previousSnapshot);
      
      set({
        projectName: state.projectName,
        undoStack: newUndoStack,
        redoStack: [...redoStack, currentSnapshot]
      });

      // Restore states
      if ((window as any)._transportStore) {
        const { setBpm, setSwing, setLoopLength } = (window as any)._transportStore.getState();
        setBpm(state.bpm);
        setSwing(state.swing);
        setLoopLength(state.loopLength);
      }
      
      if ((window as any)._sequencerStore) {
        const { loadProjectData } = (window as any)._sequencerStore.getState();
        loadProjectData(state.patterns, state.activePatternId, state.pads);
      }
      
      if ((window as any)._pianoRollStore) {
        const { loadNotesData } = (window as any)._pianoRollStore.getState();
        loadNotesData(state.notes, state.instrumentPreset, state.activeInstrument);
      }
      
      if ((window as any)._mixerStore) {
        const { loadMixerData } = (window as any)._mixerStore.getState();
        loadMixerData(state.channels);
      }
      
      if ((window as any)._recordingStore) {
        const { loadRecordingData } = (window as any)._recordingStore.getState();
        loadRecordingData(state.takes, state.clips, state.tracks, state.midiClips);
      }
    } catch (e) {
      console.error('Failed to undo:', e);
    }
  },

  redo: () => {
    const { undoStack, redoStack } = get();
    if (redoStack.length === 0) return;

    // Collect current state to push to undo stack
    const bpmState = (window as any)._transportStore?.getState?.() || {};
    const seqState = (window as any)._sequencerStore?.getState?.() || {};
    const pianoState = (window as any)._pianoRollStore?.getState?.() || {};
    const mixerState = (window as any)._mixerStore?.getState?.() || {};
    const recState = (window as any)._recordingStore?.getState?.() || {};

    const currentSnapshot = JSON.stringify({
      projectName: get().projectName,
      bpm: bpmState.bpm,
      swing: bpmState.swing,
      loopLength: bpmState.loopLength,
      patterns: seqState.patterns,
      activePatternId: seqState.activePatternId,
      pads: seqState.pads,
      notes: pianoState.notes,
      instrumentPreset: pianoState.instrumentPreset,
      activeInstrument: pianoState.activeInstrument,
      channels: mixerState.channels,
      clips: recState.clips,
      tracks: recState.tracks,
      takes: recState.takes,
      midiClips: recState.midiClips
    });

    const nextSnapshot = redoStack[redoStack.length - 1];
    const newRedoStack = redoStack.slice(0, -1);

    try {
      const state = JSON.parse(nextSnapshot);

      set({
        projectName: state.projectName,
        undoStack: [...undoStack, currentSnapshot],
        redoStack: newRedoStack
      });

      // Restore states
      if ((window as any)._transportStore) {
        const { setBpm, setSwing, setLoopLength } = (window as any)._transportStore.getState();
        setBpm(state.bpm);
        setSwing(state.swing);
        setLoopLength(state.loopLength);
      }

      if ((window as any)._sequencerStore) {
        const { loadProjectData } = (window as any)._sequencerStore.getState();
        loadProjectData(state.patterns, state.activePatternId, state.pads);
      }

      if ((window as any)._pianoRollStore) {
        const { loadNotesData } = (window as any)._pianoRollStore.getState();
        loadNotesData(state.notes, state.instrumentPreset, state.activeInstrument);
      }

      if ((window as any)._mixerStore) {
        const { loadMixerData } = (window as any)._mixerStore.getState();
        loadMixerData(state.channels);
      }

      if ((window as any)._recordingStore) {
        const { loadRecordingData } = (window as any)._recordingStore.getState();
        loadRecordingData(state.takes, state.clips, state.tracks, state.midiClips);
      }
    } catch (e) {
      console.error('Failed to redo:', e);
    }
  }
}));
