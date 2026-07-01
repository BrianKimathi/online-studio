import React, { useRef, useState } from 'react';
import { useUIStore, SidebarTab } from '../../stores/useUIStore';
import { useProjectStore } from '../../stores/useProjectStore';
import { useSequencerStore } from '../../stores/useSequencerStore';
import { useMixerStore } from '../../stores/useMixerStore';
import { useInstrumentsStore } from '../../stores/useInstrumentsStore';
import { useWindowStore } from '../../stores/useWindowStore';
import { AudioEngine } from '../../audio/engine';
import { DRUM_KIT_PRESETS, ALL_KIT_IDS, EIGHT08_VARIANTS, ALL_808_VARIANTS, DrumKitId, Eight08Variant } from '../../audio/drumKitPresets';
import { ALL_INSTRUMENT_PRESETS, INSTRUMENT_PRESETS, InstrumentPresetId } from '../../audio/instrumentPresets';
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
  Trash2,
  Piano,
  VolumeX,
  Volume2,
  PlaySquare,
  Upload
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
  
  const { projectList, loadProject, duplicateProject, deleteProject } = useProjectStore();
  const { activeKit, setActiveKit, active808Variant, setActive808Variant, pads, setCustomSample, updatePadConfig } = useSequencerStore();
  const { addEffect } = useMixerStore();
  const {
    tracks: instrumentTracks,
    addTrack: addInstrumentTrack,
    addSampleTrack: addInstrumentSampleTrack,
    removeTrack: removeInstrumentTrack,
    setTrackPreset: setInstrumentTrackPreset,
    setTrackMute: setInstrumentTrackMute,
    setActiveTrack,
  } = useInstrumentsStore();
  const openWindow = useWindowStore((s) => s.openWindow);

  const [importedSamples, setImportedSamples] = useState<ImportedSample[]>([]);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const sampleInputRef = useRef<HTMLInputElement>(null);
  const import808InputRef = useRef<HTMLInputElement>(null);

  const flashStatus = (msg: string) => {
    setStatusMsg(msg);
    setTimeout(() => setStatusMsg(null), 3000);
  };

  const pad808 = pads.find((p) => p.id === '808');

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

  // Import an external 808 sample (WAV/MP3). Mirrors FL Studio's workflow:
  // the sample becomes both a step-sequencer channel (assigned to the 808 pad)
  // AND a piano-roll instrument track (pitched via Tone.Sampler). By default
  // we open the Step Sequencer (the "make a beat" view); the user can instead
  // open the piano roll from the 808 Voice panel.
  const handleImport808 = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    const url = URL.createObjectURL(file);
    // 1. Assign to the 808 drum pad so it appears in the step sequencer.
    setCustomSample('808', url, file.name);
    AudioEngine.setCustomSample('808', url);
    // 2. Create a sample-based instrument track so it can be played from a piano roll.
    const trackId = addInstrumentSampleTrack('808', url, file.name, file.name.replace(/\.[^.]+$/, ''));
    AudioEngine.ensureInstrumentSynth(trackId, '808', url);
    // 3. Default: open the Step Sequencer window (beat-making view).
    openWindow({ kind: 'sequencer', title: 'Step Sequencer' });
    flashStatus(`Imported 808 "${file.name}" — open piano roll from the 808 Voice panel`);
  };

  const handleOpen808PianoRoll = () => {
    const sampleTrack = useInstrumentsStore.getState().tracks.find((t) => t.sampleUrl && t.presetId === '808');
    if (!sampleTrack) {
      flashStatus('Import an 808 sample first');
      return;
    }
    setActiveTrack(sampleTrack.id);
    openWindow({ kind: 'piano-roll', title: `${sampleTrack.name} — Piano Roll`, trackId: sampleTrack.id });
  };

  const handleClear808Sample = () => {
    updatePadConfig('808', { userSampleUrl: undefined, userSampleName: undefined });
    AudioEngine.clearCustomSample('808');
    // Also remove any sample-based 808 instrument tracks.
    const state = useInstrumentsStore.getState();
    for (const t of state.tracks) {
      if (t.sampleUrl && t.presetId === '808') {
        state.removeTrack(t.id);
        AudioEngine.disposeInstrumentSynth(t.id);
      }
    }
    flashStatus('808 reverted to synth voice');
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

    // Instruments are now managed as tracks (see special-cased panel below).
    // Each track opens its own piano roll as a floating window.

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
        ) : activeSidebarTab === 'instruments' ? (
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 px-1 pb-1">
              <Music className="h-3.5 w-3.5 text-indigo-400" />
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Instrument Tracks</span>
            </div>
            {instrumentTracks.map((t) => {
              const def = INSTRUMENT_PRESETS[t.presetId];
              return (
                <div
                  key={t.id}
                  className="group p-2 rounded-lg bg-slate-900/40 hover:bg-slate-900 border border-slate-900/50 hover:border-slate-800 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: t.color }} />
                    <span className="text-xs font-semibold text-slate-200 truncate flex-1">{t.name}</span>
                    <button
                      onClick={() => {
                        setInstrumentTrackMute(t.id, !t.mute);
                        AudioEngine.setInstrumentMute(t.id, !t.mute);
                      }}
                      className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
                      title={t.mute ? 'Unmute' : 'Mute'}
                    >
                      {t.mute ? <VolumeX className="h-3 w-3 text-red-400" /> : <Volume2 className="h-3 w-3" />}
                    </button>
                    <button
                      onClick={() => {
                        if (instrumentTracks.length > 1) {
                          removeInstrumentTrack(t.id);
                          AudioEngine.disposeInstrumentSynth(t.id);
                        }
                      }}
                      className="p-1 rounded text-slate-400 hover:text-red-500 hover:bg-slate-800 cursor-pointer"
                      title="Delete track"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <select
                      value={t.presetId}
                      onChange={(e) => {
                        const pid = e.target.value as InstrumentPresetId;
                        setInstrumentTrackPreset(t.id, pid);
                        AudioEngine.ensureInstrumentSynth(t.id, pid);
                      }}
                      className="flex-1 bg-slate-950 border border-slate-800 text-[9px] font-semibold px-1.5 py-1 rounded focus:outline-none cursor-pointer"
                    >
                      {ALL_INSTRUMENT_PRESETS.map((pid) => (
                        <option key={pid} value={pid}>{INSTRUMENT_PRESETS[pid].name}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => {
                        setActiveTrack(t.id);
                        openWindow({
                          kind: 'piano-roll',
                          title: `${t.name} — Piano Roll`,
                          trackId: t.id,
                        });
                      }}
                      className="flex items-center gap-1 px-2 py-1 rounded bg-indigo-600/20 border border-indigo-500/40 text-indigo-300 hover:bg-indigo-600/30 text-[9px] font-bold cursor-pointer transition-colors"
                      title="Open piano roll"
                    >
                      <Piano className="h-3 w-3" /> Piano Roll
                    </button>
                  </div>
                  {def && <p className="text-[9px] text-slate-500 mt-1 truncate">{def.description}</p>}
                </div>
              );
            })}

            {/* Add instrument dropdown */}
            <div className="pt-2">
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1 mb-1.5">Add Instrument</div>
              <div className="grid grid-cols-2 gap-1.5">
                {ALL_INSTRUMENT_PRESETS.map((pid) => {
                  const def = INSTRUMENT_PRESETS[pid];
                  return (
                    <button
                      key={pid}
                      onClick={() => {
                        const id = addInstrumentTrack(pid);
                        AudioEngine.ensureInstrumentSynth(id, pid);
                        openWindow({ kind: 'piano-roll', title: `${def.name} — Piano Roll`, trackId: id });
                        flashStatus(`Added ${def.name} track`);
                      }}
                      className="flex items-center gap-1.5 py-1.5 px-2 rounded-lg text-[10px] font-bold border bg-slate-900/40 border-slate-800 text-slate-300 hover:text-white hover:border-slate-700 cursor-pointer transition-colors"
                    >
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: def.color }} />
                      <span className="truncate">{def.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
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
                const selected = active808Variant === variantId && !pad808?.userSampleUrl;
                return (
                  <button
                    key={variantId}
                    onClick={() => {
                      handle808Select(variantId);
                      if (pad808?.userSampleUrl) handleClear808Sample();
                    }}
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

            {/* Import external 808 sample (FL Studio style) */}
            <input
              type="file"
              ref={import808InputRef}
              onChange={handleImport808}
              accept="audio/*"
              className="hidden"
            />
            <div className="mt-2 space-y-1.5">
              <button
                onClick={() => import808InputRef.current?.click()}
                className="w-full flex items-center justify-center gap-1.5 py-1.5 bg-indigo-600/15 hover:bg-indigo-600/25 border border-indigo-500/30 text-indigo-300 rounded-lg text-[10px] font-bold cursor-pointer transition-colors"
                title="Load a WAV/MP3 808 sample"
              >
                <Upload className="h-3 w-3" /> Import 808 Sample
              </button>
              {pad808?.userSampleUrl && (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5 p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
                    <Waves className="h-3 w-3 text-emerald-400 shrink-0" />
                    <span className="text-[9px] font-semibold text-emerald-300 truncate flex-1" title={pad808.userSampleName}>
                      {pad808.userSampleName ?? 'Custom 808'}
                    </span>
                    <button
                      onClick={handleClear808Sample}
                      className="p-0.5 text-emerald-400 hover:text-red-400 cursor-pointer"
                      title="Revert to synth 808"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-1">
                    <button
                      onClick={() => openWindow({ kind: 'sequencer', title: 'Step Sequencer' })}
                      className="flex items-center justify-center gap-1 py-1 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded text-[9px] font-bold text-slate-300 hover:text-white cursor-pointer"
                      title="Open Step Sequencer (beat-making view)"
                    >
                      <PlaySquare className="h-3 w-3" /> Sequencer
                    </button>
                    <button
                      onClick={handleOpen808PianoRoll}
                      className="flex items-center justify-center gap-1 py-1 bg-indigo-600/15 hover:bg-indigo-600/25 border border-indigo-500/30 text-indigo-300 rounded text-[9px] font-bold cursor-pointer"
                      title="Open this 808 in a piano roll (pitched)"
                    >
                      <Piano className="h-3 w-3" /> Piano Roll
                    </button>
                  </div>
                </div>
              )}
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
