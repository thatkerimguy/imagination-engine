import type { SfxrParams } from '@ie/story';

/** sfxr renders at this rate; Web Audio resamples to the output device. */
export const SFXR_RATE = 44100;
const MAX_SECONDS = 6;

/** A fresh sfxr sound: a short square blip. */
export const SFXR_DEFAULTS: SfxrParams = {
  wave: 'square',
  attack: 0,
  sustain: 0.3,
  punch: 0,
  decay: 0.4,
  freq: 0.3,
  freqLimit: 0,
  freqRamp: 0,
  freqDeltaRamp: 0,
  vibratoDepth: 0,
  vibratoSpeed: 0,
  arpMod: 0,
  arpSpeed: 0,
  duty: 0,
  dutyRamp: 0,
  repeatSpeed: 0,
  phaserOffset: 0,
  phaserRamp: 0,
  lpf: 1,
  lpfRamp: 0,
  lpfResonance: 0,
  hpf: 0,
  hpfRamp: 0,
  volume: 0.5,
};

/**
 * Renders an sfxr sound to samples. This follows the original sfxr synthesis (DrPetter, 2007):
 * an 8× supersampled oscillator through a resonant low-pass, a high-pass and a phaser, shaped by
 * an attack/sustain/punch/decay envelope. `random` feeds the noise wave, so tests can fix it.
 */
export function renderSfxr(p: SfxrParams, random: () => number = Math.random): Float32Array {
  let fperiod = 0;
  let fmaxperiod = 0;
  let fslide = 0;
  let fdslide = 0;
  let squareDuty = 0;
  let squareSlide = 0;
  let arpMod = 0;
  let arpTime = 0;
  let arpLimit = 0;
  const noise = new Float32Array(32);
  const refillNoise = () => {
    for (let i = 0; i < 32; i++) noise[i] = random() * 2 - 1;
  };

  // Restarting (the repeat effect) resets pitch and arpeggio but not filters or envelope.
  const restart = () => {
    fperiod = 100 / (p.freq * p.freq + 0.001);
    fmaxperiod = 100 / (p.freqLimit * p.freqLimit + 0.001);
    fslide = 1 - p.freqRamp ** 3 * 0.01;
    fdslide = -(p.freqDeltaRamp ** 3) * 0.000001;
    squareDuty = 0.5 - p.duty * 0.5;
    squareSlide = -p.dutyRamp * 0.00005;
    arpMod = p.arpMod >= 0 ? 1 - p.arpMod ** 2 * 0.9 : 1 + p.arpMod ** 2 * 10;
    arpTime = 0;
    arpLimit = p.arpSpeed === 1 ? 0 : Math.floor((1 - p.arpSpeed) ** 2 * 20000 + 32);
  };
  restart();

  let fltp = 0;
  let fltdp = 0;
  let fltw = p.lpf ** 3 * 0.1;
  const fltwD = 1 + p.lpfRamp * 0.0001;
  const fltdmp = Math.min(0.8, (5 / (1 + p.lpfResonance ** 2 * 20)) * (0.01 + fltw));
  let fltphp = 0;
  let flthp = p.hpf ** 2 * 0.1;
  const flthpD = 1 + p.hpfRamp * 0.0003;
  let vibPhase = 0;
  const vibSpeed = p.vibratoSpeed ** 2 * 0.01;
  const vibAmp = p.vibratoDepth * 0.5;
  let envVol: number;
  let envStage = 0;
  let envTime = 0;
  const envLength = [p.attack ** 2 * 100000, p.sustain ** 2 * 100000, p.decay ** 2 * 100000];
  let fphase = p.phaserOffset ** 2 * 1020 * Math.sign(p.phaserOffset);
  const fdphase = p.phaserRamp ** 2 * Math.sign(p.phaserRamp);
  let iphase: number;
  let ipp = 0;
  const phaser = new Float32Array(1024);
  refillNoise();
  let repTime = 0;
  const repLimit = p.repeatSpeed === 0 ? 0 : Math.floor((1 - p.repeatSpeed) ** 2 * 20000 + 32);

  let phase = 0;
  const total = Math.min(
    Math.ceil(envLength.reduce((s, v) => s + v, 0)) + 3,
    SFXR_RATE * MAX_SECONDS,
  );
  const out = new Float32Array(total);
  let length = 0;

  for (let i = 0; i < total; i++) {
    if (repLimit && ++repTime >= repLimit) {
      repTime = 0;
      restart();
    }
    if (arpLimit && ++arpTime >= arpLimit) {
      arpLimit = 0;
      fperiod *= arpMod;
    }
    fslide += fdslide;
    fperiod *= fslide;
    if (fperiod > fmaxperiod) {
      fperiod = fmaxperiod;
      if (p.freqLimit > 0) break;
    }
    let rfperiod = fperiod;
    if (vibAmp > 0) {
      vibPhase += vibSpeed;
      rfperiod = fperiod * (1 + Math.sin(vibPhase) * vibAmp);
    }
    const period = Math.max(8, Math.floor(rfperiod));
    squareDuty = Math.min(0.5, Math.max(0, squareDuty + squareSlide));

    envTime++;
    while (envTime > (envLength[envStage] ?? 0)) {
      envTime = 0;
      envStage++;
      if (envStage >= 3) break;
    }
    if (envStage >= 3) break;
    const len = envLength[envStage] || 1;
    if (envStage === 0) envVol = envTime / len;
    else if (envStage === 1) envVol = 1 + (1 - envTime / len) * 2 * p.punch;
    else envVol = 1 - envTime / len;

    fphase += fdphase;
    iphase = Math.min(1023, Math.abs(Math.floor(fphase)));
    if (flthpD !== 1) flthp = Math.min(0.1, Math.max(0.00001, flthp * flthpD));

    let sum = 0;
    for (let s = 0; s < 8; s++) {
      phase++;
      if (phase >= period) {
        phase %= period;
        if (p.wave === 'noise') refillNoise();
      }
      const fp = phase / period;
      let sample: number;
      switch (p.wave) {
        case 'square':
          sample = fp < squareDuty ? 0.5 : -0.5;
          break;
        case 'saw':
          sample = 1 - fp * 2;
          break;
        case 'sine':
          sample = Math.sin(fp * 2 * Math.PI);
          break;
        case 'noise':
          sample = noise[Math.floor((phase * 32) / period)] ?? 0;
          break;
      }
      const pp = fltp;
      fltw = Math.min(0.1, Math.max(0, fltw * fltwD));
      if (p.lpf !== 1) {
        fltdp += (sample - fltp) * fltw;
        fltdp -= fltdp * fltdmp;
      } else {
        fltp = sample;
        fltdp = 0;
      }
      fltp += fltdp;
      fltphp += fltp - pp;
      fltphp -= fltphp * flthp;
      sample = fltphp;
      phaser[ipp & 1023] = sample;
      sample += phaser[(ipp - iphase + 1024) & 1023] ?? 0;
      ipp = (ipp + 1) & 1023;
      sum += sample * envVol;
    }
    // Square waves sit at ±0.5; full volume puts a plain tone around -6 dBFS, leaving headroom for punch.
    const value = (sum / 8) * p.volume * 1.2;
    out[i] = Math.max(-1, Math.min(1, value));
    length = i + 1;
  }
  return out.subarray(0, length);
}
