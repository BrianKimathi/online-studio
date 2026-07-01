import { create } from 'zustand';
import { DrumPadConfig, DrumPadId, Pattern, SequencerStep } from '../types';
import { DrumKitId, Eight08Variant } from '../audio/drumKitPresets';

interface SequencerState {
  pads: DrumPadConfig[];
  patterns: Pattern[];
  activePatternId: string;
  stepCount: number; // 16, 32, 64
  
  toggleStep: (patternId: string, padId: DrumPadId, stepIndex: number) => void;
  setStepVelocity: (patternId: string, padId: DrumPadId, stepIndex: number, velocity: number) => void;
  updatePadConfig: (padId: DrumPadId, updates: Partial<DrumPadConfig>) => void;
  setActivePattern: (patternId: string) => void;
  setStepCount: (count: number) => void;
  addPattern: () => void;
  duplicatePattern: (patternId: string) => void;
  deletePattern: (patternId: string) => void;
  clearPattern: (patternId: string) => void;
  setCustomSample: (padId: DrumPadId, url: string, name: string) => void;
  loadProjectData: (patterns: Pattern[], activePatternId: string, pads: DrumPadConfig[]) => void;
  activeKit: DrumKitId;
  setActiveKit: (kitId: DrumKitId) => void;
  active808Variant: Eight08Variant;
  setActive808Variant: (variant: Eight08Variant) => void;
}

const DEFAULT_PADS: DrumPadConfig[] = [
  { id: 'kick', name: 'Kick', key: 'a', volume: 0.8, pan: 0, pitch: 0, mute: false, solo: false },
  { id: 'snare', name: 'Snare', key: 's', volume: 0.7, pan: 0, pitch: 0, mute: false, solo: false },
  { id: 'clap', name: 'Clap', key: 'd', volume: 0.6, pan: -0.1, pitch: 0, mute: false, solo: false },
  { id: 'closedHat', name: 'Closed Hat', key: 'f', volume: 0.65, pan: -0.2, pitch: 0, mute: false, solo: false },
  { id: 'openHat', name: 'Open Hat', key: 'g', volume: 0.55, pan: 0.2, pitch: 0, mute: false, solo: false },
  { id: 'tom', name: 'Tom', key: 'h', volume: 0.7, pan: -0.15, pitch: 0, mute: false, solo: false },
  { id: 'crash', name: 'Crash', key: 'j', volume: 0.5, pan: -0.3, pitch: 0, mute: false, solo: false },
  { id: 'ride', name: 'Ride', key: 'k', volume: 0.5, pan: 0.3, pitch: 0, mute: false, solo: false },
  { id: '808', name: '808 Bass', key: 'l', volume: 0.85, pan: 0, pitch: 0, mute: false, solo: false },
  { id: 'fx', name: 'FX Riser', key: ';', volume: 0.6, pan: 0.1, pitch: 0, mute: false, solo: false }
];

const createEmptySteps = (count: number): SequencerStep[] => 
  Array.from({ length: count }, () => ({ active: false, velocity: 0.8 }));

const createEmptyPattern = (id: string, name: string, stepCount: number): Pattern => {
  const steps: Record<DrumPadId, SequencerStep[]> = {} as any;
  const padIds: DrumPadId[] = ['kick', 'snare', 'clap', 'closedHat', 'openHat', 'tom', 'crash', 'ride', '808', 'fx'];
  padIds.forEach(padId => {
    steps[padId] = createEmptySteps(stepCount);
  });
  return { id, name, steps };
};

const initialPattern = createEmptyPattern('pat-1', 'Pattern 1', 16);

// Pre-fill a basic drum beat to make it engaging from start
initialPattern.steps.kick[0].active = true;
initialPattern.steps.kick[8].active = true;
initialPattern.steps.snare[4].active = true;
initialPattern.steps.snare[12].active = true;
initialPattern.steps.closedHat[2].active = true;
initialPattern.steps.closedHat[6].active = true;
initialPattern.steps.closedHat[10].active = true;
initialPattern.steps.closedHat[14].active = true;

