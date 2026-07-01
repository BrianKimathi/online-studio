import * as Tone from 'tone';
import { DrumSynthEngine } from './drumSynth';
import { DrumPadId, Note, MixerChannel } from '../types';
import { DrumKitId, Eight08Variant } from './drumKitPresets';

class AudioEngineClass {
  private initialized = false;

  // Sound Generators
  public drumSynth: DrumSynthEngine | null = null;
  private customPlayers: Map<DrumPadId, Tone.Player> = new Map();
  private polySynth: Tone.PolySynth | null = null;

  public getContextState() {
    return Tone.context ? Tone.context.state : 'not-created';
  }

  public isInit() {
    return this.initialized;
  }

  // Mixer Channels
  private channels: Map<string, Tone.Channel> = new Map();
  private eqs: Map<string, Tone.EQ3> = new Map();
  private insertEffects: Map<string, Tone.ToneAudioNode[]> = new Map();
  // Real instantiated insert effects per channel: ordered list of {id, node, ...}
  private channelEffects: Map<string, { id: string; type: string; node: Tone.ToneAudioNode; bypass: boolean }[]> = new Map();

  // Send Effects Buses
  private reverbBus: Tone.Reverb | null = null;
  private delayBus: Tone.FeedbackDelay | null = null;

  // Sends Gain nodes
  private channelSends: Map<string, { reverb: Tone.Gain; delay: Tone.Gain }> = new Map();

  // Microphone and Monitoring
  private micMedia: Tone.UserMedia | null = null;
  private micGate: AudioWorkletNode | null = null;
  private autotuneNode: AudioWorkletNode | null = null;
  private micEq: Tone.EQ3 | null = null;
  private micComp: Tone.Compressor | null = null;
  private micGainNode: Tone.Gain | null = null;

  // Master Limiter
  private masterLimiter: Tone.Limiter | null = null;
  // Gentle glue compressor sitting before the limiter to catch transients
  // smoothly instead of relying on a brickwall (which caused static/clipping).
  private masterComp: Tone.Compressor | null = null;
  // Highpass on the master bus to remove subsonic mud (<30 Hz) that builds up
  // from kick + 808 + membrane-synth tails and makes the mix unclear.
  private masterHighpass: Tone.Filter | null = null;

  // Metronome click voice
  private metronomeSynth: Tone.MembraneSynth | null = null;
  private metronomeEnabled = false;

  // Active synth instrument type (so piano roll can switch oscillator engines)
  private activeInstrumentType: 'synth' | 'fm' | 'am' | 'mono' = 'synth';

  // ── Background vocals: live harmony voices ───────────────────────────
  // Each harmony voice is a Tone.PitchShift tapped from the post-gain mic
  // signal and summed back into the vocal EQ, so harmonies track the lead
  // vocal in real time. Great for live "background vocal" stacking.
  private harmonyVoices: { shift: Tone.PitchShift; gain: Tone.Gain; enabled: boolean }[] = [];

  // ── Adlib trigger pads: one-shot vocal chops ─────────────────────────
  // A bank of Tone.Players loaded from a recorded vocal take; each pad
  // triggers a different slice (offset/duration) for adlibs / vocal chops.
  private adlibPlayers: Tone.Player[] = [];
  private adlibConfig: { offset: number; duration: number }[] = [];

  // Recorders
  private vocalRecorder: Tone.Recorder | null = null;
  private masterRecorder: Tone.Recorder | null = null;

  // Sequencer playback variables
  private sequencerRepeatId: number | null = null;
  private activeStep = 0;

  // Levels for meters (RMS or Peak)
  private channelMeters: Map<string, Tone.Meter> = new Map();

  constructor() {
    // We will initialize on first user interaction
  }

