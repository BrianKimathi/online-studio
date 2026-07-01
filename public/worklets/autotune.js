/**
 * AutotuneProcessor — real-time pitch correction for vocal input.
 *
 * Pipeline (per hop):
 *   1. Autocorrelation pitch detection on the analysis frame.
 *   2. Map detected f0 -> nearest allowed semitone (key + scale).
 *   3. Apply global pitchShift + formant scaling via phase vocoder.
 *   4. Smooth the correction ratio by `speed` (0 = slow/soft, 1 = hard tune).
 *   5. Crossfade dry/wet by `mix`. `enabled` gates the whole thing.
 *
 * Parameters (all k-rate AudioParams):
 *   enabled    0|1      master on/off (0 = pass-through dry)
 *   key        0..11    root semitone (0=C, 11=B)
 *   scaleType  0|1      0 = major, 1 = minor
 *   speed      0..1     correction aggression (retune speed)
 *   pitchShift -12..12  global semitone offset applied to corrected pitch
 *   formant    0.5..2   independent spectral envelope scaling
 *   mix        0..1     dry/wet
 *
 * The phase vocoder core is adapted from pitch-shifter.js.
 */
class AutotuneProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'enabled', defaultValue: 0, minValue: 0, maxValue: 1 },
      { name: 'key', defaultValue: 0, minValue: 0, maxValue: 11 },
      { name: 'scaleType', defaultValue: 0, minValue: 0, maxValue: 1 },
      { name: 'speed', defaultValue: 0.5, minValue: 0, maxValue: 1 },
      { name: 'pitchShift', defaultValue: 0, minValue: -12, maxValue: 12 },
      { name: 'formant', defaultValue: 1.0, minValue: 0.5, maxValue: 2.0 },
      { name: 'mix', defaultValue: 1.0, minValue: 0.0, maxValue: 1.0 }
    ];
  }

  constructor() {
    super();

    this.fftSize = 1024;
    this.hopSize = this.fftSize / 4; // 4x overlap
    this.halfFFT = this.fftSize / 2;

    // Hann window
    this.window = new Float32Array(this.fftSize);
    for (let i = 0; i < this.fftSize; i++) {
      this.window[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (this.fftSize - 1)));
    }

    // Ring buffers
    this.inputBuffer = new Float32Array(this.fftSize * 4);
    this.inputWritePos = 0;
    this.outputBuffer = new Float32Array(this.fftSize * 4);
    this.outputReadPos = 0;

    // Phase tracking
    this.lastInputPhase = new Float32Array(this.halfFFT + 1);
    this.lastOutputPhase = new Float32Array(this.halfFFT + 1);

    this.samplesAccumulated = 0;

    // Workspace
    this.analysisFrame = new Float32Array(this.fftSize);
    this.magnitudes = new Float32Array(this.halfFFT + 1);
    this.frequencies = new Float32Array(this.halfFFT + 1);

    // Smoothed correction ratio (1 = no shift)
    this.smoothedRatio = 1.0;

    // Scale tables
    this.majorScale = [0, 2, 4, 5, 7, 9, 11];
    this.minorScale = [0, 2, 3, 5, 7, 8, 10];

    // Detection config — human vocal range ~80-1000 Hz
    this.minFreq = 70;
    this.maxFreq = 1000;
  }

  /** In-place radix-2 Cooley-Tukey FFT. */
  fft(real, imag, inverse) {
    const N = real.length;
    const halfN = N / 2;

    for (let i = 1, j = 0; i < N; i++) {
      let bit = halfN;
      while (j & bit) { j ^= bit; bit >>= 1; }
      j ^= bit;
      if (i < j) {
        let t = real[i]; real[i] = real[j]; real[j] = t;
        t = imag[i]; imag[i] = imag[j]; imag[j] = t;
      }
    }

    for (let size = 2; size <= N; size *= 2) {
      const halfSize = size / 2;
      const angleStep = (inverse ? 2 : -2) * Math.PI / size;
      const wR = Math.cos(angleStep);
      const wI = Math.sin(angleStep);
      for (let i = 0; i < N; i += size) {
        let curR = 1, curI = 0;
        for (let j = 0; j < halfSize; j++) {
          const a = i + j;
          const b = a + halfSize;
          const tR = curR * real[b] - curI * imag[b];
          const tI = curR * imag[b] + curI * real[b];
          real[b] = real[a] - tR;
          imag[b] = imag[a] - tI;
          real[a] += tR;
          imag[a] += tI;
          const n = curR * wR - curI * wI;
          curI = curR * wI + curI * wR;
          curR = n;
        }
      }
    }

    if (inverse) {
      for (let i = 0; i < N; i++) { real[i] /= N; imag[i] /= N; }
    }
  }

  /**
   * Autocorrelation pitch detection (ACF2+) on a windowed frame.
   * Returns f0 in Hz, or 0 if unvoiced / too quiet.
   */
  detectPitch(frame) {
    const N = frame.length;
    const minLag = Math.floor(sampleRate / this.maxFreq);
    const maxLag = Math.ceil(sampleRate / this.minFreq);
    if (maxLag >= N) return 0;

    // RMS gate — skip silence
    let rms = 0;
    for (let i = 0; i < N; i++) rms += frame[i] * frame[i];
    rms = Math.sqrt(rms / N);
    if (rms < 0.01) return 0;

    // Normalized autocorrelation
    const acf = new Float32Array(maxLag + 1);
    for (let lag = 0; lag <= maxLag; lag++) {
      let sum = 0;
      for (let i = 0; i < N - lag; i++) {
        sum += frame[i] * frame[i + lag];
      }
      acf[lag] = sum;
    }

    // ACF[0] is the energy; normalize
    const energy = acf[0];
    if (energy <= 0) return 0;

    // Find first valley after lag 0, then the next peak (better than raw argmax)
    let firstValley = 0;
    for (let i = 1; i < maxLag; i++) {
      if (acf[i] < acf[i - 1]) { firstValley = i; break; }
    }

    let bestLag = -1;
    let bestVal = -Infinity;
    const start = Math.max(minLag, firstValley);
    for (let lag = start; lag <= maxLag; lag++) {
      if (acf[lag] > bestVal) {
        bestVal = acf[lag];
        bestLag = lag;
      }
    }

    if (bestLag < 0) return 0;

    // Confidence: peak height relative to energy
    const confidence = bestVal / energy;
    if (confidence < 0.3) return 0;

    // Parabolic interpolation around the peak for sub-sample accuracy
    if (bestLag > 0 && bestLag < maxLag) {
      const a = acf[bestLag - 1];
      const b = acf[bestLag];
      const c = acf[bestLag + 1];
      const denom = (a - 2 * b + c);
      if (denom !== 0) {
        const shift = 0.5 * (a - c) / denom;
        return sampleRate / (bestLag + shift);
      }
    }
    return sampleRate / bestLag;
  }

  /** MIDI note number for a frequency. */
  freqToMidi(f) {
    return 69 + 12 * Math.log2(f / 440);
  }
  midiToFreq(m) {
    return 440 * Math.pow(2, (m - 69) / 12);
  }

  /** Nearest allowed semitone (within an octave) for a given MIDI note. */
  nearestScaleNote(midi, key, scaleType) {
    const scale = scaleType === 0 ? this.majorScale : this.minorScale;
    let best = null;
    let bestDist = Infinity;
    for (const interval of scale) {
      const candidate = key + interval;
      // Compare octave-equivalent distance
      let diff = (candidate - midi) % 12;
      if (diff > 6) diff -= 12;
      if (diff < -6) diff += 12;
      const d = Math.abs(diff);
      if (d < bestDist) {
        bestDist = d;
        // snap to the same octave as input, offset by diff
        best = Math.round(midi) + diff;
      }
    }
    return best;
  }

  processHop(pitchFactor, formantFactor) {
    const N = this.fftSize;
    const halfN = this.halfFFT;
    const hopSize = this.hopSize;
    const TWO_PI = 2 * Math.PI;
    const expectedPhaseDiff = TWO_PI * hopSize / N;

    // 1. Windowed analysis frame
    const bufLen = this.inputBuffer.length;
    for (let i = 0; i < N; i++) {
      const idx = ((this.inputWritePos - N + i) % bufLen + bufLen) % bufLen;
      this.analysisFrame[i] = this.inputBuffer[idx] * this.window[i];
    }

    // 2. FFT
    const real = new Float32Array(N);
    const imag = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      real[i] = this.analysisFrame[i];
      imag[i] = 0;
    }
    this.fft(real, imag, false);

    // 3. Magnitude + true frequency per bin
    for (let k = 0; k <= halfN; k++) {
      const mag = Math.sqrt(real[k] * real[k] + imag[k] * imag[k]);
      let phase = Math.atan2(imag[k], real[k]);
      let dp = phase - this.lastInputPhase[k] - k * expectedPhaseDiff;
      dp = dp - TWO_PI * Math.round(dp / TWO_PI);
      this.frequencies[k] = k + dp / expectedPhaseDiff;
      this.magnitudes[k] = mag;
      this.lastInputPhase[k] = phase;
    }

    // 4. Synthesis: pitch-shift bins by pitchFactor, formant-shift the
    //    spectral envelope independently by formantFactor.
    const newMagnitudes = new Float32Array(halfN + 1);
    const newFrequencies = new Float32Array(halfN + 1);

    for (let k = 0; k <= halfN; k++) {
      // Pitch maps frequencies; formant maps the magnitude (envelope) placement.
      const destBin = Math.round(k * pitchFactor * formantFactor);
      if (destBin >= 0 && destBin <= halfN) {
        newMagnitudes[destBin] += this.magnitudes[k];
        // Keep the pitch-true frequency (NOT scaled by formant) for phase coherence
        newFrequencies[destBin] = this.frequencies[k] * pitchFactor;
      }
    }

    // 5. Reconstruct phase
    const synthReal = new Float32Array(N);
    const synthImag = new Float32Array(N);
    for (let k = 0; k <= halfN; k++) {
      const outputPhaseDiff = newFrequencies[k] * expectedPhaseDiff;
      const outputPhase = this.lastOutputPhase[k] + outputPhaseDiff;
      this.lastOutputPhase[k] = outputPhase;
      synthReal[k] = newMagnitudes[k] * Math.cos(outputPhase);
      synthImag[k] = newMagnitudes[k] * Math.sin(outputPhase);
      if (k > 0 && k < halfN) {
        synthReal[N - k] = synthReal[k];
        synthImag[N - k] = -synthImag[k];
      }
    }

    // 6. IFFT
    this.fft(synthReal, synthImag, true);

    // 7. Overlap-add into output buffer
    const outBufLen = this.outputBuffer.length;
    for (let i = 0; i < N; i++) {
      const idx = ((this.outputReadPos + i) % outBufLen + outBufLen) % outBufLen;
      this.outputBuffer[idx] += synthReal[i] * this.window[i];
    }
  }

  readParam(parameters, name, sampleIndex) {
    const arr = parameters[name];
    if (arr.length === 1) return arr[0];
    return arr[sampleIndex] ?? arr[0];
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const output = outputs[0];

    if (!input || input.length === 0 || !input[0]) {
      // No input — emit silence and keep node alive
      for (let c = 0; c < output.length; c++) {
        if (output[c]) output[c].fill(0);
      }
      return true;
    }

    const blockSize = input[0].length;
    const bufLen = this.inputBuffer.length;
    const outBufLen = this.outputBuffer.length;
    const inputChannel = input[0];
    const numChannels = Math.min(input.length, output.length);

    // Sample params at block boundaries (k-rate-ish)
    const enabled = this.readParam(parameters, 'enabled', 0) >= 0.5;

    // ── Zero-latency passthrough when autotune is OFF ──────────────
    // The phase vocoder buffers ~fftSize samples (~23ms) which makes live
    // monitoring unusable for karaoke. When disabled, copy input straight to
    // output with no buffering (just keep the input ring buffer fed so
    // detection has context the moment autotune is turned on).
    if (!enabled) {
      for (let c = 0; c < numChannels; c++) {
        if (input[c] && output[c]) output[c].set(input[c]);
      }
      for (let s = 0; s < blockSize; s++) {
        this.inputBuffer[this.inputWritePos] = inputChannel[s];
        this.inputWritePos = (this.inputWritePos + 1) % bufLen;
      }
      // Reset smoothing so we don't apply a stale ratio when re-enabled
      this.smoothedRatio = 1.0;
      this.samplesAccumulated = 0;
      return true;
    }

    const key = Math.round(this.readParam(parameters, 'key', 0));
    const scaleType = this.readParam(parameters, 'scaleType', 0) >= 0.5 ? 1 : 0;
    const speed = this.readParam(parameters, 'speed', 0);
    const pitchShiftSemis = this.readParam(parameters, 'pitchShift', 0);
    const formant = this.readParam(parameters, 'formant', 1);
    const mix = this.readParam(parameters, 'mix', 1);

    // Map speed (0..1) to a per-hop smoothing coefficient (0.02..0.6).
    // Low speed = gradual glide (soft tune), high speed = instant snap (hard tune).
    const speedCoef = 0.02 + speed * 0.58;

    for (let s = 0; s < blockSize; s++) {
      // Push sample into input ring buffer
      this.inputBuffer[this.inputWritePos] = inputChannel[s];
      this.inputWritePos = (this.inputWritePos + 1) % bufLen;
      this.samplesAccumulated++;

      if (this.samplesAccumulated >= this.hopSize) {
        this.samplesAccumulated = 0;

        // Determine target pitch ratio for this hop
        let targetRatio = 1.0;

        if (enabled) {
          // Build a windowed analysis frame for detection (mono)
          const detectFrame = new Float32Array(this.fftSize);
          for (let i = 0; i < this.fftSize; i++) {
            const idx = ((this.inputWritePos - this.fftSize + i) % bufLen + bufLen) % bufLen;
            detectFrame[i] = this.inputBuffer[idx] * this.window[i];
          }

          const f0 = this.detectPitch(detectFrame);
          if (f0 > 0) {
            const midi = this.freqToMidi(f0);
            const snapped = this.nearestScaleNote(midi, key, scaleType);
            const targetMidi = snapped + pitchShiftSemis;
            const targetF = this.midiToFreq(targetMidi);
            targetRatio = targetF / f0;
          } else {
            // Unvoiced — drift back toward no shift to avoid artifacts
            targetRatio = 1.0;
          }
        }

        // Smooth the ratio
        this.smoothedRatio += (targetRatio - this.smoothedRatio) * speedCoef;

        // Only run the (expensive) vocoder when correcting; when disabled we
        // still need to advance the output read pointer to keep latency stable.
        if (enabled && Math.abs(this.smoothedRatio - 1.0) > 0.0005) {
          this.processHop(this.smoothedRatio, formant);
        } else if (enabled) {
          // Ratio ~1: pass through via vocoder unity (still process for formant)
          if (Math.abs(formant - 1.0) > 0.005) {
            this.processHop(1.0, formant);
          }
        }

        this.outputReadPos = (this.outputReadPos + this.hopSize) % outBufLen;
      }
    }

    // Read processed (wet) samples and blend with dry
    for (let s = 0; s < blockSize; s++) {
      const idx = ((this.outputReadPos - blockSize + s) % outBufLen + outBufLen) % outBufLen;
      const wet = this.outputBuffer[idx];
      this.outputBuffer[idx] = 0; // clear after read

      const m = typeof mix === 'number' ? mix : 0;
      for (let c = 0; c < numChannels; c++) {
        const dry = input[c] ? input[c][s] : 0;
        if (output[c]) {
          output[c][s] = dry * (1 - m) + wet * m;
        }
      }
    }

    return true;
  }
}

registerProcessor('autotune-processor', AutotuneProcessor);
