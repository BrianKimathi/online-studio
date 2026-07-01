import * as Tone from 'tone';
import { DrumPadId } from '../types';
import { DrumKitPreset, DrumKitId, Eight08Variant, Eight08VariantConfig, getDrumKitPreset, DRUM_KIT_PRESETS, EIGHT08_VARIANTS } from './drumKitPresets';

export type { DrumKitId, Eight08Variant } from './drumKitPresets';

/**
 * MetalSynth `resonance` is the highpass filter floor and must stay in [0, 7000].
 * Higher values make cymbals thin/inaudible, so clamp presets into a safe audible range.
 */
const clampResonance = (v: number): number => Math.min(6000, Math.max(2000, v));

export class DrumSynthEngine {
  // Synth voices
  private kick: Tone.MembraneSynth | null = null;
  private snareNoise: Tone.NoiseSynth | null = null;
  private snareOsc: Tone.MembraneSynth | null = null;
  private snareFilter: Tone.Filter | null = null;
  private clap: Tone.NoiseSynth | null = null;
  private clapFilter: Tone.Filter | null = null;
  private hatClosed: Tone.MetalSynth | null = null;
  private hatOpen: Tone.MetalSynth | null = null;
  private tom: Tone.MembraneSynth | null = null;
  private crash: Tone.MetalSynth | null = null;
  private ride: Tone.MetalSynth | null = null;
  private bass808: Tone.MembraneSynth | null = null;
  private fxSynth: Tone.FMSynth | null = null;

  /** Stable output node — stays across kit changes */
  public output: Tone.Volume;

  /** Currently loaded kit ID */
  private currentKitId: DrumKitId = 'classic';

  /** Currently selected 808 voice variation */
  private current808Variant: Eight08Variant = 'sub';

  /** Optional distortion insert on the 808 voice (per-variant) */
  private bass808Distortion: Tone.Distortion | null = null;
  private bass808Drive: Tone.Gain | null = null;

  constructor() {
    // -4 dB headroom on the drum bus so stacked voices don't slam the master
    // limiter into clipping (which was causing the muddy/static sound).
    this.output = new Tone.Volume(-4);
    this.loadKit(DRUM_KIT_PRESETS.classic);
  }

  /** Get the currently active kit ID */
  public getActiveKit(): DrumKitId {
    return this.currentKitId;
  }

