export class WeatherAudio {
  constructor() {
    this.context = null;
    this.master = null;
    this.droneA = null;
    this.droneB = null;
    this.droneGain = null;
    this.windSource = null;
    this.windGain = null;
    this.windFilter = null;
    this.rainGain = null;
    this.enabled = false;
    this.volume = 0.45;
    this.intensity = 0.7;
    this.lastRainTick = 0;
  }

  async start() {
    if (!this.context) this.createGraph();
    await this.context.resume();
    this.enabled = true;
  }

  stop() {
    if (!this.context) return;
    this.enabled = false;
    this.master.gain.setTargetAtTime(0, this.context.currentTime, 0.08);
  }

  setVolume(volume) {
    this.volume = volume;
    if (this.master && this.enabled) {
      this.master.gain.setTargetAtTime(this.volume, this.context.currentTime, 0.08);
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

    this.droneGain = this.context.createGain();
    this.droneGain.gain.value = 0;
    this.droneGain.connect(this.master);

    this.droneA = this.context.createOscillator();
    this.droneA.type = "sine";
    this.droneA.frequency.value = 72;
    this.droneA.connect(this.droneGain);
    this.droneA.start();

    this.droneB = this.context.createOscillator();
    this.droneB.type = "triangle";
    this.droneB.frequency.value = 108;
    this.droneB.connect(this.droneGain);
    this.droneB.start();

    this.windFilter = this.context.createBiquadFilter();
    this.windFilter.type = "bandpass";
    this.windFilter.frequency.value = 640;
    this.windFilter.Q.value = 0.9;

    this.windGain = this.context.createGain();
    this.windGain.gain.value = 0;
    this.windFilter.connect(this.windGain);
    this.windGain.connect(this.master);

    this.windSource = this.context.createBufferSource();
    this.windSource.buffer = this.createNoiseBuffer();
    this.windSource.loop = true;
    this.windSource.connect(this.windFilter);
    this.windSource.start();

    this.rainGain = this.context.createGain();
    this.rainGain.gain.value = 0.18;
    this.rainGain.connect(this.master);
  }

  createNoiseBuffer() {
    const sampleRate = this.context.sampleRate;
    const buffer = this.context.createBuffer(1, sampleRate * 2, sampleRate);
    const output = buffer.getChannelData(0);
    for (let i = 0; i < output.length; i++) {
      output[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  update(reading, state) {
    if (!this.context || !reading) return;
    const now = this.context.currentTime;
    const targetMaster = this.enabled ? this.volume : 0;
    this.master.gain.setTargetAtTime(targetMaster, now, 0.12);

    const intensity = state?.intensity ?? this.intensity;
    const humidity = reading.humidityNorm ?? 0.5;
    const temperature = reading.temperatureNorm ?? 0.5;
    const wind = reading.windNorm ?? 0;
    const rain = reading.rainNorm ?? 0;
    const modeBoost = state?.mode === "storm" ? 1.35 : state?.mode === "wind" ? 1.2 : 1;

    this.droneA.frequency.setTargetAtTime(48 + temperature * 92, now, 0.18);
    this.droneB.frequency.setTargetAtTime(72 + humidity * 88 + temperature * 28, now, 0.18);
    this.droneGain.gain.setTargetAtTime((0.035 + humidity * 0.09) * intensity, now, 0.18);

    this.windFilter.frequency.setTargetAtTime(260 + wind * 1800, now, 0.16);
    this.windFilter.Q.setTargetAtTime(0.6 + wind * 5, now, 0.16);
    this.windGain.gain.setTargetAtTime(wind * 0.16 * intensity * modeBoost, now, 0.14);

    if (this.enabled && now - this.lastRainTick > 0.07 && Math.random() < rain * intensity * modeBoost * 0.34) {
      this.lastRainTick = now;
      this.playRainTick(rain, temperature);
    }
  }

  playRainTick(rain, temperature) {
    const now = this.context.currentTime;
    const tick = this.context.createOscillator();
    const gain = this.context.createGain();
    const filter = this.context.createBiquadFilter();

    tick.type = "sine";
    tick.frequency.value = 900 + temperature * 1700 + Math.random() * 900;
    filter.type = "highpass";
    filter.frequency.value = 700;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime((0.015 + rain * 0.055) * this.intensity, now + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);

    tick.connect(filter);
    filter.connect(gain);
    gain.connect(this.rainGain);
    tick.start(now);
    tick.stop(now + 0.13);
  }
}
