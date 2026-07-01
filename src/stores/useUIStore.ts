import { create } from 'zustand';
import { DrumPadId } from '../types';

export type WorkspaceTab = 'drums' | 'sequencer' | 'piano-roll' | 'timeline' | 'mixer' | 'voice-editor';
export type SidebarTab = 'drum-kits' | 'instruments' | 'samples' | 'effects' | 'projects' | 'favorites';

interface UIState {
  activeWorkspaceTab: WorkspaceTab;
  activeSidebarTab: SidebarTab;
  rightPanelOpen: boolean;
  showSettingsModal: boolean;
  sidebarSearchQuery: string;
  selectedPadId: DrumPadId;
  
  setActiveWorkspaceTab: (tab: WorkspaceTab) => void;
  setActiveSidebarTab: (tab: SidebarTab) => void;
  setRightPanelOpen: (open: boolean) => void;
  setShowSettingsModal: (show: boolean) => void;
  setSidebarSearchQuery: (query: string) => void;
  setSelectedPadId: (id: DrumPadId) => void;
}

export const useUIStore = create<UIState>((set) => ({
  activeWorkspaceTab: 'drums',
  activeSidebarTab: 'drum-kits',
  rightPanelOpen: true,
  showSettingsModal: false,
  sidebarSearchQuery: '',
  selectedPadId: 'kick',

  setActiveWorkspaceTab: (activeWorkspaceTab) => set({ activeWorkspaceTab }),
  setActiveSidebarTab: (activeSidebarTab) => set({ activeSidebarTab }),
  setRightPanelOpen: (rightPanelOpen) => set({ rightPanelOpen }),
  setShowSettingsModal: (showSettingsModal) => set({ showSettingsModal }),
  setSidebarSearchQuery: (sidebarSearchQuery) => set({ sidebarSearchQuery }),
  setSelectedPadId: (selectedPadId) => set({ selectedPadId })
}));
