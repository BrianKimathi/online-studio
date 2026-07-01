/**
 * PitchShifterProcessor — Real-time pitch shifter using phase vocoder technique.
 *
 * Parameters:
 *   pitchFactor: 0.5 to 2.0  (1.0 = no shift)
 *   mix:         0.0 to 1.0  (0 = dry, 1 = fully wet)
 *
 * Uses overlap-add with Hann windowing for artifact-free pitch shifting.
 */
class PitchShifterProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'pitchFactor', defaultValue: 1.0, minValue: 0.5, maxValue: 2.0 },
      { name: 'mix', defaultValue: 1.0, minValue: 0.0, maxValue: 1.0 }
    ];
  }

  constructor() {
    super();

    // FFT / overlap-add settings
    this.fftSize = 2048;
    this.hopSize = this.fftSize / 4;  // 4x overlap
    this.halfFFT = this.fftSize / 2;

    // Pre-compute Hann window
    this.window = new Float32Array(this.fftSize);
    for (let i = 0; i < this.fftSize; i++) {
      this.window[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (this.fftSize - 1)));
    }

    // Input ring buffer — accumulates incoming samples
    this.inputBuffer = new Float32Array(this.fftSize * 4);
    this.inputWritePos = 0;

    // Output overlap-add accumulator
    this.outputBuffer = new Float32Array(this.fftSize * 4);
    this.outputReadPos = 0;

    // Phase tracking for vocoder
    this.lastInputPhase = new Float32Array(this.halfFFT + 1);
    this.lastOutputPhase = new Float32Array(this.halfFFT + 1);

    // How many input samples accumulated since last process
    this.samplesAccumulated = 0;

    // Workspace buffers
    this.analysisFrame = new Float32Array(this.fftSize);
    this.synthFrame = new Float32Array(this.fftSize);
    this.magnitudes = new Float32Array(this.halfFFT + 1);
    this.frequencies = new Float32Array(this.halfFFT + 1);

    // Read position in the input buffer (fractional for pitch shifting)
    this.readPosFractional = 0;
  }

  /**
   * Simple in-place DFT using the Cooley-Tukey radix-2 FFT algorithm.
   * real & imag arrays are both length N (must be power of 2).
   * inverse = true for IFFT.
   */
  fft(real, imag, inverse) {
    const N = real.length;
    const halfN = N / 2;

    // Bit-reversal permutation
    for (let i = 1, j = 0; i < N; i++) {
      let bit = halfN;
      while (j & bit) {
        j ^= bit;
        bit >>= 1;
      }
      j ^= bit;
      if (i < j) {
        let tmp = real[i]; real[i] = real[j]; real[j] = tmp;
        tmp = imag[i]; imag[i] = imag[j]; imag[j] = tmp;
      }
    }

    // Cooley-Tukey butterfly
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
          const newCurR = curR * wR - curI * wI;
          curI = curR * wI + curI * wR;
          curR = newCurR;
        }
      }
    }

    // Scale for inverse
    if (inverse) {
      for (let i = 0; i < N; i++) {
        real[i] /= N;
        imag[i] /= N;
      }
    }
  }

  /**
   * Process a single hop of the phase vocoder.
   * Reads from inputBuffer, writes overlapped output into outputBuffer.
   */
  processHop(pitchFactor) {
    const N = this.fftSize;
    const halfN = this.halfFFT;
    const hopSize = this.hopSize;
    const TWO_PI = 2 * Math.PI;
    const expectedPhaseDiff = TWO_PI * hopSize / N;

    // 1. Extract and window the analysis frame from input buffer
    const bufLen = this.inputBuffer.length;
    for (let i = 0; i < N; i++) {
      const idx = ((this.inputWritePos - N + i) % bufLen + bufLen) % bufLen;
      this.analysisFrame[i] = this.inputBuffer[idx] * this.window[i];
    }

    // 2. FFT — convert to frequency domain
    const real = new Float32Array(N);
    const imag = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      real[i] = this.analysisFrame[i];
      imag[i] = 0;
    }
    this.fft(real, imag, false);

    // 3. Analysis: compute magnitude and true frequency for each bin
    for (let k = 0; k <= halfN; k++) {
      const mag = Math.sqrt(real[k] * real[k] + imag[k] * imag[k]);
      let phase = Math.atan2(imag[k], real[k]);

      // Phase difference from expected
      let dp = phase - this.lastInputPhase[k] - k * expectedPhaseDiff;
      // Wrap to [-PI, PI]
      dp = dp - TWO_PI * Math.round(dp / TWO_PI);

      // True frequency (bin center + deviation)
      this.frequencies[k] = k + dp / expectedPhaseDiff;
      this.magnitudes[k] = mag;
      this.lastInputPhase[k] = phase;
    }

    // 4. Synthesis: shift bins by pitchFactor
    const newMagnitudes = new Float32Array(halfN + 1);
    const newFrequencies = new Float32Array(halfN + 1);

    for (let k = 0; k <= halfN; k++) {
      const destBin = Math.round(k * pitchFactor);
      if (destBin >= 0 && destBin <= halfN) {
        newMagnitudes[destBin] += this.magnitudes[k];
        newFrequencies[destBin] = this.frequencies[k] * pitchFactor;
      }
    }

    // 5. Reconstruct phase and convert back to complex
    const synthReal = new Float32Array(N);
    const synthImag = new Float32Array(N);

    for (let k = 0; k <= halfN; k++) {
      const outputPhaseDiff = newFrequencies[k] * expectedPhaseDiff;
      const outputPhase = this.lastOutputPhase[k] + outputPhaseDiff;
      this.lastOutputPhase[k] = outputPhase;

      synthReal[k] = newMagnitudes[k] * Math.cos(outputPhase);
      synthImag[k] = newMagnitudes[k] * Math.sin(outputPhase);

      // Mirror for conjugate symmetry (skip DC and Nyquist)
      if (k > 0 && k < halfN) {
        synthReal[N - k] = synthReal[k];
        synthImag[N - k] = -synthImag[k];
      }
    }

    // 6. IFFT — back to time domain
    this.fft(synthReal, synthImag, true);

    // 7. Window and overlap-add into output buffer
    const outBufLen = this.outputBuffer.length;
    for (let i = 0; i < N; i++) {
      const idx = ((this.outputReadPos + i) % outBufLen + outBufLen) % outBufLen;
      this.outputBuffer[idx] += synthReal[i] * this.window[i];
    }
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const output = outputs[0];

    if (!input || input.length === 0 || !input[0]) {
      return true;
    }

    const pitchFactor = parameters.pitchFactor.length > 1
      ? parameters.pitchFactor
      : parameters.pitchFactor[0];
    const mix = parameters.mix.length > 1
      ? parameters.mix
      : parameters.mix[0];

    const blockSize = input[0].length;
    const numChannels = Math.min(input.length, output.length);
    const bufLen = this.inputBuffer.length;
    const outBufLen = this.outputBuffer.length;

    // Process first channel through pitch shifter, copy result to all channels
    const inputChannel = input[0];
    const pf = typeof pitchFactor === 'number' ? pitchFactor : pitchFactor[0];

    for (let s = 0; s < blockSize; s++) {
      // Push sample into input ring buffer
      this.inputBuffer[this.inputWritePos] = inputChannel[s];
      this.inputWritePos = (this.inputWritePos + 1) % bufLen;
      this.samplesAccumulated++;

      // Process when we have a full hop
      if (this.samplesAccumulated >= this.hopSize) {
        this.processHop(pf);
        this.samplesAccumulated = 0;
        // Advance output read position by hop
        this.outputReadPos = (this.outputReadPos + this.hopSize) % outBufLen;
      }
    }

    // Read from output buffer for this block
    for (let s = 0; s < blockSize; s++) {
      const idx = ((this.outputReadPos - blockSize + s) % outBufLen + outBufLen) % outBufLen;
      const wetSample = this.outputBuffer[idx];

      // Clear the buffer after reading to prevent re-reading
      this.outputBuffer[idx] = 0;

      const m = typeof mix === 'number' ? mix : (mix[s] || 0);

      // Apply mix: blend dry input with wet processed signal
      for (let c = 0; c < numChannels; c++) {
        const dry = input[c] ? input[c][s] : 0;
        if (output[c]) {
          output[c][s] = dry * (1 - m) + wetSample * m;
        }
      }
    }

    return true;
  }
}

registerProcessor('pitch-shifter-processor', PitchShifterProcessor);
