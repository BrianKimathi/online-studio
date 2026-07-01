// Genre-specific drum kit presets for Online Studio DAW
// Each preset configures all 10 drum voices with genre-appropriate parameters

export type DrumKitId = 'classic' | 'trap' | 'hiphop' | 'afro' | 'amapiano' | 'rnb';

/**
 * Selectable 808 voice variations. Independent of the drum kit so any genre
 * can pair with any 808 character (e.g. distorted 808 over a trap kit).
 */
export type Eight08Variant = 'sub' | 'punchy' | 'longtail' | 'distorted';

export interface Eight08VariantConfig {
  id: Eight08Variant;
  name: string;
  description: string;
  octaves: number;
  envelope: { attack: number; decay: number; sustain: number; release: number };
  pitchDecay: number;
  note: string;        // default pitch used when no kit note is available
  distortion: number;  // 0..1 Tone.Distortion amount (0 = clean)
  drive: number;       // input gain into the distortion stage (dB)
}

export const EIGHT08_VARIANTS: Record<Eight08Variant, Eight08VariantConfig> = {
  // SUB — clean, deep, smooth sine-like tail. Great for R&B / amapiano.
  sub: {
    id: 'sub',
    name: 'Sub',
    description: 'Clean deep sub bass, smooth tail',
    octaves: 1.5,
    envelope: { attack: 0.01, decay: 2.0, sustain: 0.6, release: 1.2 },
    pitchDecay: 0.04,
    note: 'C1',
    distortion: 0,
    drive: 0,
  },
  // PUNCHY — fast attack, short decay, in-your-face. Great for trap / hip-hop.
  punchy: {
    id: 'punchy',
    name: 'Punchy',
    description: 'Fast attack, tight decay, punchy',
    octaves: 4,
    envelope: { attack: 0.001, decay: 0.5, sustain: 0.2, release: 0.4 },
    pitchDecay: 0.12,
    note: 'C1',
    distortion: 0.15,
    drive: 3,
  },
  // LONGTAIL — sustained, slow release, slides. Great for amapiano log drum.
  longtail: {
    id: 'longtail',
    name: 'Long Tail',
    description: 'Sustained slide, long release tail',
    octaves: 3,
    envelope: { attack: 0.005, decay: 3.5, sustain: 0.7, release: 2.0 },
    pitchDecay: 0.2,
    note: 'C1',
    distortion: 0,
    drive: 0,
  },
  // DISTORTED — saturated, aggressive 808. Great for drill / trap.
  distorted: {
    id: 'distorted',
    name: 'Distorted',
    description: 'Saturated, aggressive distorted 808',
    octaves: 5,
    envelope: { attack: 0.002, decay: 1.2, sustain: 0.4, release: 0.8 },
    pitchDecay: 0.15,
    note: 'C1',
    distortion: 0.55,
    drive: 8,
  },
};

export const ALL_808_VARIANTS: Eight08Variant[] = ['sub', 'punchy', 'longtail', 'distorted'];

export interface DrumKitPreset {
  id: DrumKitId;
  name: string;
  description: string;
  genre: string;
  kick: { octaves: number; envelope: { attack: number; decay: number; sustain: number; release: number }; pitchDecay?: number; note?: string };
  snare: { noiseType: 'white' | 'pink' | 'brown'; filterFreq: number; filterQ: number; oscDecay: number; noiseDecay: number };
  clap: { noiseType: 'white' | 'pink' | 'brown'; filterFreq: number; filterQ: number; decay: number };
  closedHat: { resonance: number; harmonicity: number; decay: number; frequency: number };
  openHat: { resonance: number; harmonicity: number; decay: number; frequency: number };
  tom: { octaves: number; decay: number; note?: string };
  crash: { resonance: number; harmonicity: number; decay: number; frequency: number };
  ride: { resonance: number; harmonicity: number; decay: number; frequency: number };
  bass808: { octaves: number; envelope: { attack: number; decay: number; sustain: number; release: number }; note?: string; pitchDecay?: number };
  fx: { harmonicity: number; modulationIndex: number; decay: number };
}

