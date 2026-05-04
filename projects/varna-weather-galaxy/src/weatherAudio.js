export class WeatherAudio {
  constructor() {
    this.context = null;
    this.master = null;
    this.droneOsc = null;
    this.droneFilter = null;
    this.droneGain = null;
    this.windSource = null;
    this.windFilter = null;
    this.windGain = null;
    this.rainSource = null;
    this.rainFilter = null;
    this.rainGain = null;
    this.dropGain = null;
    this.thunderGain = null;
    this.enabled = false;
    this.volume = 0.45;
    this.intensity = 0.7;
    this.lastRainDrop = 0;
    this.nextThunderAt = 0;
  }

  async start() {
    if (!this.context) this.createGraph();
    await this.context.resume();
    this.enabled = true;
  }

  stop() {
    if (!this.context) return;
    this.enabled = false;
    this.master.gain.setTargetAtTime(0, this.context.currentTime, 0.12);
  }

  setVolume(volume) {
    this.volume = volume;
    if (this.master && this.enabled) {
      this.master.gain.setTargetAtTime(this.volume, this.context.currentTime, 0.12);
    }
  }

  setIntensity(intensity) {
    this.intensity = intensity;
  }

  createGraph() {
    this.context = new AudioContext();

    this.master = this.context.createGain();
    this.master.gain.value = 0;
    this.master.connect(this.context.destination);

    this.droneFilter = this.context.createBiquadFilter();
    this.droneFilter.type = "lowpass";
    this.droneFilter.frequency.value = 420;
    this.droneFilter.Q.value = 0.5;

    this.droneGain = this.context.createGain();
    this.droneGain.gain.value = 0;
    this.droneFilter.connect(this.droneGain);
    this.droneGain.connect(this.master);

    this.droneOsc = this.context.createOscillator();
    this.droneOsc.type = "sine";
    this.droneOsc.frequency.value = 72;
    this.droneOsc.connect(this.droneFilter);
    this.droneOsc.start();

    this.windFilter = this.context.createBiquadFilter();
    this.windFilter.type = "lowpass";
    this.windFilter.frequency.value = 520;
    this.windFilter.Q.value = 0.7;

    this.windGain = this.context.createGain();
    this.windGain.gain.value = 0;
    this.windFilter.connect(this.windGain);
    this.windGain.connect(this.master);

    this.windSource = this.context.createBufferSource();
    this.windSource.buffer = this.createNoiseBuffer(4);
    this.windSource.loop = true;
    this.windSource.connect(this.windFilter);
    this.windSource.start();

    this.rainFilter = this.context.createBiquadFilter();
    this.rainFilter.type = "highpass";
    this.rainFilter.frequency.value = 1900;

    this.rainGain = this.context.createGain();
    this.rainGain.gain.value = 0;
    this.rainFilter.connect(this.rainGain);
    this.rainGain.connect(this.master);

    this.rainSource = this.context.createBufferSource();
    this.rainSource.buffer = this.createNoiseBuffer(3);
    this.rainSource.loop = true;
    this.rainSource.connect(this.rainFilter);
    this.rainSource.start();

    this.dropGain = this.context.createGain();
    this.dropGain.gain.value = 0.28;
    this.dropGain.connect(this.master);

    this.thunderGain = this.context.createGain();
    this.thunderGain.gain.value = 0.55;
    this.thunderGain.connect(this.master);
  }

  createNoiseBuffer(seconds) {
    const sampleRate = this.context.sampleRate;
    const buffer = this.context.createBuffer(1, sampleRate * seconds, sampleRate);
    const output = buffer.getChannelData(0);
    let previous = 0;

    for (let i = 0; i < output.length; i++) {
      const white = Math.random() * 2 - 1;
      previous = previous * 0.82 + white * 0.18;
      output[i] = previous;
    }

    return buffer;
  }

  update(reading, state) {
    if (!this.context || !reading) return;

    const now = this.context.currentTime;
    const targetMaster = this.enabled ? this.volume : 0;
    this.master.gain.setTargetAtTime(targetMaster, now, 0.16);

    const intensity = state?.intensity ?? this.intensity;
    const humidity = reading.humidityNorm ?? 0.5;
    const temperature = reading.temperatureNorm ?? 0.5;
    const wind = reading.windNorm ?? 0;
    const rain = reading.rainNorm ?? 0;
    const stormMode = state?.mode === "storm";
    const windMode = state?.mode === "wind";
    const rainSignal = Math.max(rain, stormMode ? 0.18 : 0);
    const windSignal = Math.max(wind, humidity * 0.12, stormMode ? 0.16 : 0);
    const stormBoost = stormMode ? 1.9 : 1;
    const windBoost = windMode ? 1.35 : 1;

    this.droneOsc.frequency.setTargetAtTime(52 + humidity * 26 + temperature * 22, now, 0.42);
    this.droneFilter.frequency.setTargetAtTime(240 + humidity * 520 + temperature * 280, now, 0.46);
    this.droneGain.gain.setTargetAtTime((0.006 + humidity * 0.046) * intensity, now, 0.5);

    this.windFilter.frequency.setTargetAtTime(160 + windSignal * 1250 + temperature * 160, now, 0.35);
    this.windFilter.Q.setTargetAtTime(0.45 + windSignal * 1.8, now, 0.35);
    this.windGain.gain.setTargetAtTime((0.018 + windSignal * 0.18) * intensity * stormBoost * windBoost, now, 0.28);

    this.rainFilter.frequency.setTargetAtTime(2400 - rainSignal * 950, now, 0.25);
    this.rainGain.gain.setTargetAtTime(rainSignal * 0.14 * intensity * stormBoost, now, 0.2);

    const dropGap = stormMode ? 0.028 : 0.045;
    const dropChance = rainSignal * intensity * stormBoost * 0.42;
    if (this.enabled && now - this.lastRainDrop > dropGap && Math.random() < dropChance) {
      this.lastRainDrop = now;
      this.playRainDrop(rainSignal, temperature, stormBoost);
    }

    if (this.enabled && stormMode && now >= this.nextThunderAt) {
      this.playThunder(rainSignal, windSignal);
      this.nextThunderAt = now + 5 + Math.random() * 11;
    }
  }

  playRainDrop(rain, temperature, boost) {
    const now = this.context.currentTime;
    const source = this.context.createBufferSource();
    const filter = this.context.createBiquadFilter();
    const gain = this.context.createGain();

    source.buffer = this.createNoiseBuffer(0.08);
    filter.type = "bandpass";
    filter.frequency.value = 1800 + temperature * 2200 + Math.random() * 900;
    filter.Q.value = 6 + Math.random() * 6;

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime((0.018 + rain * 0.05) * this.intensity * boost, now + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.09 + Math.random() * 0.08);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.dropGain);
    source.start(now);
    source.stop(now + 0.18);
  }

  playThunder(rain, wind) {
    const now = this.context.currentTime;
    const rumble = this.context.createOscillator();
    const rumbleGain = this.context.createGain();
    const noise = this.context.createBufferSource();
    const noiseFilter = this.context.createBiquadFilter();
    const noiseGain = this.context.createGain();
    const duration = 2.8 + Math.random() * 1.8;
    const loudness = (0.12 + rain * 0.18 + wind * 0.08) * this.intensity;

    rumble.type = "sine";
    rumble.frequency.setValueAtTime(44 + Math.random() * 14, now);
    rumble.frequency.exponentialRampToValueAtTime(24 + Math.random() * 8, now + duration);
    rumbleGain.gain.setValueAtTime(0.0001, now);
    rumbleGain.gain.linearRampToValueAtTime(loudness, now + 0.08);
    rumbleGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    noise.buffer = this.createNoiseBuffer(duration);
    noiseFilter.type = "lowpass";
    noiseFilter.frequency.setValueAtTime(180, now);
    noiseFilter.frequency.exponentialRampToValueAtTime(54, now + duration);
    noiseGain.gain.setValueAtTime(0.0001, now);
    noiseGain.gain.linearRampToValueAtTime(loudness * 0.75, now + 0.04);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    rumble.connect(rumbleGain);
    rumbleGain.connect(this.thunderGain);
    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.thunderGain);

    rumble.start(now);
    rumble.stop(now + duration);
    noise.start(now);
    noise.stop(now + duration);
  }
}
