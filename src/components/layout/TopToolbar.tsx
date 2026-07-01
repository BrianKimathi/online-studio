import React, { useRef, useState, useEffect } from 'react';
import { useProjectStore } from '../../stores/useProjectStore';
import { useUIStore } from '../../stores/useUIStore';
import { useSequencerStore } from '../../stores/useSequencerStore';
import { useTransportStore } from '../../stores/useTransportStore';
import { AudioEngine } from '../../audio/engine';
import { DrumPadId } from '../../types';
import { 
  Save, 
  Undo2, 
  Redo2, 
  Upload, 
  Download, 
  Settings, 
  User, 
  Music,
  Activity
} from 'lucide-react';

const AudioStatus: React.FC = () => {
  const [init, setInit] = useState(false);
  const [state, setState] = useState('unknown');

  useEffect(() => {
    const checkState = () => {
      setInit(AudioEngine.isInit());
      setState(AudioEngine.getContextState());
    };
    checkState();
    const interval = setInterval(checkState, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleInitClick = async () => {
    await AudioEngine.init();
    setInit(AudioEngine.isInit());
    setState(AudioEngine.getContextState());
  };

  return (
    <button
      onClick={handleInitClick}
      className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded cursor-pointer transition-colors uppercase ${
        init && state === 'running'
          ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
          : init
          ? 'bg-yellow-500/10 border border-yellow-500/30 text-yellow-400'
          : 'bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20'
      }`}
      title={init ? 'Audio engine active. Click to retry.' : 'Click to initialize audio engine.'}
    >
      Audio: {init ? state : 'click to init'}
    </button>
  );
};

export const TopToolbar: React.FC = () => {
  const { projectName, setProjectName, saveProject, undo, redo, undoStack, redoStack } = useProjectStore();
  const { setShowSettingsModal, selectedPadId } = useUIStore();
  const { pads, setCustomSample } = useSequencerStore();
  const { loopLength, bpm } = useTransportStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [exporting, setExporting] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  // Auto-dismiss status messages
  useEffect(() => {
    if (!statusMsg) return;
    const t = setTimeout(() => setStatusMsg(null), 3500);
    return () => clearTimeout(t);
  }, [statusMsg]);

  const handleImportSampleClick = () => {
    if (fileInputRef.current) fileInputRef.current.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    e.target.value = '';

    const blobUrl = URL.createObjectURL(file);
    // Assign to the currently selected drum pad and wire the engine player
    // so it actually plays back (store update alone is not enough).
    const targetPad: DrumPadId = selectedPadId;
    setCustomSample(targetPad, blobUrl, file.name);
    AudioEngine.setCustomSample(targetPad, blobUrl);
    const padName = pads.find((p) => p.id === targetPad)?.name ?? targetPad;
    setStatusMsg(`Loaded "${file.name}" onto ${padName} pad`);
  };

  const handleExportWav = async () => {
    if (exporting) return;
    setExporting(true);
    setStatusMsg('Rendering mix to WAV…');
    try {
      await AudioEngine.init();
      const blob = await AudioEngine.exportMix(loopLength, bpm);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${projectName.toLowerCase().replace(/\s+/g, '_')}_mix.wav`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setStatusMsg('Mix exported successfully!');
    } catch (err) {
      console.error(err);
      setStatusMsg('Export failed — see console.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <header className="h-14 w-full bg-[#0a0f1d] border-b border-slate-900 flex items-center justify-between px-4 z-40 select-none">
      {/* Brand & Project Info */}
      <div className="flex items-center gap-3">
        <div className="h-8 w-8 rounded-lg bg-gradient-to-tr from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
          <Activity className="h-4 w-4 text-white animate-pulse" />
        </div>
        <span className="text-sm font-extrabold tracking-tight text-white hidden sm:inline">
          Online<span className="text-indigo-400">Studio</span>
        </span>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            className="bg-transparent border-0 hover:bg-slate-800/40 focus:bg-slate-800/80 focus:ring-1 focus:ring-slate-700 font-semibold text-white px-2 py-1 rounded text-sm w-44 focus:outline-none transition-all"
            placeholder="Project Name"
          />
          <span className="text-[10px] bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 px-1.5 py-0.5 rounded-full font-medium">
            v1.0
          </span>
          <AudioStatus />
        </div>
      </div>

      {/* Center Controls (Quick Actions) */}
      <div className="flex items-center gap-1.5 bg-slate-900/40 border border-slate-900 px-1.5 py-1 rounded-xl">
        <button
          onClick={saveProject}
          title="Save Project (IndexedDB)"
          className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-indigo-400 active:bg-slate-900 rounded-lg cursor-pointer transition-colors"
        >
          <Save className="h-4.5 w-4.5" />
        </button>
        <div className="w-px h-4 bg-slate-800 mx-1" />
        
        <button
          onClick={undo}
          disabled={undoStack.length === 0}
          title="Undo"
          className={`p-1.5 rounded-lg transition-colors ${
            undoStack.length === 0 
              ? 'text-slate-600 cursor-not-allowed' 
              : 'hover:bg-slate-800 text-slate-400 hover:text-white cursor-pointer active:bg-slate-900'
          }`}
        >
          <Undo2 className="h-4.5 w-4.5" />
        </button>
        <button
          onClick={redo}
          disabled={redoStack.length === 0}
          title="Redo"
          className={`p-1.5 rounded-lg transition-colors ${
            redoStack.length === 0 
              ? 'text-slate-600 cursor-not-allowed' 
              : 'hover:bg-slate-800 text-slate-400 hover:text-white cursor-pointer active:bg-slate-900'
          }`}
        >
          <Redo2 className="h-4.5 w-4.5" />
        </button>
      </div>

      {/* Right Controls (Settings & Import/Export) */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          {/* Hidden File Input */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="audio/*"
            className="hidden"
          />
          <button
            onClick={handleImportSampleClick}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 active:bg-slate-950 border border-slate-800/80 text-xs font-semibold text-slate-300 hover:text-white transition-all cursor-pointer"
          >
            <Upload className="h-3.5 w-3.5" />
            Import Sample
          </button>
          
          <button
            onClick={handleExportWav}
            disabled={exporting}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white shadow-lg shadow-indigo-600/15 transition-all cursor-pointer ${
              exporting ? 'bg-indigo-800 cursor-wait opacity-70' : 'bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700'
            }`}
          >
            <Download className="h-3.5 w-3.5" />
            {exporting ? 'Rendering…' : 'Export Mix'}
          </button>
          {statusMsg && (
            <span className="text-[10px] font-semibold text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 px-2 py-1 rounded-lg max-w-[200px] truncate">
              {statusMsg}
            </span>
          )}
        </div>

        <div className="w-px h-6 bg-slate-800" />

        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowSettingsModal(true)}
            className="p-2 hover:bg-slate-900 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
            title="Settings"
          >
            <Settings className="h-4.5 w-4.5" />
          </button>
          
          <button
            className="flex items-center gap-1.5 p-1.5 pr-2.5 hover:bg-slate-900 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer"
            title="User Profile"
          >
            <div className="h-6 w-6 rounded-full bg-slate-800 flex items-center justify-center overflow-hidden border border-slate-700">
              <User className="h-3.5 w-3.5 text-slate-400" />
            </div>
            <span className="text-xs font-semibold hidden md:inline">Producer</span>
          </button>
        </div>
      </div>
    </header>
  );
};