export const DRUM_KIT_PRESETS: Record<DrumKitId, DrumKitPreset> = {
  // ─────────────────────────────────────────────────────────────
  // CLASSIC — Balanced all-rounder kit (matches original defaults)
  // ─────────────────────────────────────────────────────────────
  classic: {
    id: 'classic',
    name: 'Classic',
    description: 'Balanced all-rounder drum kit',
    genre: 'Pop / General',
    kick: {
      octaves: 5,
      envelope: { attack: 0.001, decay: 0.25, sustain: 0, release: 0.25 },
    },
    snare: {
      noiseType: 'pink',
      filterFreq: 1000,
      filterQ: 1,
      oscDecay: 0.08,
      noiseDecay: 0.15,
    },
    clap: {
      noiseType: 'white',
      filterFreq: 1200,
      filterQ: 1.5,
      decay: 0.08,
    },
    closedHat: {
      resonance: 8000,
      harmonicity: 5.1,
      decay: 0.04,
      frequency: 300,
    },
    openHat: {
      resonance: 7000,
      harmonicity: 5.1,
      decay: 0.3,
      frequency: 300,
    },
    tom: {
      octaves: 4,
      decay: 0.2,
      note: 'F2',
    },
    crash: {
      resonance: 9000,
      harmonicity: 6.2,
      decay: 1.2,
      frequency: 250,
    },
    ride: {
      resonance: 8500,
      harmonicity: 5.8,
      decay: 0.4,
      frequency: 450,
    },
    bass808: {
      octaves: 2,
      envelope: { attack: 0.01, decay: 1.5, sustain: 0.4, release: 1.0 },
      note: 'C1',
    },
    fx: {
      harmonicity: 2,
      modulationIndex: 10,
      decay: 0.5,
    },
  },

  // ─────────────────────────────────────────────────────────────
  // TRAP — Heavy 808 sub, rapid hi-hats, punchy kick, crispy snare
  // ─────────────────────────────────────────────────────────────
  trap: {
    id: 'trap',
    name: 'Trap',
    description: 'Heavy 808, rapid hi-hats, punchy kick',
    genre: 'Trap / EDM',
    kick: {
      octaves: 8,
      envelope: { attack: 0.001, decay: 0.15, sustain: 0, release: 0.12 },
      pitchDecay: 0.08,
      note: 'C1',
    },
    snare: {
      noiseType: 'white',
      filterFreq: 2500,
      filterQ: 0.8,
      oscDecay: 0.05,
      noiseDecay: 0.12,
    },
    clap: {
      noiseType: 'white',
      filterFreq: 1800,
      filterQ: 1.2,
      decay: 0.06,
    },
    closedHat: {
      resonance: 9500,
      harmonicity: 5.5,
      decay: 0.015,
      frequency: 400,
    },
    openHat: {
      resonance: 8000,
      harmonicity: 5.5,
      decay: 0.18,
      frequency: 400,
    },
    tom: {
      octaves: 5,
      decay: 0.18,
      note: 'E2',
    },
    crash: {
      resonance: 9500,
      harmonicity: 6.5,
      decay: 0.9,
      frequency: 280,
    },
    ride: {
      resonance: 9000,
      harmonicity: 6.0,
      decay: 0.3,
      frequency: 500,
    },
    bass808: {
      octaves: 3,
      envelope: { attack: 0.005, decay: 3.0, sustain: 0.6, release: 1.5 },
      note: 'C1',
      pitchDecay: 0.15,
    },
    fx: {
      harmonicity: 3,
      modulationIndex: 15,
      decay: 0.7,
    },
  },

  // ─────────────────────────────────────────────────────────────
  // HIP HOP — Boom-bap: warm punchy kick, thick snare, vinyl FX
  // ─────────────────────────────────────────────────────────────
  hiphop: {
    id: 'hiphop',
    name: 'Hip Hop',
    description: 'Boom-bap style with warm, punchy sounds',
    genre: 'Hip Hop / Boom Bap',
    kick: {
      octaves: 6,
      envelope: { attack: 0.002, decay: 0.3, sustain: 0, release: 0.3 },
      pitchDecay: 0.05,
      note: 'C1',
    },
    snare: {
      noiseType: 'pink',
      filterFreq: 800,
      filterQ: 0.7,
      oscDecay: 0.12,
      noiseDecay: 0.22,
    },
    clap: {
      noiseType: 'pink',
      filterFreq: 900,
      filterQ: 1.0,
      decay: 0.1,
    },
    closedHat: {
      resonance: 7000,
      harmonicity: 4.8,
      decay: 0.035,
      frequency: 280,
    },
    openHat: {
      resonance: 6000,
      harmonicity: 4.8,
      decay: 0.25,
      frequency: 280,
    },
    tom: {
      octaves: 3.5,
      decay: 0.25,
      note: 'G2',
    },
    crash: {
      resonance: 8000,
      harmonicity: 5.5,
      decay: 1.0,
      frequency: 230,
    },
    ride: {
      resonance: 7500,
      harmonicity: 5.2,
      decay: 0.35,
      frequency: 420,
    },
    bass808: {
      octaves: 2.5,
      envelope: { attack: 0.01, decay: 1.8, sustain: 0.3, release: 0.8 },
      note: 'D1',
      pitchDecay: 0.06,
    },
    fx: {
      harmonicity: 1.5,
      modulationIndex: 6,
      decay: 0.8,
    },
  },

  // ─────────────────────────────────────────────────────────────
  // AFRO — Talking-drum toms, shaker hats, conga clap, bouncy kick
  // ─────────────────────────────────────────────────────────────
  afro: {
    id: 'afro',
    name: 'Afro',
    description: 'Talking-drum toms, shaker hats, conga clap',
    genre: 'Afrobeats',
    kick: {
      octaves: 4,
      envelope: { attack: 0.003, decay: 0.2, sustain: 0.05, release: 0.15 },
      pitchDecay: 0.03,
      note: 'D1',
    },
    snare: {
      noiseType: 'brown',
      filterFreq: 1200,
      filterQ: 1.2,
      oscDecay: 0.06,
      noiseDecay: 0.1,
    },
    clap: {
      noiseType: 'brown',
      filterFreq: 800,
      filterQ: 2.0,
      decay: 0.04,
    },
    closedHat: {
      resonance: 10000,
      harmonicity: 6.0,
      decay: 0.02,
      frequency: 350,
    },
    openHat: {
      resonance: 9000,
      harmonicity: 6.0,
      decay: 0.12,
      frequency: 350,
    },
    tom: {
      octaves: 6,
      decay: 0.35,
      note: 'A2',
    },
    crash: {
      resonance: 8500,
      harmonicity: 5.8,
      decay: 0.8,
      frequency: 260,
    },
    ride: {
      resonance: 9000,
      harmonicity: 5.5,
      decay: 0.25,
      frequency: 480,
    },
    bass808: {
      octaves: 2,
      envelope: { attack: 0.008, decay: 1.0, sustain: 0.2, release: 0.6 },
      note: 'E1',
      pitchDecay: 0.04,
    },
    fx: {
      harmonicity: 4,
      modulationIndex: 8,
      decay: 0.3,
    },
  },

  // ─────────────────────────────────────────────────────────────
  // AMAPIANO — Log drum bass, bouncy kick, shaker hats, wide toms
  // ─────────────────────────────────────────────────────────────
  amapiano: {
    id: 'amapiano',
    name: 'Amapiano',
    description: 'Log drum bass, bouncy kick, shaker hats',
    genre: 'Amapiano',
    kick: {
      octaves: 3.5,
      envelope: { attack: 0.005, decay: 0.18, sustain: 0.08, release: 0.12 },
      pitchDecay: 0.04,
      note: 'E1',
    },
    snare: {
      noiseType: 'pink',
      filterFreq: 1400,
      filterQ: 1.0,
      oscDecay: 0.07,
      noiseDecay: 0.08,
    },
    clap: {
      noiseType: 'white',
      filterFreq: 1000,
      filterQ: 1.8,
      decay: 0.05,
    },
    closedHat: {
      resonance: 10500,
      harmonicity: 6.5,
      decay: 0.018,
      frequency: 380,
    },
    openHat: {
      resonance: 9500,
      harmonicity: 6.5,
      decay: 0.1,
      frequency: 380,
    },
    tom: {
      octaves: 5.5,
      decay: 0.4,
      note: 'B2',
    },
    crash: {
      resonance: 8000,
      harmonicity: 5.5,
      decay: 0.7,
      frequency: 240,
    },
    ride: {
      resonance: 8500,
      harmonicity: 5.8,
      decay: 0.2,
      frequency: 460,
    },
    bass808: {
      octaves: 4,
      envelope: { attack: 0.002, decay: 2.5, sustain: 0.5, release: 1.2 },
      note: 'C1',
      pitchDecay: 0.2,
    },
    fx: {
      harmonicity: 2.5,
      modulationIndex: 12,
      decay: 0.4,
    },
  },

  // ─────────────────────────────────────────────────────────────
  // R&B — Soft round kicks, finger-snap, warm hats, mellow 808
  // ─────────────────────────────────────────────────────────────
  rnb: {
    id: 'rnb',
    name: 'R&B',
    description: 'Soft round kicks, finger-snap, smooth hats',
    genre: 'R&B / Soul',
    kick: {
      octaves: 3,
      envelope: { attack: 0.005, decay: 0.35, sustain: 0, release: 0.35 },
      pitchDecay: 0.03,
      note: 'C1',
    },
    snare: {
      noiseType: 'brown',
      filterFreq: 700,
      filterQ: 0.6,
      oscDecay: 0.1,
      noiseDecay: 0.18,
    },
    clap: {
      noiseType: 'brown',
      filterFreq: 600,
      filterQ: 0.8,
      decay: 0.03,
    },
    closedHat: {
      resonance: 6000,
      harmonicity: 4.5,
      decay: 0.03,
      frequency: 260,
    },
    openHat: {
      resonance: 5500,
      harmonicity: 4.5,
      decay: 0.2,
      frequency: 260,
    },
    tom: {
      octaves: 3,
      decay: 0.22,
      note: 'F2',
    },
    crash: {
      resonance: 7000,
      harmonicity: 5.0,
      decay: 1.0,
      frequency: 220,
    },
    ride: {
      resonance: 7500,
      harmonicity: 5.0,
      decay: 0.35,
      frequency: 400,
    },
    bass808: {
      octaves: 1.5,
      envelope: { attack: 0.015, decay: 2.0, sustain: 0.5, release: 1.2 },
      note: 'C1',
      pitchDecay: 0.04,
    },
    fx: {
      harmonicity: 1,
      modulationIndex: 4,
      decay: 0.6,
    },
  },
};

/** Helper: get all kit IDs for iteration */
export const ALL_KIT_IDS: DrumKitId[] = ['classic', 'trap', 'hiphop', 'afro', 'amapiano', 'rnb'];

/** Helper: get a preset by ID with fallback to classic */
export function getDrumKitPreset(id: DrumKitId): DrumKitPreset {
  return DRUM_KIT_PRESETS[id] ?? DRUM_KIT_PRESETS.classic;
}