  /**
   * Load a drum kit preset. Disposes all existing synths, then recreates
   * them with the new preset parameters. The output Volume node is reused.
   */
  public loadKit(preset: DrumKitPreset): void {
    // Dispose old synths before recreating
    this.disposeSynths();

    this.currentKitId = preset.id;

    // ── 1. Kick ──────────────────────────────────────────────
    this.kick = new Tone.MembraneSynth({
      envelope: { ...preset.kick.envelope },
      octaves: preset.kick.octaves,
      pitchDecay: preset.kick.pitchDecay ?? 0.05,
    }).connect(this.output);

    // ── 2. Snare (Layered: Membrane + Noise) ─────────────────
    this.snareFilter = new Tone.Filter({
      type: 'bandpass',
      frequency: preset.snare.filterFreq,
      Q: preset.snare.filterQ,
    }).connect(this.output);

    this.snareNoise = new Tone.NoiseSynth({
      noise: { type: preset.snare.noiseType },
      envelope: {
        attack: 0.002,
        decay: preset.snare.noiseDecay,
        sustain: 0,
        release: preset.snare.noiseDecay,
      },
    }).connect(this.snareFilter);

    this.snareOsc = new Tone.MembraneSynth({
      envelope: {
        attack: 0.001,
        decay: preset.snare.oscDecay,
        sustain: 0,
        release: preset.snare.oscDecay,
      },
      octaves: 2,
    }).connect(this.output);

    // ── 3. Clap (Noise with multi-trigger) ───────────────────
    this.clapFilter = new Tone.Filter({
      type: 'bandpass',
      frequency: preset.clap.filterFreq,
      Q: preset.clap.filterQ,
    }).connect(this.output);

    this.clap = new Tone.NoiseSynth({
      noise: { type: preset.clap.noiseType },
      envelope: {
        attack: 0.001,
        decay: preset.clap.decay,
        sustain: 0,
        release: preset.clap.decay,
      },
    }).connect(this.clapFilter);

    // ── 4. Closed Hat ────────────────────────────────────────
    this.hatClosed = new Tone.MetalSynth({
      envelope: {
        attack: 0.001,
        decay: preset.closedHat.decay,
        release: preset.closedHat.decay,
      },
      resonance: clampResonance(preset.closedHat.resonance),
      harmonicity: preset.closedHat.harmonicity,
    }).connect(this.output);
    this.hatClosed.frequency.setValueAtTime(preset.closedHat.frequency, Tone.now());

    // ── 5. Open Hat ──────────────────────────────────────────
    this.hatOpen = new Tone.MetalSynth({
      envelope: {
        attack: 0.002,
        decay: preset.openHat.decay,
        release: preset.openHat.decay,
      },
      resonance: clampResonance(preset.openHat.resonance),
      harmonicity: preset.openHat.harmonicity,
    }).connect(this.output);
    this.hatOpen.frequency.setValueAtTime(preset.openHat.frequency, Tone.now());

    // ── 6. Tom ───────────────────────────────────────────────
    this.tom = new Tone.MembraneSynth({
      envelope: {
        attack: 0.005,
        decay: preset.tom.decay,
        sustain: 0,
        release: preset.tom.decay,
      },
      octaves: preset.tom.octaves,
    }).connect(this.output);

    // ── 7. Crash ─────────────────────────────────────────────
    this.crash = new Tone.MetalSynth({
      envelope: {
        attack: 0.005,
        decay: preset.crash.decay,
        release: preset.crash.decay,
      },
      resonance: clampResonance(preset.crash.resonance),
      harmonicity: preset.crash.harmonicity,
    }).connect(this.output);
    this.crash.frequency.setValueAtTime(preset.crash.frequency, Tone.now());

    // ── 8. Ride ──────────────────────────────────────────────
    this.ride = new Tone.MetalSynth({
      envelope: {
        attack: 0.002,
        decay: preset.ride.decay,
        release: preset.ride.decay,
      },
      resonance: clampResonance(preset.ride.resonance),
      harmonicity: preset.ride.harmonicity,
    }).connect(this.output);
    this.ride.frequency.setValueAtTime(preset.ride.frequency, Tone.now());

    // ── 9. 808 Sub Bass ──────────────────────────────────────
    // The 808 voice is rebuilt independently via set808Variant so that the
    // selected 808 character persists across kit changes. Build it now using
    // the current variant config (falling back to the kit's note).
    this.rebuild808Voice(preset.bass808.note ?? 'C1');

    // ── 10. FX (Laser / Sweep) ───────────────────────────────
    this.fxSynth = new Tone.FMSynth({
      harmonicity: preset.fx.harmonicity,
      modulationIndex: preset.fx.modulationIndex,
      envelope: {
        attack: 0.01,
        decay: preset.fx.decay,
        sustain: 0.1,
        release: preset.fx.decay,
      },
      modulationEnvelope: {
        attack: 0.01,
        decay: preset.fx.decay * 0.8,
        sustain: 0.1,
        release: preset.fx.decay * 0.8,
      },
    }).connect(this.output);
  }

  /**
   * Load a kit by ID string.
   */
  public loadKitById(kitId: DrumKitId): void {
    const preset = getDrumKitPreset(kitId);
    this.loadKit(preset);
  }

  /** Get the currently selected 808 variant. */
  public getActive808Variant(): Eight08Variant {
    return this.current808Variant;
  }

  /**
   * Switch the 808 voice variation. Rebuilds only the 808 synth (and its
   * optional distortion insert) without disturbing the rest of the kit.
   */
  public set808Variant(variant: Eight08Variant): void {
    if (variant === this.current808Variant && this.bass808) return;
    this.current808Variant = variant;
    const preset = getDrumKitPreset(this.currentKitId);
    this.rebuild808Voice(preset.bass808.note ?? 'C1');
  }

  /**
   * Rebuild the 808 MembraneSynth + optional distortion/drive insert using
   * the active variant config. The kit note is used as the default pitch.
   */
  private rebuild808Voice(kitNote: string): void {
    // Dispose previous 808 chain
    this.bass808?.dispose();
    this.bass808Distortion?.dispose();
    this.bass808Drive?.dispose();
    this.bass808Distortion = null;
    this.bass808Drive = null;

    const cfg: Eight08VariantConfig = EIGHT08_VARIANTS[this.current808Variant];
    const note = cfg.note ?? kitNote;

    // Always create a drive gain so the chain topology is stable; for clean
    // variants drive = 1 (unity) and distortion is bypassed (wet = 0).
    this.bass808Drive = new Tone.Gain(cfg.drive > 0 ? Math.pow(10, cfg.drive / 20) : 1).connect(this.output);

    if (cfg.distortion > 0) {
      this.bass808Distortion = new Tone.Distortion({
        distortion: cfg.distortion,
        oversample: '2x',
        wet: 1,
      }).connect(this.bass808Drive);
    }

    this.bass808 = new Tone.MembraneSynth({
      envelope: { ...cfg.envelope },
      octaves: cfg.octaves,
      pitchDecay: cfg.pitchDecay,
    }).connect(this.bass808Distortion ?? this.bass808Drive);

    // keep note handy
    void note;
  }