  public async init() {
    if (this.initialized) return;

    await Tone.start();
    console.log('Audio Context started');

    // Load noise gate AudioWorklet
    try {
      const ctx = Tone.getContext().rawContext;
      await ctx.audioWorklet.addModule('/worklets/noise-gate.js');
      console.log('Noise Gate AudioWorklet loaded');
    } catch (e) {
      console.error('Failed to load Noise Gate AudioWorklet:', e);
    }

    // Load autotune AudioWorklet (pitch detection + phase-vocoder correction)
    try {
      const ctx2 = Tone.getContext().rawContext;
      await ctx2.audioWorklet.addModule('/worklets/autotune.js');
      console.log('Autotune AudioWorklet loaded');
    } catch (e) {
      console.error('Failed to load Autotune AudioWorklet:', e);
    }

    // 1. Master bus chain: masterHighpass (kill subsonic mud) -> masterComp
    //    (gentle glue) -> masterLimiter (brickwall) -> Destination.
    this.masterLimiter = new Tone.Limiter(-0.3).toDestination();
    this.masterComp = new Tone.Compressor({
      threshold: -14,
      ratio: 2.5,
      attack: 0.01,
      release: 0.18,
      knee: 6,
    }).connect(this.masterLimiter);
    this.masterHighpass = new Tone.Filter({ type: 'highpass', frequency: 28, Q: 0.7 }).connect(this.masterComp);

    // 2. Create Reverb & Delay Send Buses (feed into the highpass so sends
    //    also get subsonic-filtered before hitting the compressor/limiter).
    this.reverbBus = new Tone.Reverb({ decay: 1.5, wet: 1.0 }).connect(this.masterHighpass);
    this.reverbBus.ready; // warm up
    this.delayBus = new Tone.FeedbackDelay({ delayTime: 0.333, feedback: 0.3, wet: 1.0 }).connect(this.masterHighpass);

    // 3. Setup Mixer Channels (Master first so others can connect to it)
    this.setupChannel('master');
    this.setupChannel('drums');
    this.setupChannel('synth');
    this.setupChannel('vocals');

    // Route Master Channel into the highpass (-> comp -> limiter -> out)
    const masterChan = this.channels.get('master');
    if (masterChan) {
      masterChan.disconnect();
      masterChan.connect(this.masterHighpass!);
      // Reconnect Master Meter
      const masterMeter = this.channelMeters.get('master');
      if (masterMeter) {
        masterChan.connect(masterMeter);
      }
    }

    // 4. Initialize Sound Generators
    this.drumSynth = new DrumSynthEngine();
    const drumsEq = this.eqs.get('drums');
    if (drumsEq) {
      this.drumSynth.output.connect(drumsEq);
    }

    // Default PolySynth (Polyphonic Synth using FMSynth or Synth)
    // -8 dB keeps polyphonic chords from clipping the synth channel / master
    // limiter, which was the source of the "static" sound on the piano roll.
    this.polySynth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.05, decay: 0.2, sustain: 0.6, release: 0.4 },
      volume: -8,
    });
    const synthEq = this.eqs.get('synth');
    if (synthEq) {
      this.polySynth.connect(synthEq);
    }

    // Metronome click voice — short, bright, routed to the synth channel so it
    // follows the synth mixer strip (and can be muted independently).
    this.metronomeSynth = new Tone.MembraneSynth({
      envelope: { attack: 0.001, decay: 0.05, sustain: 0, release: 0.05 },
      octaves: 6,
      pitchDecay: 0.02,
    });
    if (synthEq) {
      this.metronomeSynth.connect(synthEq);
    }

    // 5. Initialize Microphone & Monitoring Chain
    this.setupMicrophoneChain();

    // 6. Setup Recorders
    this.vocalRecorder = new Tone.Recorder();
    const vocalsChan = this.channels.get('vocals');
    if (vocalsChan) {
      vocalsChan.connect(this.vocalRecorder);
    }

    this.masterRecorder = new Tone.Recorder();
    this.masterLimiter.connect(this.masterRecorder);

    // 7. Setup Sequencer repeating clock
    this.setupSequencerLoop();

    this.initialized = true;
    console.log('Audio Engine initialized successfully');
  }

  private setupChannel(id: string) {
    const chan = new Tone.Channel({ volume: -6, pan: 0 });
    const eq = new Tone.EQ3({ low: 0, mid: 0, high: 0 });
    const meter = new Tone.Meter();

    // Routing: sound source -> EQ3 -> Channel -> Master Channel (if not master itself) -> Meter
    eq.connect(chan);
    
    if (id !== 'master') {
      const masterEq = this.eqs.get('master');
      if (masterEq) {
        chan.connect(masterEq);
      }
    } else {
      chan.connect(Tone.Destination);
    }

    chan.connect(meter);

    this.channels.set(id, chan);
    this.eqs.set(id, eq);
    this.channelMeters.set(id, meter);
    this.insertEffects.set(id, []);

    // Setup sends for Reverb & Delay
    if (id !== 'master') {
      const reverbSend = new Tone.Gain(0).connect(this.reverbBus!);
      const delaySend = new Tone.Gain(0).connect(this.delayBus!);
      
      // Connect channel pre-fader/pan or post? Standard is post-fader:
      chan.connect(reverbSend);
      chan.connect(delaySend);

      this.channelSends.set(id, { reverb: reverbSend, delay: delaySend });
    }
  }

  private async setupMicrophoneChain() {
    this.micMedia = new Tone.UserMedia();
    this.micGainNode = new Tone.Gain(0.7);
    this.micEq = new Tone.EQ3({ low: 0, mid: 0, high: 0 });
    this.micComp = new Tone.Compressor({
      threshold: -24,
      ratio: 4,
      attack: 0.03,
      release: 0.1
    });

    const ctx = Tone.getContext().rawContext;
    
    // Create AudioWorklet Noise Gate if available
    try {
      this.micGate = new AudioWorkletNode(ctx, 'noise-gate-processor');
      const threshParam = this.micGate.parameters.get('threshold');
      if (threshParam) threshParam.value = -45; // default dB
    } catch (e) {
      console.warn('Could not instantiate AudioWorklet Noise Gate, falling back to direct connection');
    }

    // Create AudioWorklet Autotune node if available (sits after the gate)
    try {
      this.autotuneNode = new AudioWorkletNode(ctx, 'autotune-processor', {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        outputChannelCount: [1],
      });
      // Defaults: disabled until the user turns it on in the Voice Editor.
      this.setAutotuneParam('enabled', 0);
      this.setAutotuneParam('key', 0);          // C
      this.setAutotuneParam('scaleType', 0);    // major
      this.setAutotuneParam('speed', 0.5);
      this.setAutotuneParam('pitchShift', 0);
      this.setAutotuneParam('formant', 1.0);
      this.setAutotuneParam('mix', 1.0);
    } catch (e) {
      console.warn('Could not instantiate Autotune worklet, skipping', e);
    }

    // Connect Microphone Chain:
    // micMedia -> micGate -> autotune -> micGainNode -> micEq -> micComp -> vocals mixer channel input (eq)
    const vocalsEq = this.eqs.get('vocals');
    if (vocalsEq) {
      // Determine the node feeding the gain stage (gate -> autotune, or just gate, or mic directly)
      let sourceNode: any = null;
      if (this.micGate) {
        this.micMedia.connect(this.micGate);
        sourceNode = this.micGate;
      }

      if (this.autotuneNode && sourceNode) {
        Tone.connect(sourceNode, this.autotuneNode);
        Tone.connect(this.autotuneNode, this.micGainNode);
      } else if (sourceNode) {
        Tone.connect(sourceNode, this.micGainNode);
      } else {
        // Fallback: mic -> gain -> eq -> comp -> channel input
        this.micMedia.connect(this.micGainNode);
      }

      this.micGainNode.connect(this.micEq);
      this.micEq.connect(this.micComp);
      this.micComp.connect(vocalsEq);

      // ── Harmony voices (background vocals) ─────────────────────────
      // Tap the post-gain mic signal, pitch-shift each by an interval, and
      // sum back into the vocal EQ. Gains start at 0 (muted) until the user
      // enables a harmony in the Voice Editor.
      const harmonyIntervals = [-12, 4, 7, 12]; // oct-dn, 3rd, 5th, oct-up
      this.harmonyVoices = harmonyIntervals.map((interval) => {
        const gain = new Tone.Gain(0).connect(this.micEq!);
        const shift = new Tone.PitchShift({ pitch: interval, windowSize: 0.1, delayTime: 0, feedback: 0 }).connect(gain);
        this.micGainNode!.connect(shift);
        return { shift, gain, enabled: false };
      });
    }
  }

  /** Safely set an AudioParam on the autotune worklet (no-op if not loaded). */
  public setAutotuneParam(name: string, value: number): void {
    if (!this.autotuneNode) return;
    const param = this.autotuneNode.parameters.get(name);
    if (param) {
      param.setTargetAtTime(value, Tone.now(), 0.01);
    }
  }

  /** Toggle autotune bypass (1 = on, 0 = off). */
  public setAutotuneEnabled(enabled: boolean): void {
    this.setAutotuneParam('enabled', enabled ? 1 : 0);
  }

  public setAutotuneKey(keySemitone: number): void {
    this.setAutotuneParam('key', keySemitone);
  }

  public setAutotuneScale(scale: 'major' | 'minor'): void {
    this.setAutotuneParam('scaleType', scale === 'major' ? 0 : 1);
  }

  public setAutotuneSpeed(speed01: number): void {
    this.setAutotuneParam('speed', speed01);
  }

  public setAutotunePitch(semitones: number): void {
    this.setAutotuneParam('pitchShift', semitones);
  }

  public setAutotuneFormant(formant: number): void {
    this.setAutotuneParam('formant', formant);
  }

  public setAutotuneMix(mix: number): void {
    this.setAutotuneParam('mix', mix);
  }

  // ── Background vocals: harmony voices ────────────────────────────────
  /**
   * Enable/disable a harmony voice. index 0..3 maps to the intervals
   * [-12, +4, +7, +12] (octave down, major 3rd, 5th, octave up).
   * `level` is 0..1.
   */
  public setHarmonyVoice(index: number, enabled: boolean, level: number = 0.6): void {
    const voice = this.harmonyVoices[index];
    if (!voice) return;
    voice.enabled = enabled;
    voice.gain.gain.setTargetAtTime(enabled ? level : 0, Tone.now(), 0.02);
  }

  /** Change the pitch interval (semitones) of a harmony voice. */
  public setHarmonyInterval(index: number, semitones: number): void {
    const voice = this.harmonyVoices[index];
    if (!voice) return;
    voice.shift.pitch = semitones;
  }

  // ── Adlib trigger pads: one-shot vocal chops ─────────────────────────
  /**
   * Load a recorded vocal take (blob URL) and slice it into `padCount`
   * equal chunks. Each pad then triggers its slice as a one-shot.
   */
  public async loadAdlibPads(blobUrl: string, padCount: number = 8): Promise<number> {
    await this.init();
    // Dispose previous adlib players
    this.disposeAdlibPads();

    const vocalsEq = this.eqs.get('vocals');

    // We need the duration to slice; load a probe Player first.
    const probe = new Tone.Player({ url: blobUrl, onload: () => {} });
    await probe.load(blobUrl);
    const totalDuration = probe.buffer.duration;
    probe.dispose();

    const sliceDuration = totalDuration / padCount;
    this.adlibConfig = [];
    for (let i = 0; i < padCount; i++) {
      this.adlibConfig.push({ offset: i * sliceDuration, duration: sliceDuration });
      const player = new Tone.Player({ url: blobUrl, autostart: false });
      if (vocalsEq) player.connect(vocalsEq);
      this.adlibPlayers.push(player);
    }
    // Ensure all are loaded before triggering
    await Promise.all(this.adlibPlayers.map((p) => p.load(blobUrl)));
    return padCount;
  }

  /** Trigger an adlib pad by index. */
  public triggerAdlib(padIndex: number, velocity: number = 0.9): void {
    const player = this.adlibPlayers[padIndex];
    const cfg = this.adlibConfig[padIndex];
    if (!player || !cfg || !player.loaded) return;
    try {
      player.volume.setValueAtTime(20 * Math.log10(velocity || 0.001), Tone.now());
      player.start(undefined, cfg.offset, cfg.duration);
    } catch (e) {
      console.warn('Adlib trigger failed', e);
    }
  }

  /** Preview a single pad's slice offset (for assigning custom slices). */
  public setAdlibSlice(padIndex: number, offset: number, duration: number): void {
    if (padIndex < 0 || padIndex >= this.adlibConfig.length) return;
    this.adlibConfig[padIndex] = { offset, duration };
  }

  public disposeAdlibPads(): void {
    for (const p of this.adlibPlayers) {
      try { p.dispose(); } catch { /* noop */ }
    }
    this.adlibPlayers = [];
    this.adlibConfig = [];
  }

  public hasAdlibPads(): boolean {
    return this.adlibPlayers.length > 0 && this.adlibPlayers.some((p) => p.loaded);
  }

  // Live monitor toggle
  public setMicMonitoring(enabled: boolean) {
    if (!this.micMedia) return;
    
    const vocalsChan = this.channels.get('vocals');
    if (!vocalsChan) return;

    if (enabled) {
      vocalsChan.mute = false;
    } else {
      // If we disable monitoring, we mute the vocal channel in output
      // Note: we can still record from it since recorder connects directly to vocalsChan,
      // but to hear live singing we unmute.
      vocalsChan.mute = true;
    }
  }

  public async enableMic(enabled: boolean): Promise<boolean> {
    if (!this.micMedia) return false;
    try {
      if (enabled) {
        await this.micMedia.open();
        return true;
      } else {
        await this.micMedia.close();
        return false;
      }
    } catch (e) {
      console.error('Error opening microphone:', e);
      return false;
    }
  }

  public setMicGain(value: number) {
    if (this.micGainNode) {
      this.micGainNode.gain.setValueAtTime(value, Tone.now());
    }
  }

  public setMicGateThreshold(value: number) {
    if (this.micGate) {
      const thresh = this.micGate.parameters.get('threshold');
      if (thresh) thresh.setValueAtTime(value, Tone.now());
    }
  }

  // Switch the active drum kit. Ensures the engine is initialized first.
  public async setDrumKit(kitId: DrumKitId): Promise<void> {
    await this.init();
    if (this.drumSynth) {
      this.drumSynth.loadKitById(kitId);
    }
  }

  // Switch the 808 voice variation.
  public async set808Variant(variant: Eight08Variant): Promise<void> {
    await this.init();
    if (this.drumSynth) {
      this.drumSynth.set808Variant(variant);
    }
  }

  // Trigger synthetic drum sound or custom sample
  public playDrum(padId: DrumPadId, velocity: number = 0.8) {
    const player = this.customPlayers.get(padId);
    if (player && player.loaded) {
      // Trigger user sample
      player.volume.setValueAtTime(20 * Math.log10(velocity || 0.001), Tone.now());
      player.start(undefined, 0);
    } else if (this.drumSynth) {
      // Trigger synth drum
      this.drumSynth.trigger(padId, undefined, velocity);
    }
  }

  // Play piano roll MIDI note
  public playSynthNote(pitch: string, duration: string | number, time?: number, velocity: number = 0.8) {
    if (this.polySynth) {
      this.polySynth.triggerAttackRelease(pitch, duration, time, velocity);
    }
  }

  // Register custom sample Blob URL for a drum pad
  public setCustomSample(padId: DrumPadId, blobUrl: string) {
    // Dispose previous player if any
    const oldPlayer = this.customPlayers.get(padId);
    if (oldPlayer) oldPlayer.dispose();

    const drumsEq = this.eqs.get('drums');
    const player = new Tone.Player({
      url: blobUrl,
      autostart: false,
      onload: () => console.log(`Loaded custom sample for ${padId}`),
      onerror: (err) => console.error(`Error loading custom sample for ${padId}:`, err)
    });

    if (drumsEq) {
      player.connect(drumsEq);
    }
    this.customPlayers.set(padId, player);
  }

  // Update Mixer Channel controls
  public updateChannelVolume(channelId: string, db: number) {
    const chan = this.channels.get(channelId);
    if (chan) {
      chan.volume.setValueAtTime(db, Tone.now());
    }
  }

  public updateChannelPan(channelId: string, pan: number) {
    const chan = this.channels.get(channelId);
    if (chan) {
      chan.pan.setValueAtTime(pan, Tone.now());
    }
  }

  public updateChannelMute(channelId: string, mute: boolean) {
    const chan = this.channels.get(channelId);
    if (chan) {
      chan.mute = mute;
    }
  }

  public updateChannelSolo(channelId: string, solo: boolean) {
    const chan = this.channels.get(channelId);
    if (chan) {
      chan.solo = solo;
    }
  }

  public updateChannelEq(channelId: string, band: 'low' | 'mid' | 'high', gainDb: number) {
    const eq = this.eqs.get(channelId);
    if (eq) {
      eq[band].setValueAtTime(gainDb, Tone.now());
    }
  }

  public updateChannelSends(channelId: string, sendType: 'reverb' | 'delay', amount: number) {
    const sends = this.channelSends.get(channelId);
    if (sends) {
      sends[sendType].gain.setValueAtTime(amount, Tone.now());
    }
  }

  // ── Channel insert effects (real Tone nodes) ─────────────────────────
  // The insert chain sits between the channel EQ and the channel fader:
  //   source -> EQ -> [fx0 -> fx1 -> ...] -> Channel -> master
  // Bypassed effects are excluded from the wiring (true hardware bypass).

  private createEffectNode(type: string, params: Record<string, any>): Tone.ToneAudioNode {
    switch (type) {
      case 'reverb':
        return new Tone.Reverb({
          decay: params.roomSize ? params.roomSize * 4 : 2,
          wet: params.wet ?? 0.4,
        });
      case 'delay':
        return new Tone.FeedbackDelay({
          delayTime: params.delayTime ?? 0.333,
          feedback: params.feedback ?? 0.3,
          wet: params.wet ?? 0.4,
        });
      case 'compressor':
        return new Tone.Compressor({
          threshold: params.threshold ?? -24,
          ratio: params.ratio ?? 4,
          attack: params.attack ?? 0.03,
          release: params.release ?? 0.1,
        });
      case 'distortion':
        return new Tone.Distortion({
          distortion: params.distortion ?? 0.4,
          oversample: '2x',
          wet: params.wet ?? 0.5,
        });
      case 'chorus': {
        const c = new Tone.Chorus({
          frequency: params.frequency ?? 1.5,
          delayTime: params.delayTime ?? 3.5,
          depth: params.depth ?? 0.7,
          wet: params.wet ?? 0.5,
        }).start();
        return c;
      }
      case 'gate':
        return new Tone.Gate({
          threshold: params.threshold ?? -40,
          smoothing: params.smoothing ?? 0.1,
        });
      case 'tremolo':
        return new Tone.Tremolo({ frequency: params.frequency ?? 5, depth: params.depth ?? 0.7, wet: params.wet ?? 0.5 }).start();
      case 'eq3':
        return new Tone.EQ3({ low: 0, mid: 0, high: 0 });
      default:
        return new Tone.Gain(1);
    }
  }

  /** Apply a single param value to an effect node (best-effort). */
  private applyEffectParam(node: Tone.ToneAudioNode, type: string, paramName: string, value: any) {
    try {
      if (type === 'reverb' && paramName === 'wet') (node as any).wet.setValueAtTime(value, Tone.now());
      else if (type === 'delay' && ['delayTime', 'feedback', 'wet'].includes(paramName)) (node as any)[paramName].setValueAtTime(value, Tone.now());
      else if (type === 'compressor' && ['threshold', 'ratio', 'attack', 'release'].includes(paramName)) (node as any)[paramName].setValueAtTime(value, Tone.now());
      else if (type === 'distortion' && paramName === 'wet') (node as any).wet.setValueAtTime(value, Tone.now());
      else if (type === 'distortion' && paramName === 'distortion') (node as any).distortion = value;
      else if (type === 'chorus' && ['frequency', 'depth', 'wet'].includes(paramName)) (node as any)[paramName].setValueAtTime(value, Tone.now());
      else if (type === 'gate' && ['threshold', 'smoothing'].includes(paramName)) (node as any)[paramName].setValueAtTime(value, Tone.now());
      else if (type === 'tremolo' && ['frequency', 'depth', 'wet'].includes(paramName)) (node as any)[paramName].setValueAtTime(value, Tone.now());
      else if (type === 'eq3' && ['low', 'mid', 'high'].includes(paramName)) (node as any)[paramName].setValueAtTime(value, Tone.now());
    } catch (e) {
      console.warn('Could not apply effect param', type, paramName, e);
    }
  }

  public addChannelEffect(channelId: string, effectId: string, type: string, params: Record<string, any>): void {
    const eq = this.eqs.get(channelId);
    const chan = this.channels.get(channelId);
    if (!eq || !chan) return;

    const node = this.createEffectNode(type, params);
    let list = this.channelEffects.get(channelId);
    if (!list) { list = []; this.channelEffects.set(channelId, list); }
    list.push({ id: effectId, type, node, bypass: false });
    this.rebuildChannelInserts(channelId);
  }

  public removeChannelEffect(channelId: string, effectId: string): void {
    const list = this.channelEffects.get(channelId);
    if (!list) return;
    const idx = list.findIndex((e) => e.id === effectId);
    if (idx === -1) return;
    const removed = list.splice(idx, 1)[0];
    try { removed.node.disconnect(); (removed.node as any).dispose?.(); } catch { /* noop */ }
    this.rebuildChannelInserts(channelId);
  }

  public setChannelEffectBypass(channelId: string, effectId: string, bypass: boolean): void {
    const list = this.channelEffects.get(channelId);
    if (!list) return;
    const fx = list.find((e) => e.id === effectId);
    if (!fx) return;
    fx.bypass = bypass;
    this.rebuildChannelInserts(channelId);
  }

  public updateChannelEffectParam(channelId: string, effectId: string, paramName: string, value: any): void {
    const list = this.channelEffects.get(channelId);
    if (!list) return;
    const fx = list.find((e) => e.id === effectId);
    if (!fx) return;
    this.applyEffectParam(fx.node, fx.type, paramName, value);
  }

  /** Rewire EQ -> [active fx] -> Channel for a given channel. */
  private rebuildChannelInserts(channelId: string): void {
    const eq = this.eqs.get(channelId);
    const chan = this.channels.get(channelId);
    if (!eq || !chan) return;

    // Tear down existing wiring from eq onward
    try { eq.disconnect(); } catch { /* noop */ }
    const list = this.channelEffects.get(channelId) ?? [];
    for (const fx of list) {
      try { fx.node.disconnect(); } catch { /* noop */ }
    }

    const active = list.filter((fx) => !fx.bypass);
    if (active.length === 0) {
      eq.connect(chan);
      return;
    }
    // eq -> fx0 -> fx1 -> ... -> chan
    eq.connect(active[0].node);
    for (let i = 0; i < active.length - 1; i++) {
      active[i].node.connect(active[i + 1].node);
    }
    active[active.length - 1].node.connect(chan);
  }

  // Get current volume level meters
  public getChannelLevel(channelId: string): number {
    const meter = this.channelMeters.get(channelId);
    if (!meter) return -Infinity;
    const value = meter.getValue();
    if (Array.isArray(value)) {
      // For stereo meters, average them
      return (value[0] + value[1]) / 2;
    }
    return value;
  }

  // Transport Controls
  public startTransport() {
    Tone.Transport.start();
  }

  public stopTransport() {
    Tone.Transport.stop();
    this.activeStep = 0;
    
    // Update active step in transport store
    if ((window as any)._transportStore) {
      (window as any)._transportStore.getState().setActiveStep(0);
    }
  }

  public pauseTransport() {
    Tone.Transport.pause();
  }

  public setBPM(bpm: number) {
    Tone.Transport.bpm.setValueAtTime(bpm, Tone.now());
  }

  public setSwing(swing: number) {
    Tone.Transport.swing = swing;
  }

  // Metronome on/off
  public setMetronomeEnabled(enabled: boolean) {
    this.metronomeEnabled = enabled;
  }

  // Transport loop wiring — loopLength in bars
  public setLoopEnabled(enabled: boolean, loopLength: number = 4) {
    Tone.Transport.loop = enabled;
    if (enabled) {
      Tone.Transport.loopStart = 0;
      Tone.Transport.loopEnd = `${loopLength}m`;
    }
  }

  public setLoopLength(loopLength: number) {
    if (Tone.Transport.loop) {
      Tone.Transport.loopEnd = `${loopLength}m`;
    }
  }

  /**
   * Switch the piano-roll synth engine. Reconstructs the PolySynth with the
   * chosen voice type and reconnects it to the synth channel EQ. Preserves
   * the current ADSR envelope where possible.
   */
  public setInstrumentType(type: 'synth' | 'fm' | 'am' | 'mono') {
    if (this.activeInstrumentType === type && this.polySynth) return;
    this.activeInstrumentType = type;

    const synthEq = this.eqs.get('synth');
    if (!synthEq) return;

    // Dispose old synth
    if (this.polySynth) {
      this.polySynth.disconnect();
      this.polySynth.dispose();
      this.polySynth = null;
    }

    const env = { attack: 0.05, decay: 0.2, sustain: 0.6, release: 0.4 };

    if (type === 'fm') {
      this.polySynth = new Tone.PolySynth(Tone.FMSynth, {
        harmonicity: 3,
        modulationIndex: 10,
        envelope: env,
        volume: -8,
      });
    } else if (type === 'am') {
      this.polySynth = new Tone.PolySynth(Tone.AMSynth, {
        harmonicity: 2,
        envelope: env,
        volume: -8,
      });
    } else if (type === 'mono') {
      // Monophonic-style bass lead (still PolySynth so chords don't crash)
      this.polySynth = new Tone.PolySynth(Tone.MonoSynth, {
        oscillator: { type: 'sawtooth' },
        envelope: { attack: 0.01, decay: 0.2, sustain: 0.5, release: 0.3 },
        filter: { Q: 2, type: 'lowpass', rolloff: -24 },
        filterEnvelope: { attack: 0.01, decay: 0.2, sustain: 0.4, release: 0.3, baseFrequency: 200, octaves: 4 },
        volume: -8,
      });
    } else {
      this.polySynth = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'triangle' },
        envelope: env,
        volume: -8,
      });
    }

    this.polySynth.connect(synthEq);
  }

  // Set active instrument preset (ADSR envelope and filter)
  public updateSynthPreset(preset: any) {
    if (!this.polySynth) return;

    // Apply envelope
    this.polySynth.set({
      envelope: {
        attack: preset.envelope.attack,
        decay: preset.envelope.decay,
        sustain: preset.envelope.sustain,
        release: preset.envelope.release
      }
    });

    // Apply filter if supported, or change instrument type
    if (preset.type === 'fm') {
      // Re-instantiate as FMSynth if necessary
      // For simpler presets, we can just change parameters
    }
  }

  // Custom step sequencer loop
  private setupSequencerLoop() {
    this.sequencerRepeatId = Tone.Transport.scheduleRepeat((time) => {
      // Trigger drum pads
      const sequencerStore = (window as any)._sequencerStore;
      const transportStore = (window as any)._transportStore;
      
      if (sequencerStore && transportStore) {
        const { patterns, activePatternId, stepCount } = sequencerStore.getState();
        const activePattern = patterns.find((p: any) => p.id === activePatternId);

        if (activePattern) {
          const step = this.activeStep % stepCount;
          
          // Play each active pad for this step
          Object.keys(activePattern.steps).forEach((padKey) => {
            const padId = padKey as DrumPadId;
            const stepObj = activePattern.steps[padId]?.[step];
            if (stepObj?.active) {
              this.playDrumAtTime(padId, time, stepObj.velocity);
            }
          });

          // Metronome: click on every quarter note (step % 4 === 0), accent the
          // downbeat of each bar.
          if (this.metronomeEnabled && this.metronomeSynth) {
            const stepInBar = step % 16;
            if (stepInBar % 4 === 0) {
              const isDownbeat = stepInBar === 0;
              this.metronomeSynth.triggerAttackRelease(
                isDownbeat ? 'C6' : 'E5',
                '32n',
                time,
                isDownbeat ? 0.9 : 0.5
              );
            }
          }

          // Highlight active step in React UI + update transport position
          transportStore.getState().setActiveStep(step);
          const pos = Tone.Transport.position.toString();
          transportStore.getState().setPosition(pos);
          
          // Play piano roll melody notes starting at this time offset
          this.playPianoRollNotesAtTime(time, step, stepCount);

          this.activeStep++;
        }
      }
    }, '16n');
  }

  private playDrumAtTime(padId: DrumPadId, time: number, velocity: number = 0.8) {
    const player = this.customPlayers.get(padId);
    if (player && player.loaded) {
      player.volume.setValueAtTime(20 * Math.log10(velocity || 0.001), time);
      player.start(time, 0);
    } else if (this.drumSynth) {
      this.drumSynth.trigger(padId, time, velocity);
    }
  }

  // Play piano roll notes matching the sequencer grid step
  private playPianoRollNotesAtTime(time: number, stepIndex: number, totalSteps: number) {
    const pianoStore = (window as any)._pianoRollStore;
    const transportStore = (window as any)._transportStore;
    if (!pianoStore || !transportStore) return;

    const { notes } = pianoStore.getState();
    const { loopLength } = transportStore.getState();

    // A loop length of 4 bars at 16 steps per bar = 64 sixteenth-note steps total
    // The current step is in steps of sixteenth-notes.
    const ticksPerStep = Tone.Time('16n').toSeconds();
    const currentStepInLoop = stepIndex % (loopLength * 16);
    const timeOffsetInLoop = currentStepInLoop * ticksPerStep;

    notes.forEach((note: Note) => {
      // Check if note start time is within the time slot of this step
      // note.time is in seconds relative to project start
      const nextStepTime = timeOffsetInLoop + ticksPerStep;
      
      if (note.time >= timeOffsetInLoop && note.time < nextStepTime) {
        const pitch = note.pitch;
        const duration = note.duration;
        const velocity = note.velocity;
        
        // Trigger polySynth note at sample accurate time
        this.playSynthNote(pitch, duration, time + (note.time - timeOffsetInLoop), velocity);
      }
    });
  }

  // Audio Recording (Vocals / Mixdown)
  public async startRecording(mode: 'vocals' | 'mix') {
    if (mode === 'vocals') {
      if (this.vocalRecorder) {
        this.vocalRecorder.start();
        console.log('Vocal recording started');
      }
    } else {
      if (this.masterRecorder) {
        this.masterRecorder.start();
        console.log('Master recording started');
      }
    }
  }

  public async stopRecording(mode: 'vocals' | 'mix'): Promise<string> {
    if (mode === 'vocals' && this.vocalRecorder) {
      const recording = await this.vocalRecorder.stop();
      const url = URL.createObjectURL(recording);
      console.log('Vocal recording stopped, URL:', url);
      return url;
    } else if (mode === 'mix' && this.masterRecorder) {
      const recording = await this.masterRecorder.stop();
      const url = URL.createObjectURL(recording);
      console.log('Master mix recording stopped, URL:', url);
      return url;
    }
    return '';
  }

  /**
   * Export the current beat to a real WAV file. Captures the master bus in
   * real time for one full loop, then returns the recorded Blob. The caller
   * is responsible for starting/stopping the transport if it isn't already
   * running — here we ensure playback runs for the full loop duration.
   */
  public async exportMix(loopLengthBars: number, bpm: number): Promise<Blob> {
    await this.init();
    if (!this.masterRecorder) throw new Error('Master recorder unavailable');

    const secondsPerBar = (60 / bpm) * 4;
    const duration = secondsPerBar * loopLengthBars + 0.5; // tail

    // Reset to start of loop for a clean capture
    Tone.Transport.position = 0;
    const wasPlaying = Tone.Transport.state === 'started';
    if (!wasPlaying) {
      Tone.Transport.start();
    }

    this.masterRecorder.start();

    // Wait for the loop to render in real time.
    await new Promise<void>((resolve) => setTimeout(() => resolve(), duration * 1000));

    const blob = await this.masterRecorder.stop();

    if (!wasPlaying) {
      Tone.Transport.stop();
      this.activeStep = 0;
      const ts = (window as any)._transportStore;
      if (ts) ts.getState().setActiveStep(0);
    }

    return blob;
  }

  // (Legacy stub kept for API compatibility — prefer exportMix.)
  public async exportToWav(durationSeconds: number): Promise<Blob> {
    return this.exportMix(Math.max(1, Math.round(durationSeconds / 2)), 120);
  }
}

export const AudioEngine = new AudioEngineClass();
