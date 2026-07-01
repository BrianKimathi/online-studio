import React, { useEffect } from 'react';
import { TopToolbar } from './TopToolbar';
import { LeftSidebar } from './LeftSidebar';
import { CenterWorkspace } from './CenterWorkspace';
import { RightPanel } from './RightPanel';
import { BottomTransport } from './BottomTransport';
import { useUIStore } from '../../stores/useUIStore';
import { useProjectStore } from '../../stores/useProjectStore';
import { useTransportStore } from '../../stores/useTransportStore';
import { useSequencerStore } from '../../stores/useSequencerStore';
import { usePianoRollStore } from '../../stores/usePianoRollStore';
import { useMixerStore } from '../../stores/useMixerStore';
import { useRecordingStore } from '../../stores/useRecordingStore';
import { AudioEngine } from '../../audio/engine';

export const AppShell: React.FC = () => {
  const { rightPanelOpen, showSettingsModal, setShowSettingsModal } = useUIStore();
  const { projectName, setProjectName, undo, redo } = useProjectStore();

  // Expose stores to window so AudioEngine can query them
  useEffect(() => {
    (window as any)._transportStore = useTransportStore;
    (window as any)._sequencerStore = useSequencerStore;
    (window as any)._pianoRollStore = usePianoRollStore;
    (window as any)._mixerStore = useMixerStore;
    (window as any)._recordingStore = useRecordingStore;
    (window as any)._projectStore = useProjectStore;
  }, []);

  // Initialize audio engine on first click
  useEffect(() => {
    const handleGesture = async () => {
      await AudioEngine.init();
      window.removeEventListener('click', handleGesture);
      window.removeEventListener('keydown', handleGesture);
    };
    window.addEventListener('click', handleGesture);
    window.addEventListener('keydown', handleGesture);
    return () => {
      window.removeEventListener('click', handleGesture);
      window.removeEventListener('keydown', handleGesture);
    };
  }, []);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#070b13] text-slate-200 select-none">
      {/* Top Header Toolbar */}
      <TopToolbar />

      {/* Main Grid: Sidebar, Center Workspace, Right Panel */}
      <div className="flex flex-1 overflow-hidden relative">
        <LeftSidebar />
        
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-[#090e18] border-r border-slate-900">
          <CenterWorkspace />
        </div>

        {rightPanelOpen && <RightPanel />}
      </div>

      {/* Bottom Transport Controls */}
      <BottomTransport />

      {/* Settings Modal */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md p-6 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl">
            <h2 className="text-xl font-bold text-white mb-4">DAW Settings</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Project Name</label>
                <input
                  type="text"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg focus:outline-none focus:border-indigo-500 text-white"
                />
              </div>
              <div className="pt-2">
                <h3 className="text-sm font-semibold text-slate-300 mb-2">Keyboard Shortcuts</h3>
                <div className="grid grid-cols-2 gap-2 text-xs text-slate-400 bg-slate-950 p-3 rounded-lg border border-slate-800 max-h-40 overflow-y-auto">
                  <div className="font-semibold text-slate-300">Spacebar</div><div>Play / Stop</div>
                  <div className="font-semibold text-slate-300">R</div><div>Toggle Record</div>
                  <div className="font-semibold text-slate-300">M</div><div>Toggle Metronome</div>
                  <div className="font-semibold text-slate-300">Ctrl + Z</div><div>Undo</div>
                  <div className="font-semibold text-slate-300">Ctrl + Y</div><div>Redo</div>
                  <div className="font-semibold text-slate-300">A - ; Keys</div><div>Play Drum Pads</div>
                </div>
              </div>
            </div>
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShowSettingsModal(false)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors cursor-pointer"
              >
                Close Settings
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
