/**
 * Geluid via de Web Audio API — geen externe bestanden.
 * Start pas na de eerste klik/toetsaanslag (browserregel) en is altijd te dempen.
 */

const OPSLAG_SLEUTEL = 'lichtzwerm-geluid';

class Geluid {
  private ctx: AudioContext | null = null;
  private meester: GainNode | null = null;
  private _uit = false;
  /** Zodat 20 bolletjes tegelijk niet 20 keer hetzelfde piepje geven. */
  private laatste: Record<string, number> = {};

  constructor() {
    try {
      this._uit = localStorage.getItem(OPSLAG_SLEUTEL) === 'uit';
    } catch {
      this._uit = false;
    }
  }

  get uit(): boolean {
    return this._uit;
  }

  /** Mag pas aangeroepen worden ná gebruikersinteractie. */
  ontwaak(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    try {
      const Ctx: typeof AudioContext =
        window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return;
      this.ctx = new Ctx();
      this.meester = this.ctx.createGain();
      this.meester.gain.value = this._uit ? 0 : 0.5;
      this.meester.connect(this.ctx.destination);
    } catch {
      this.ctx = null;
    }
  }

  zetUit(uit: boolean): void {
    this._uit = uit;
    try {
      localStorage.setItem(OPSLAG_SLEUTEL, uit ? 'uit' : 'aan');
    } catch {
      /* privémodus: dan onthouden we het gewoon niet */
    }
    if (this.meester && this.ctx) {
      this.meester.gain.cancelScheduledValues(this.ctx.currentTime);
      this.meester.gain.setTargetAtTime(uit ? 0 : 0.5, this.ctx.currentTime, 0.05);
    }
  }

  wissel(): boolean {
    this.zetUit(!this._uit);
    return this._uit;
  }

  // --------------------------------------------------------------- bouwsteen

  private toon(
    freq: number,
    start: number,
    duur: number,
    volume: number,
    vorm: OscillatorType = 'sine',
    glijNaar?: number,
  ): void {
    const ctx = this.ctx;
    const meester = this.meester;
    if (!ctx || !meester) return;
    const t = ctx.currentTime + start;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = vorm;
    osc.frequency.setValueAtTime(freq, t);
    if (glijNaar !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(20, glijNaar), t + duur);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume), t + Math.min(0.03, duur * 0.3));
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duur);
    osc.connect(gain);
    gain.connect(meester);
    osc.start(t);
    osc.stop(t + duur + 0.04);
  }

  private ruis(start: number, duur: number, volume: number, filterFreq = 900): void {
    const ctx = this.ctx;
    const meester = this.meester;
    if (!ctx || !meester) return;
    const t = ctx.currentTime + start;
    const lengte = Math.max(1, Math.floor(ctx.sampleRate * duur));
    const buffer = ctx.createBuffer(1, lengte, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < lengte; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / lengte);
    const bron = ctx.createBufferSource();
    bron.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(filterFreq * 2, t);
    filter.frequency.exponentialRampToValueAtTime(filterFreq * 0.5, t + duur);
    filter.Q.value = 0.8;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duur);
    bron.connect(filter);
    filter.connect(gain);
    gain.connect(meester);
    bron.start(t);
  }

  private knijp(naam: string, ms: number): boolean {
    const nu = performance.now();
    if (this.laatste[naam] && nu - this.laatste[naam] < ms) return false;
    this.laatste[naam] = nu;
    return true;
  }

  // ------------------------------------------------------------ spelgeluiden

  /** Zacht, hoog belletje — stijgt mee met de grootte van je zwerm. */
  verzamel(aantal: number): void {
    if (!this.knijp('verzamel', 55)) return;
    const trap = [0, 2, 4, 7, 9, 12][aantal % 6];
    const freq = 740 * Math.pow(2, trap / 12);
    this.toon(freq, 0, 0.26, 0.17, 'sine');
    this.toon(freq * 2, 0.01, 0.16, 0.07, 'triangle');
  }

  /** Vrolijk oplopend akkoord bij een overwinning op een rode groep. */
  overwinning(kracht: number): void {
    const basis = 330;
    const akkoord = [0, 4, 7, 12, 16];
    const n = Math.min(akkoord.length, 3 + Math.floor(kracht / 5));
    for (let i = 0; i < n; i++) {
      this.toon(basis * Math.pow(2, akkoord[i] / 12), i * 0.055, 0.42, 0.14, 'triangle');
    }
    this.ruis(0, 0.22, 0.07, 1600);
  }

  gelijkspel(): void {
    if (!this.knijp('gelijk', 300)) return;
    this.toon(300, 0, 0.14, 0.12, 'sine', 240);
    this.toon(452, 0.05, 0.14, 0.08, 'sine', 380);
  }

  boost(): void {
    this.ruis(0, 0.34, 0.1, 1100);
    this.toon(220, 0, 0.3, 0.07, 'sawtooth', 760);
  }

  baasVerschijnt(): void {
    this.toon(96, 0, 1.5, 0.17, 'sine', 72);
    this.toon(144, 0.06, 1.3, 0.09, 'triangle', 110);
    this.toon(192, 0.12, 1.0, 0.05, 'sine', 150);
  }

  baasDreigt(): void {
    if (!this.knijp('dreigt', 500)) return;
    this.toon(150, 0, 0.5, 0.11, 'sawtooth', 230);
  }

  verloren(): void {
    this.toon(392, 0, 0.5, 0.15, 'triangle', 196);
    this.toon(262, 0.14, 0.7, 0.13, 'sine', 131);
    this.toon(196, 0.3, 0.9, 0.1, 'sine', 98);
  }

  /** Korte feestelijke melodie. */
  gewonnen(): void {
    const noten = [523, 659, 784, 1047, 1319, 1047, 1319, 1568];
    noten.forEach((f, i) => {
      this.toon(f, i * 0.13, 0.4, 0.15, 'triangle');
      this.toon(f / 2, i * 0.13, 0.42, 0.06, 'sine');
    });
    this.ruis(0.1, 0.5, 0.05, 2400);
    this.toon(1046, 1.05, 1.1, 0.12, 'sine');
    this.toon(1568, 1.08, 1.1, 0.09, 'triangle');
  }

  sterkGenoeg(): void {
    [659, 880, 1175].forEach((f, i) => this.toon(f, i * 0.09, 0.4, 0.12, 'triangle'));
  }

  klik(): void {
    this.toon(620, 0, 0.09, 0.12, 'triangle', 880);
  }
}

export const geluid = new Geluid();