export const useSequencerStore = create<SequencerState>((set) => ({
  pads: DEFAULT_PADS,
  patterns: [initialPattern],
  activePatternId: 'pat-1',
  stepCount: 16,
  activeKit: 'classic' as DrumKitId,
  active808Variant: 'sub' as Eight08Variant,

  toggleStep: (patternId, padId, stepIndex) => set((state) => ({
    patterns: state.patterns.map((p) => {
      if (p.id !== patternId) return p;
      const stepsForPad = [...p.steps[padId]];
      stepsForPad[stepIndex] = {
        ...stepsForPad[stepIndex],
        active: !stepsForPad[stepIndex].active
      };
      return {
        ...p,
        steps: {
          ...p.steps,
          [padId]: stepsForPad
        }
      };
    })
  })),

  setStepVelocity: (patternId, padId, stepIndex, velocity) => set((state) => ({
    patterns: state.patterns.map((p) => {
      if (p.id !== patternId) return p;
      const stepsForPad = [...p.steps[padId]];
      stepsForPad[stepIndex] = {
        ...stepsForPad[stepIndex],
        velocity
      };
      return {
        ...p,
        steps: {
          ...p.steps,
          [padId]: stepsForPad
        }
      };
    })
  })),

  updatePadConfig: (padId, updates) => set((state) => ({
    pads: state.pads.map((pad) => pad.id === padId ? { ...pad, ...updates } : pad)
  })),

  setActivePattern: (activePatternId) => set({ activePatternId }),

  setStepCount: (stepCount) => set((state) => {
    // Re-size all patterns to the new step count
    const updatedPatterns = state.patterns.map(p => {
      const updatedSteps = { ...p.steps };
      Object.keys(updatedSteps).forEach(key => {
        const padId = key as DrumPadId;
        const currentSteps = updatedSteps[padId];
        if (currentSteps.length < stepCount) {
          // grow
          updatedSteps[padId] = [
            ...currentSteps,
            ...createEmptySteps(stepCount - currentSteps.length)
          ];
        } else if (currentSteps.length > stepCount) {
          // shrink
          updatedSteps[padId] = currentSteps.slice(0, stepCount);
        }
      });
      return { ...p, steps: updatedSteps };
    });

    return { stepCount, patterns: updatedPatterns };
  }),

  addPattern: () => set((state) => {
    const newId = `pat-${Date.now()}`;
    const newIndex = state.patterns.length + 1;
    const newPattern = createEmptyPattern(newId, `Pattern ${newIndex}`, state.stepCount);
    return {
      patterns: [...state.patterns, newPattern],
      activePatternId: newId
    };
  }),

  duplicatePattern: (patternId) => set((state) => {
    const source = state.patterns.find(p => p.id === patternId);
    if (!source) return {};
    const newId = `pat-${Date.now()}`;
    
    // Deep clone steps
    const clonedSteps: Record<DrumPadId, SequencerStep[]> = {} as any;
    (Object.keys(source.steps) as DrumPadId[]).forEach(padId => {
      clonedSteps[padId] = source.steps[padId].map(step => ({ ...step }));
    });

    const duplicated: Pattern = {
      id: newId,
      name: `${source.name} (Copy)`,
      steps: clonedSteps
    };

    return {
      patterns: [...state.patterns, duplicated],
      activePatternId: newId
    };
  }),

  deletePattern: (patternId) => set((state) => {
    if (state.patterns.length <= 1) return {}; // Keep at least one pattern
    const newPatterns = state.patterns.filter(p => p.id !== patternId);
    const activePatternId = state.activePatternId === patternId ? newPatterns[0].id : state.activePatternId;
    return {
      patterns: newPatterns,
      activePatternId
    };
  }),

  clearPattern: (patternId) => set((state) => ({
    patterns: state.patterns.map(p => 
      p.id === patternId ? createEmptyPattern(p.id, p.name, state.stepCount) : p
    )
  })),

  setCustomSample: (padId, url, name) => set((state) => ({
    pads: state.pads.map(pad => 
      pad.id === padId 
        ? { ...pad, userSampleUrl: url, userSampleName: name } 
        : pad
    )
  })),

  loadProjectData: (patterns, activePatternId, pads) => set({
    patterns,
    activePatternId,
    pads
  }),

  setActiveKit: (activeKit) => set({ activeKit }),

  setActive808Variant: (active808Variant) => set({ active808Variant }),
}));