  /**
   * Trigger a drum voice.
   *
   * API signatures used:
   *  - MembraneSynth.triggerAttackRelease(note, duration, time?, velocity?)
   *  - MetalSynth.triggerAttackRelease(duration, time?, velocity?)  — NO note
   *  - NoiseSynth.triggerAttackRelease(duration, time?, velocity?)  — NO note
   *  - NoiseSynth.triggerAttack(time?, velocity?) for clap multi-trigger
   */
  public trigger(padId: DrumPadId, time?: number, velocity: number = 0.8): void {
    const t = time ?? Tone.now();
    const preset = getDrumKitPreset(this.currentKitId);

    switch (padId) {
      case 'kick':
        if (this.kick) {
          const kickNote = preset.kick.note ?? 'C1';
          this.kick.triggerAttackRelease(kickNote, '8n', t, velocity);
        }
        break;

      case 'snare':
        // Tonal body of the snare sits around D3 (~147 Hz) — the old G1
        // (~49 Hz) was sub-bass that muddied the mix and clashed with the
        // kick/808. Brighter note = clearer snare crack/body.
        if (this.snareOsc) {
          this.snareOsc.triggerAttackRelease('D3', '16n', t, velocity * 0.6);
        }
        if (this.snareNoise) {
          // NoiseSynth — no note param
          this.snareNoise.triggerAttackRelease('16n', t, velocity * 0.9);
        }
        break;

      case 'clap':
        // Multi-trigger effect: 3 rapid bursts using triggerAttack
        if (this.clap) {
          this.clap.triggerAttack(t, velocity);
          this.clap.triggerAttack(t + 0.01, velocity * 0.8);
          this.clap.triggerAttack(t + 0.02, velocity * 0.9);
        }
        break;

      case 'closedHat':
        // MetalSynth (v15): triggerAttackRelease(note, duration, time, velocity)
        if (this.hatClosed) {
          this.hatClosed.triggerAttackRelease(preset.closedHat.frequency, '32n', t, velocity * 0.7);
        }
        break;

      case 'openHat':
        if (this.hatOpen) {
          this.hatOpen.triggerAttackRelease(preset.openHat.frequency, '8n', t, velocity * 0.6);
        }
        break;

      case 'tom':
        if (this.tom) {
          const tomNote = preset.tom.note ?? 'F2';
          this.tom.triggerAttackRelease(tomNote, '8n', t, velocity);
        }
        break;

      case 'crash':
        if (this.crash) {
          this.crash.triggerAttackRelease(preset.crash.frequency, '2n', t, velocity * 0.5);
        }
        break;

      case 'ride':
        if (this.ride) {
          this.ride.triggerAttackRelease(preset.ride.frequency, '8n', t, velocity * 0.6);
        }
        break;

      case '808':
        if (this.bass808) {
          const variantCfg = EIGHT08_VARIANTS[this.current808Variant];
          const bassNote = variantCfg.note ?? preset.bass808.note ?? 'C1';
          this.bass808.triggerAttackRelease(bassNote, '2n', t, velocity);
        }
        break;

      case 'fx':
        if (this.fxSynth) {
          this.fxSynth.triggerAttackRelease('C4', '2n', t, velocity * 0.5);
          this.fxSynth.frequency.setValueAtTime(400, t);
          this.fxSynth.frequency.exponentialRampToValueAtTime(80, t + 0.4);
        }
        break;
    }
  }

  /** Dispose only the synth voices, keeping the output node */
  private disposeSynths(): void {
    this.kick?.dispose();
    this.snareNoise?.dispose();
    this.snareOsc?.dispose();
    this.snareFilter?.dispose();
    this.clap?.dispose();
    this.clapFilter?.dispose();
    this.hatClosed?.dispose();
    this.hatOpen?.dispose();
    this.tom?.dispose();
    this.crash?.dispose();
    this.ride?.dispose();
    this.bass808?.dispose();
    this.bass808Distortion?.dispose();
    this.bass808Drive?.dispose();
    this.bass808Distortion = null;
    this.bass808Drive = null;
    this.fxSynth?.dispose();

    this.kick = null;
    this.snareNoise = null;
    this.snareOsc = null;
    this.snareFilter = null;
    this.clap = null;
    this.clapFilter = null;
    this.hatClosed = null;
    this.hatOpen = null;
    this.tom = null;
    this.crash = null;
    this.ride = null;
    this.bass808 = null;
    this.fxSynth = null;
  }

  /** Full dispose — including the output node. Call when tearing down the engine. */
  public dispose(): void {
    this.disposeSynths();
    this.output.dispose();
  }
}
