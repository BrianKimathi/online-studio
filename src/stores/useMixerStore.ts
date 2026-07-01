import { create } from 'zustand';
import { MixerChannel, EffectConfig, EffectType } from '../types';

interface MixerState {
  channels: MixerChannel[];
  
  setVolume: (channelId: string, volume: number) => void;
  setPan: (channelId: string, pan: number) => void;
  setMute: (channelId: string, mute: boolean) => void;
  setSolo: (channelId: string, solo: boolean) => void;
  updateEq: (channelId: string, band: 'low' | 'mid' | 'high', gain: number) => void;
  updateSends: (channelId: string, sendType: 'sendReverb' | 'sendDelay', value: number) => void;
  addEffect: (channelId: string, type: EffectType) => string;
  removeEffect: (channelId: string, effectId: string) => void;
  toggleEffectBypass: (channelId: string, effectId: string) => void;
  updateEffectParam: (channelId: string, effectId: string, paramName: string, value: any) => void;
  reorderEffects: (channelId: string, effects: EffectConfig[]) => void;
  loadMixerData: (channels: MixerChannel[]) => void;
}

const createDefaultChannel = (id: string, name: string): MixerChannel => ({
  id,
  name,
  volume: id === 'master' ? 0 : -6, // in dB
  pan: 0,
  mute: false,
  solo: false,
  eq: { low: 0, mid: 0, high: 0 },
  sendReverb: 0.15,
  sendDelay: 0.05,
  effects: []
});

const INITIAL_CHANNELS: MixerChannel[] = [
  createDefaultChannel('drums', 'Drums'),
  createDefaultChannel('synth', 'Synthesizer'),
  createDefaultChannel('vocals', 'Vocal / Mic'),
  createDefaultChannel('master', 'Master')
];

export const useMixerStore = create<MixerState>((set) => ({
  channels: INITIAL_CHANNELS,

  setVolume: (channelId, volume) => set((state) => ({
    channels: state.channels.map((ch) => ch.id === channelId ? { ...ch, volume } : ch)
  })),

  setPan: (channelId, pan) => set((state) => ({
    channels: state.channels.map((ch) => ch.id === channelId ? { ...ch, pan } : ch)
  })),

  setMute: (channelId, mute) => set((state) => {
    const target = state.channels.find(c => c.id === channelId);
    if (!target) return {};
    
    // Mute state logic
    const updatedChannels = state.channels.map((ch) => {
      if (ch.id === channelId) {
        return { ...ch, mute };
      }
      return ch;
    });
    
    return { channels: updatedChannels };
  }),

  setSolo: (channelId, solo) => set((state) => {
    // If a channel is soloed, other channels (that are not soloed) should be muted in the audio engine,
    // which the audio engine will handle. In the store, we just track solo flags.
    const updatedChannels = state.channels.map((ch) => {
      if (ch.id === channelId) {
        return { ...ch, solo };
      }
      return ch;
    });
    
    return { channels: updatedChannels };
  }),

  updateEq: (channelId, band, gain) => set((state) => ({
    channels: state.channels.map((ch) => {
      if (ch.id !== channelId) return ch;
      return {
        ...ch,
        eq: {
          ...ch.eq,
          [band]: gain
        }
      };
    })
  })),

  updateSends: (channelId, sendType, value) => set((state) => ({
    channels: state.channels.map((ch) => ch.id === channelId ? { ...ch, [sendType]: value } : ch)
  })),

  addEffect: (channelId, type) => {
    const effectId = `fx-${type}-${Date.now()}`;

    // Default parameters for different effects
    const defaultParams: Record<string, any> = {};
    if (type === 'reverb') {
      defaultParams.roomSize = 0.5;
      defaultParams.dampening = 3000;
      defaultParams.wet = 0.5;
    } else if (type === 'delay') {
      defaultParams.delayTime = 0.333; // 1/4 note at 120bpm approx
      defaultParams.feedback = 0.3;
      defaultParams.wet = 0.4;
    } else if (type === 'compressor') {
      defaultParams.threshold = -24; // dB
      defaultParams.ratio = 4;
      defaultParams.attack = 0.03; // sec
      defaultParams.release = 0.1; // sec
    } else if (type === 'distortion') {
      defaultParams.distortion = 0.4;
      defaultParams.wet = 0.5;
    } else if (type === 'chorus') {
      defaultParams.frequency = 1.5;
      defaultParams.delayTime = 3.5;
      defaultParams.depth = 0.7;
      defaultParams.wet = 0.5;
    } else if (type === 'gate') {
      defaultParams.threshold = -40; // dB
      defaultParams.attack = 0.01;
      defaultParams.release = 0.1;
    }

    const newEffect: EffectConfig = {
      id: effectId,
      type,
      bypass: false,
      params: defaultParams
    };

    set((state) => ({
      channels: state.channels.map((ch) => {
        if (ch.id !== channelId) return ch;
        return {
          ...ch,
          effects: [...ch.effects, newEffect]
        };
      })
    }));

    return effectId;
  },

  removeEffect: (channelId, effectId) => set((state) => ({
    channels: state.channels.map((ch) => {
      if (ch.id !== channelId) return ch;
      return {
        ...ch,
        effects: ch.effects.filter((fx) => fx.id !== effectId)
      };
    })
  })),

  toggleEffectBypass: (channelId, effectId) => set((state) => ({
    channels: state.channels.map((ch) => {
      if (ch.id !== channelId) return ch;
      return {
        ...ch,
        effects: ch.effects.map((fx) => fx.id === effectId ? { ...fx, bypass: !fx.bypass } : fx)
      };
    })
  })),

  updateEffectParam: (channelId, effectId, paramName, value) => set((state) => ({
    channels: state.channels.map((ch) => {
      if (ch.id !== channelId) return ch;
      return {
        ...ch,
        effects: ch.effects.map((fx) => {
          if (fx.id !== effectId) return fx;
          return {
            ...fx,
            params: {
              ...fx.params,
              [paramName]: value
            }
          };
        })
      };
    })
  })),

  reorderEffects: (channelId, effects) => set((state) => ({
    channels: state.channels.map((ch) => ch.id === channelId ? { ...ch, effects } : ch)
  })),

  loadMixerData: (channels) => set({ channels })
}));
