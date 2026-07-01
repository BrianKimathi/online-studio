class NoiseGateProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'threshold', defaultValue: -40, minValue: -100, maxValue: 0 },
      { name: 'attack', defaultValue: 0.01, minValue: 0.001, maxValue: 1.0 },
      { name: 'release', defaultValue: 0.1, minValue: 0.01, maxValue: 2.0 }
    ];
  }

  constructor() {
    super();
    this.envelope = 0;
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const output = outputs[0];
    
    if (!input || input.length === 0) return true;

    const thresholdDb = parameters.threshold[0];
    const thresholdAmp = Math.pow(10, thresholdDb / 20);
    const attack = parameters.attack[0];
    const release = parameters.release[0];

    // Coefficients for envelope filter
    const attackCoef = Math.exp(-1.0 / (attack * sampleRate));
    const releaseCoef = Math.exp(-1.0 / (release * sampleRate));

    const numChannels = input.length;
    const numSamples = input[0].length;

    for (let s = 0; s < numSamples; s++) {
      // Find peak amplitude across channels for this sample
      let rect = 0;
      for (let c = 0; c < numChannels; c++) {
        const val = Math.abs(input[c][s]);
        if (val > rect) rect = val;
      }

      // Envelope follower
      if (rect > this.envelope) {
        this.envelope = attackCoef * (this.envelope - rect) + rect;
      } else {
        this.envelope = releaseCoef * (this.envelope - rect) + rect;
      }

      // Gate gain calculation
      const gain = this.envelope > thresholdAmp ? 1.0 : 0.0;

      // Apply gain to all channels
      for (let c = 0; c < numChannels; c++) {
        if (output[c]) {
          output[c][s] = input[c][s] * gain;
        }
      }
    }

    return true;
  }
}

registerProcessor('noise-gate-processor', NoiseGateProcessor);
