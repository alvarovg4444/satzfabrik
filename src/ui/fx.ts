/** Small synthesized sounds (no audio files), speech output and a confetti burst. */

let ctx: AudioContext | null = null;
let enabled = true;

export function setSound(on: boolean) {
  enabled = on;
}

function audio(): AudioContext | null {
  if (!enabled) return null;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(freq: number, start: number, dur: number, type: OscillatorType = "sine", gain = 0.12) {
  const a = audio();
  if (!a) return;
  const t0 = a.currentTime + start;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(gain, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(a.destination);
  o.start(t0);
  o.stop(t0 + dur + 0.02);
}

export const sfx = {
  good() {
    tone(660, 0, 0.12, "triangle");
    tone(990, 0.08, 0.18, "triangle");
  },
  perfect() {
    tone(660, 0, 0.1, "triangle");
    tone(880, 0.07, 0.1, "triangle");
    tone(1320, 0.14, 0.25, "triangle");
  },
  bad() {
    tone(220, 0, 0.18, "sawtooth", 0.05);
    tone(165, 0.1, 0.22, "sawtooth", 0.05);
  },
  coin() {
    tone(1200, 0, 0.06, "square", 0.04);
    tone(1600, 0.05, 0.12, "square", 0.04);
  },
  tap() {
    tone(500, 0, 0.04, "triangle", 0.05);
  },
  levelUp() {
    [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.09, 0.22, "triangle", 0.1));
  },
};

// --- speech ---------------------------------------------------------------

let voice: SpeechSynthesisVoice | null = null;

function germanVoice(): SpeechSynthesisVoice | null {
  if (voice) return voice;
  try {
    const voices = speechSynthesis.getVoices();
    voice =
      voices.find((v) => v.lang === "de-DE" && /google|natural|premium|enhanced/i.test(v.name)) ??
      voices.find((v) => v.lang === "de-DE") ??
      voices.find((v) => v.lang.startsWith("de")) ??
      null;
    return voice;
  } catch {
    return null;
  }
}

export function canSpeak(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

export function speak(text: string, rate = 0.95) {
  if (!canSpeak() || !text) return;
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "de-DE";
    const v = germanVoice();
    if (v) u.voice = v;
    u.rate = rate;
    speechSynthesis.speak(u);
  } catch {
    /* no speech on this device */
  }
}

// --- dictation -------------------------------------------------------------

type Recognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
};

function recognitionCtor(): (new () => Recognition) | null {
  const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function canDictate(): boolean {
  return typeof window !== "undefined" && !!recognitionCtor();
}

/** Start German dictation. Calls onText with the running transcript; returns a stop function. */
export function dictate(onText: (text: string, final: boolean) => void, onEnd: (error?: string) => void): () => void {
  const Ctor = recognitionCtor();
  if (!Ctor) {
    onEnd("unsupported");
    return () => undefined;
  }
  const rec = new Ctor();
  rec.lang = "de-DE";
  rec.interimResults = true;
  rec.continuous = false;
  rec.onresult = (e) => {
    let text = "";
    let final = false;
    for (let i = 0; i < e.results.length; i++) {
      text += e.results[i][0].transcript;
      final = e.results[i].isFinal;
    }
    onText(text, final);
  };
  rec.onerror = (e) => onEnd(e.error);
  rec.onend = () => onEnd();
  try {
    rec.start();
  } catch {
    onEnd("failed");
  }
  return () => {
    try {
      rec.stop();
    } catch {
      /* already stopped */
    }
  };
}

// --- confetti --------------------------------------------------------------

export function confetti(colors: string[]) {
  if (typeof window === "undefined") return;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
  const canvas = document.createElement("canvas");
  canvas.className = "fx-confetti";
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  document.body.appendChild(canvas);
  const c = canvas.getContext("2d");
  if (!c) return canvas.remove();
  c.scale(dpr, dpr);
  const W = window.innerWidth;
  const parts = Array.from({ length: 90 }, () => ({
    x: W / 2 + (Math.random() - 0.5) * 120,
    y: window.innerHeight * 0.35,
    vx: (Math.random() - 0.5) * 9,
    vy: -Math.random() * 9 - 4,
    s: 4 + Math.random() * 6,
    r: Math.random() * Math.PI,
    vr: (Math.random() - 0.5) * 0.3,
    col: colors[Math.floor(Math.random() * colors.length)],
  }));
  const t0 = performance.now();
  const frame = (t: number) => {
    const age = t - t0;
    c.clearRect(0, 0, W, window.innerHeight);
    for (const p of parts) {
      p.vy += 0.28;
      p.x += p.vx;
      p.y += p.vy;
      p.r += p.vr;
      c.save();
      c.translate(p.x, p.y);
      c.rotate(p.r);
      c.globalAlpha = Math.max(0, 1 - age / 1800);
      c.fillStyle = p.col;
      c.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2);
      c.restore();
    }
    if (age < 1800) requestAnimationFrame(frame);
    else canvas.remove();
  };
  requestAnimationFrame(frame);
}
