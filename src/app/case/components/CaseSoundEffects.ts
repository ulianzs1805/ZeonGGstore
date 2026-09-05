"use client";

let audioContext: AudioContext | null = null;

const getContext = () => {
  if (typeof window === "undefined") return null;
  if (!audioContext) audioContext = new window.AudioContext();
  if (audioContext.state === "suspended") void audioContext.resume();
  return audioContext;
};

const tone = (ctx: AudioContext, frequency: number, start: number, duration: number, gain: number, type: OscillatorType = "sine", endFrequency?: number) => {
  const oscillator = ctx.createOscillator();
  const volume = ctx.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  if (endFrequency) oscillator.frequency.exponentialRampToValueAtTime(endFrequency, start + duration);
  volume.gain.setValueAtTime(0.0001, start);
  volume.gain.exponentialRampToValueAtTime(gain, start + 0.012);
  volume.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(volume).connect(ctx.destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.02);
};

export const playCaseOpenSound = () => {
  const ctx = getContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  tone(ctx, 95, now, 0.16, 0.055, "sawtooth", 145);
  tone(ctx, 210, now + 0.07, 0.2, 0.035, "triangle", 360);
  tone(ctx, 470, now + 0.17, 0.28, 0.028, "triangle", 720);
};

export const playDropSound = (price: number, casePrice: number, rarity: string) => {
  const ctx = getContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  const normalizedRarity = rarity.toLowerCase();
  const premiumRarity = /arcana|nameless|legendary/.test(normalizedRarity);
  const premiumPrice = casePrice > 0 && price >= casePrice * 2;

  if (premiumRarity || premiumPrice) {
    tone(ctx, 520, now, 0.24, 0.045, "sine", 760);
    tone(ctx, 780, now + 0.08, 0.32, 0.05, "sine", 1180);
    tone(ctx, 1040, now + 0.18, 0.5, 0.055, "triangle", 1560);
    tone(ctx, 1560, now + 0.34, 0.65, 0.035, "sine", 1850);
    return;
  }

  tone(ctx, 330, now, 0.16, 0.04, "triangle", 430);
  tone(ctx, 520, now + 0.06, 0.25, 0.035, "sine", 690);
};
