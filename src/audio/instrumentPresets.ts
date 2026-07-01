import * as Tone from 'tone';

/**
 * Multi-instrument preset definitions. Each instrument track owns one of these
 * and gets its own dedicated Tone synth instance + piano roll pattern, so the
 * user can compose piano, guitar, 808, pad, etc. independently (FL Studio style).
 */
export type InstrumentPresetId =
  | 'piano'
  | 'guitar'
  | '808'
  | 'pad'
  | 'pluck'
  | 'lead'
  | 'fm'
  | 'am'
  | 'mono';

export interface InstrumentPresetDef {
  id: InstrumentPresetId;
  name: string;
  description: string;
  color: string;
}

export const INSTRUMENT_PRESETS: Record<InstrumentPresetId, InstrumentPresetDef> = {
  piano:  { id: 'piano',  name: 'Piano',     description: 'Bright acoustic-style piano',  color: '#a78bfa' },
  guitar: { id: 'guitar', name: 'Guitar',    description: 'Plucked string guitar',        color: '#fb923c' },
  '808':  { id: '808',    name: '808 Bass',  description: 'Sub 808 bass monosynth',       color: '#f472b6' },
  pad:    { id: 'pad',    name: 'Pad',       description: 'Warm sustained pad',           color: '#60a5fa' },
  pluck:  { id: 'pluck',  name: 'Pluck',     description: 'Clean pluck synth',            color: '#34d399' },
  lead:   { id: 'lead',   name: 'Lead',      description: 'Cutting lead synth',           color: '#facc15' },
  fm:     { id: 'fm',     name: 'FM Bell',   description: 'FM bell synth',                color: '#22d3ee' },
  am:     { id: 'am',     name: 'AM Retro',  description: 'AM retro synth',               color: '#e879f9' },
  mono:   { id: 'mono',   name: 'Mono Bass', description: 'Monophonic bass synth',        color: '#94a3b8' },
};

export const ALL_INSTRUMENT_PRESETS: InstrumentPresetId[] = Object.keys(INSTRUMENT_PRESETS) as InstrumentPresetId[];

/**
 * Create a dedicated PolySynth for an instrument preset. All synths are wrapped
 * in PolySynth so chords never crash, even for "mono" presets. Each connects to
 * the provided destination (typically the synth mixer channel EQ).
 */
export function createInstrumentSynth(presetId: InstrumentPresetId, destination: Tone.ToneAudioNode): Tone.PolySynth {
  let synth: Tone.PolySynth;
  switch (presetId) {
    case 'piano':
      synth = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'triangle' },
        envelope: { attack: 0.005, decay: 0.4, sustain: 0.2, release: 1.0 },
        volume: -8,
      });
      break;
    case 'guitar':
      // PluckSynth approximates a plucked string via Karplus-Strong.
      synth = new Tone.PolySynth(Tone.PluckSynth as any, {
        attackNoise: 1,
        dampening: 4000,
        resonance: 0.9,
        volume: -6,
      } as any);
      break;
    case '808':
      // 808 = sine sub bass with long release; MonoSynth gives us the filter too.
      synth = new Tone.PolySynth(Tone.MonoSynth, {
        oscillator: { type: 'sine' },
        envelope: { attack: 0.01, decay: 0.6, sustain: 0.5, release: 1.2 },
        filter: { Q: 1, type: 'lowpass', rolloff: -24 },
        filterEnvelope: { attack: 0.01, decay: 0.3, sustain: 0.5, release: 1.0, baseFrequency: 80, octaves: 3 },
        volume: -6,
      });
      break;
    case 'pad':
      synth = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'sawtooth' },
        envelope: { attack: 0.6, decay: 0.5, sustain: 0.8, release: 2.0 },
        volume: -12,
      });
      break;
    case 'pluck':
      synth = new Tone.PolySynth(Tone.PluckSynth as any, {
        attackNoise: 0.5,
        dampening: 5000,
        resonance: 0.95,
        volume: -8,
      } as any);
      break;
    case 'lead':
      synth = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'sawtooth' },
        envelope: { attack: 0.01, decay: 0.2, sustain: 0.6, release: 0.3 },
        volume: -10,
      });
      break;
    case 'fm':
      synth = new Tone.PolySynth(Tone.FMSynth, {
        harmonicity: 3,
        modulationIndex: 10,
        envelope: { attack: 0.05, decay: 0.2, sustain: 0.6, release: 0.4 },
        volume: -8,
      });
      break;
    case 'am':
      synth = new Tone.PolySynth(Tone.AMSynth, {
        harmonicity: 2,
        envelope: { attack: 0.05, decay: 0.2, sustain: 0.6, release: 0.4 },
        volume: -8,
      });
      break;
    case 'mono':
      synth = new Tone.PolySynth(Tone.MonoSynth, {
        oscillator: { type: 'sawtooth' },
        envelope: { attack: 0.01, decay: 0.2, sustain: 0.5, release: 0.3 },
        filter: { Q: 2, type: 'lowpass', rolloff: -24 },
        filterEnvelope: { attack: 0.01, decay: 0.2, sustain: 0.4, release: 0.3, baseFrequency: 200, octaves: 4 },
        volume: -8,
      });
      break;
    default:
      synth = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'triangle' },
        envelope: { attack: 0.05, decay: 0.2, sustain: 0.6, release: 0.4 },
        volume: -8,
      });
  }
  synth.connect(destination);
  return synth;
}
