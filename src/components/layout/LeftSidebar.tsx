import React, { useRef, useState } from 'react';
import { useUIStore, SidebarTab } from '../../stores/useUIStore';
import { usePianoRollStore } from '../../stores/usePianoRollStore';
import { useProjectStore } from '../../stores/useProjectStore';
import { useSequencerStore } from '../../stores/useSequencerStore';
import { useMixerStore } from '../../stores/useMixerStore';
import { AudioEngine } from '../../audio/engine';
import { DRUM_KIT_PRESETS, ALL_KIT_IDS, EIGHT08_VARIANTS, ALL_808_VARIANTS, DrumKitId, Eight08Variant } from '../../audio/drumKitPresets';
import { DrumPadId, EffectType } from '../../types';
import { 
  Grid, 
  Music, 
  FolderOpen, 
  Sliders, 
  FileAudio, 
  Heart, 
  Search,
  Plus,
  Check,
  Waves,
  Trash2
} from 'lucide-react';

interface SidebarItem {
  id: string;
  name: string;
  category: SidebarTab;
  action?: () => void;
  description?: string;
  selected?: boolean;
}

interface ImportedSample {
  id: string;
  name: string;
  url: string;
}

export const LeftSidebar: React.FC = () => {
  const { 
    activeSidebarTab, 
    setActiveSidebarTab, 
    sidebarSearchQuery, 
    setSidebarSearchQuery,
    selectedPadId,
    activeWorkspaceTab,
    setActiveWorkspaceTab
  } = useUIStore();
  
  const { setInstrument } = usePianoRollStore();
  const { projectList, loadProject, duplicateProject, deleteProject } = useProjectStore();
  const { activeKit, setActiveKit, active808Variant, setActive808Variant, pads, setCustomSample } = useSequencerStore();
  const { addEffect } = useMixerStore();

  const [importedSamples, setImportedSamples] = useState<ImportedSample[]>([]);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const sampleInputRef = useRef<HTMLInputElement>(null);

  const flashStatus = (msg: string) => {
    setStatusMsg(msg);
    setTimeout(() => setStatusMsg(null), 3000);
  };

  const categories: { tab: SidebarTab; label: string; icon: React.ComponentType<any> }[] = [
    { tab: 'drum-kits', label: 'Drum Kits', icon: Grid },
    { tab: 'instruments', label: 'Instruments', icon: Music },
    { tab: 'samples', label: 'Samples', icon: FileAudio },
    { tab: 'effects', label: 'Effects', icon: Sliders },
    { tab: 'projects', label: 'Projects', icon: FolderOpen },
    { tab: 'favorites', label: 'Favorites', icon: Heart }
  ];

  const handleKitSelect = async (kitId: DrumKitId) => {
    setActiveKit(kitId);
    await AudioEngine.setDrumKit(kitId);
    flashStatus(`Loaded ${DRUM_KIT_PRESETS[kitId].name} kit`);
  };

  const handle808Select = async (variant: Eight08Variant) => {
    setActive808Variant(variant);
    await AudioEngine.set808Variant(variant);
    flashStatus(`808 voice: ${EIGHT08_VARIANTS[variant].name}`);
  };

  // Pick a sensible target mixer strip from the current workspace context.
  const targetChannelForEffects = (): string => {
    if (activeWorkspaceTab === 'piano-roll') return 'synth';
    if (activeWorkspaceTab === 'voice-editor') return 'vocals';
    return 'drums';
  };

  const handleAddEffect = (type: EffectType, label: string) => {
    const channelId = targetChannelForEffects();
    const id = addEffect(channelId, type);
    AudioEngine.addChannelEffect(channelId, id, type, {});
    setActiveWorkspaceTab('mixer');
    flashStatus(`Added ${label} to ${channelId} channel`);
  };

  const handleAssignSample = (sample: ImportedSample) => {
    const padId: DrumPadId = selectedPadId;
    setCustomSample(padId, sample.url, sample.name);
    AudioEngine.setCustomSample(padId, sample.url);
    const padName = pads.find((p) => p.id === padId)?.name ?? padId;
    flashStatus(`Assigned "${sample.name}" to ${padName}`);
  };

  const handleImportSamples = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    e.target.value = '';
    const added: ImportedSample[] = [];
    for (const file of Array.from(files)) {
      const id = `smp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      added.push({ id, name: file.name, url: URL.createObjectURL(file) });
    }
    setImportedSamples((prev) => [...prev, ...added]);
    flashStatus(`Imported ${added.length} sample${added.length > 1 ? 's' : ''}`);
  };

  const handleRemoveSample = (id: string) => {
    setImportedSamples((prev) => prev.filter((s) => s.id !== id));
  };

  // Build the catalog dynamically. Drum kits + instruments are real; samples
  // come from the user's imported library; effects instantiate real Tone nodes.
  const catalogItems: SidebarItem[] = [
    // Real drum kits
    ...ALL_KIT_IDS.map((id) => {
      const kit = DRUM_KIT_PRESETS[id];
      return {
        id: `kit-${id}`,
        name: `${kit.name} Kit`,
        category: 'drum-kits' as SidebarTab,
        description: `${kit.genre} — ${kit.description}`,
        selected: activeKit === id,
        action: () => handleKitSelect(id)
      };
    }),

    // Instruments — each switches the piano-roll synth engine for real
    { id: 'synth', name: 'Polyphonic Synthesizer', category: 'instruments', action: () => { setInstrument('synth'); AudioEngine.setInstrumentType('synth'); flashStatus('Instrument: Classic Sub'); } },
    { id: 'fm', name: 'FM Bell Synthesizer', category: 'instruments', action: () => { setInstrument('fm'); AudioEngine.setInstrumentType('fm'); flashStatus('Instrument: FM Synth'); } },
    { id: 'am', name: 'AM Retro Synthesizer', category: 'instruments', action: () => { setInstrument('am'); AudioEngine.setInstrumentType('am'); flashStatus('Instrument: AM Synth'); } },
    { id: 'mono', name: 'Monophonic Bass Synthesizer', category: 'instruments', action: () => { setInstrument('mono'); AudioEngine.setInstrumentType('mono'); flashStatus('Instrument: Mono Bass'); } },

    // Imported samples (real files)
    ...importedSamples.map((s) => ({
      id: s.id,
      name: s.name,
      category: 'samples' as SidebarTab,
      description: `Click to assign to "${pads.find(p => p.id === selectedPadId)?.name ?? selectedPadId}" pad`,
      action: () => handleAssignSample(s)
    })),

    // Effects — instantiate real Tone insert effects on a mixer channel
    { id: 'fx-reverb', name: 'Space Reverb Room', category: 'effects', description: 'Add to mixer channel', action: () => handleAddEffect('reverb', 'Reverb') },
    { id: 'fx-delay', name: 'Feedback Echo Delay', category: 'effects', description: 'Add to mixer channel', action: () => handleAddEffect('delay', 'Delay') },
    { id: 'fx-compressor', name: 'Dynamic Bus Compressor', category: 'effects', description: 'Add to mixer channel', action: () => handleAddEffect('compressor', 'Compressor') },
    { id: 'fx-distortion', name: 'Tube Saturation Distortion', category: 'effects', description: 'Add to mixer channel', action: () => handleAddEffect('distortion', 'Distortion') },
    { id: 'fx-chorus', name: 'Stereo Chorus Modulator', category: 'effects', description: 'Add to mixer channel', action: () => handleAddEffect('chorus', 'Chorus') },
    { id: 'fx-tremolo', name: 'Vintage Tremolo', category: 'effects', description: 'Add to mixer channel', action: () => handleAddEffect('tremolo', 'Tremolo') }
  ];

  const handleItemClick = (item: SidebarItem) => {
    if (item.action) {
      item.action();
    }
  };

  // Filter items based on active category and search query
  const filteredItems = catalogItems.filter(item => 
    item.category === activeSidebarTab &&
    item.name.toLowerCase().includes(sidebarSearchQuery.toLowerCase())
  );

  return (
    <aside className="w-64 bg-[#0a0f1d] border-r border-slate-900 flex flex-col h-full select-none z-30 shrink-0">
      {/* Category Tabs */}
      <div className="grid grid-cols-3 gap-1 p-2 bg-[#080c16] border-b border-slate-900">
        {categories.map(({ tab, label, icon: Icon }) => (
          <button
            key={tab}
            onClick={() => setActiveSidebarTab(tab)}
            className={`flex flex-col items-center justify-center py-2 px-1 rounded-lg border text-center transition-all cursor-pointer ${
              activeSidebarTab === tab
                ? 'bg-indigo-600/10 border-indigo-500/30 text-indigo-400 font-semibold shadow-inner'
                : 'bg-transparent border-transparent text-slate-500 hover:text-slate-300 hover:bg-slate-900/40'
            }`}
          >
            <Icon className="h-4.5 w-4.5 mb-1" />
            <span className="text-[10px] tracking-wide">{label}</span>
          </button>
        ))}
      </div>

      {/* Search Input */}
      <div className="p-2 border-b border-slate-900 relative">
        <input
          type="text"
          value={sidebarSearchQuery}
          onChange={(e) => setSidebarSearchQuery(e.target.value)}
          placeholder={`Search ${categories.find(c => c.tab === activeSidebarTab)?.label.toLowerCase()}...`}
          className="w-full pl-8 pr-3 py-1.5 bg-slate-950/70 border border-slate-800 focus:border-indigo-600 focus:outline-none rounded-lg text-xs text-white placeholder-slate-500 transition-colors"
        />
        <Search className="absolute left-4.5 top-3.5 h-3.5 w-3.5 text-slate-500" />
      </div>

      {/* Item List Container */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {activeSidebarTab === 'projects' ? (
          // Projects List View
          projectList.length === 0 ? (
            <div className="text-center py-6 text-xs text-slate-600">
              No saved projects yet. Click Save to create one!
            </div>
          ) : (
            projectList.map((project) => (
              <div 
                key={project.id}
                className="group flex items-center justify-between p-2 rounded-lg bg-slate-900/40 hover:bg-slate-900 border border-slate-900/50 hover:border-slate-800 transition-colors text-left"
              >
                <button
                  onClick={() => loadProject(project.id)}
                  className="flex-1 min-w-0"
                >
                  <p className="text-xs font-semibold text-slate-200 truncate group-hover:text-indigo-400 transition-colors">
                    {project.name}
                  </p>
                  <p className="text-[10px] text-slate-500">
                    BPM: {project.bpm} | {new Date(project.modifiedAt).toLocaleDateString()}
                  </p>
                </button>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => duplicateProject(project.id)}
                    className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white text-[10px] font-semibold cursor-pointer"
                    title="Duplicate"
                  >
                    D
                  </button>
                  <button
                    onClick={() => deleteProject(project.id)}
                    className="p-1 hover:bg-red-950/30 rounded text-slate-400 hover:text-red-500 text-[10px] font-semibold cursor-pointer"
                    title="Delete"
                  >
                    X
                  </button>
                </div>
              </div>
            ))
          )
        ) : filteredItems.length === 0 ? (
          <div className="text-center py-6 text-xs text-slate-600">
            {activeSidebarTab === 'samples'
              ? 'No samples imported. Click "Import Samples" below to load WAV/MP3 files.'
              : activeSidebarTab === 'favorites'
              ? 'No favorites yet.'
              : 'No items found.'}
          </div>
        ) : (
          filteredItems.map((item) => (
            <button
              key={item.id}
              onClick={() => handleItemClick(item)}
              className={`group w-full flex items-center gap-2 p-2 rounded-lg border text-left transition-all cursor-pointer ${
                item.selected
                  ? 'bg-indigo-600/15 border-indigo-500/40'
                  : 'bg-slate-900/20 hover:bg-indigo-600/10 border-transparent hover:border-indigo-500/20'
              }`}
            >
              <div className={`p-1.5 rounded-md border text-slate-400 ${item.selected ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300' : 'bg-slate-900 border-slate-800'}`}>
                {item.category === 'drum-kits' ? <Grid className="h-3 w-3" /> : item.category === 'effects' ? <Sliders className="h-3 w-3" /> : item.category === 'samples' ? <FileAudio className="h-3 w-3" /> : <Music className="h-3 w-3" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className={`text-xs font-medium truncate ${item.selected ? 'text-indigo-300' : 'text-slate-300'}`}>{item.name}</p>
                {item.description && (
                  <p className="text-[9px] text-slate-500 truncate">{item.description}</p>
                )}
                {!item.description && (
                  <p className="text-[9px] text-slate-500 uppercase tracking-wider">{item.category}</p>
                )}
              </div>
              {item.category === 'samples' && (
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => { e.stopPropagation(); handleRemoveSample(item.id); }}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); handleRemoveSample(item.id); } }}
                  className="opacity-0 group-hover:opacity-100 p-1 text-slate-500 hover:text-red-500 cursor-pointer transition-all"
                  title="Remove sample"
                >
                  <Trash2 className="h-3 w-3" />
                </span>
              )}
              {item.selected && <Check className="h-3.5 w-3.5 text-indigo-400 shrink-0" />}
            </button>
          ))
        )}

        {/* 808 Variants — shown directly under the drum kits list */}
        {activeSidebarTab === 'drum-kits' && (
          <div className="pt-3 mt-2 border-t border-slate-900">
            <div className="flex items-center gap-1.5 px-1 mb-2">
              <Waves className="h-3.5 w-3.5 text-indigo-400" />
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">808 Voice</span>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {ALL_808_VARIANTS.map((variantId) => {
                const variant = EIGHT08_VARIANTS[variantId];
                const selected = active808Variant === variantId;
                return (
                  <button
                    key={variantId}
                    onClick={() => handle808Select(variantId)}
                    title={variant.description}
                    className={`py-1.5 px-2 rounded-lg text-[10px] font-bold border transition-all cursor-pointer text-center ${
                      selected
                        ? 'bg-indigo-600/20 border-indigo-500/50 text-indigo-300'
                        : 'bg-slate-900/40 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                    }`}
                  >
                    {variant.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Quick Add Button + status */}
      <div className="p-2 border-t border-slate-900 bg-[#080c16] space-y-2">
        {statusMsg && (
          <div className="text-[10px] font-semibold text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 px-2 py-1 rounded-lg truncate">
            {statusMsg}
          </div>
        )}
        {/* Hidden file input for sample import */}
        <input
          type="file"
          ref={sampleInputRef}
          onChange={handleImportSamples}
          accept="audio/*"
          multiple
          className="hidden"
        />
        <button
          onClick={() => sampleInputRef.current?.click()}
          className="w-full py-1.5 flex items-center justify-center gap-1.5 bg-slate-900 hover:bg-slate-850 active:bg-slate-950 text-slate-300 hover:text-white rounded-lg border border-slate-800/80 text-xs font-semibold cursor-pointer transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          Import Samples
        </button>
      </div>
    </aside>
  );
};
