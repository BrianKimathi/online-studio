import React from 'react';
import { useUIStore, WorkspaceTab } from '../../stores/useUIStore';
import { DrumMachine } from '../drumMachine/DrumMachine';
import { StepSequencer } from '../sequencer/StepSequencer';
import { PianoRoll } from '../pianoRoll/PianoRoll';
import { Timeline } from '../timeline/Timeline';
import { Mixer } from '../mixer/Mixer';
import { VoiceEditor } from '../voiceEditor/VoiceEditor';
import { 
  Grid, 
  Layers, 
  Music, 
  SlidersHorizontal, 
  PlaySquare,
  Mic
} from 'lucide-react';

export const CenterWorkspace: React.FC = () => {
  const { activeWorkspaceTab, setActiveWorkspaceTab } = useUIStore();

  const tabs: { id: WorkspaceTab; label: string; icon: React.ComponentType<any> }[] = [
    { id: 'drums', label: 'Drum Pads', icon: Grid },
    { id: 'sequencer', label: 'Step Sequencer', icon: PlaySquare },
    { id: 'piano-roll', label: 'Piano Roll', icon: Music },
    { id: 'timeline', label: 'Timeline Arrangement', icon: Layers },
    { id: 'mixer', label: 'Mixer', icon: SlidersHorizontal },
    { id: 'voice-editor', label: 'Voice Editor', icon: Mic }
  ];

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden select-none">
      {/* Workspace Tabs Header */}
      <div className="h-10 w-full bg-[#0a0f1d] border-b border-slate-900 flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-1">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveWorkspaceTab(id)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-t-lg text-xs font-semibold border-t border-x transition-all duration-150 cursor-pointer ${
                activeWorkspaceTab === id
                  ? 'bg-[#090e18] border-slate-900 text-indigo-400 font-bold border-b border-b-[#090e18]'
                  : 'bg-transparent border-transparent text-slate-500 hover:text-slate-300 hover:bg-slate-900/40'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{label}</span>
            </button>
          ))}
        </div>
        
        {/* Workspace Quick Status Info */}
        <div className="text-[10px] text-slate-500 font-medium font-mono hidden md:block">
          ENGINE: ONLINE | SAMPLE_RATE: 44.1kHz | BUFFERS: 256
        </div>
      </div>

      {/* Active Panel View */}
      <div className="flex-1 min-h-0 bg-[#090e18] relative overflow-hidden">
        {activeWorkspaceTab === 'drums' && <DrumMachine />}
        {activeWorkspaceTab === 'sequencer' && <StepSequencer />}
        {activeWorkspaceTab === 'piano-roll' && <PianoRoll />}
        {activeWorkspaceTab === 'timeline' && <Timeline />}
        {activeWorkspaceTab === 'mixer' && <Mixer />}
        {activeWorkspaceTab === 'voice-editor' && <VoiceEditor />}
      </div>
    </div>
  );
};
