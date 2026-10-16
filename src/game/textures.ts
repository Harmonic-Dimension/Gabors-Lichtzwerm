/**
 * Alle sprites worden procedureel getekend — geen externe plaatjes nodig.
 * Alles is wit, zodat we met `tint` elke kleur kunnen maken.
 */
import Phaser from 'phaser';

function canvas(scene: Phaser.Scene, sleutel: string, maat: number) {
  if (scene.textures.exists(sleutel)) scene.textures.remove(sleutel);
  const tex = scene.textures.createCanvas(sleutel, maat, maat)!;
  return { tex, ctx: tex.getContext() };
}

export const TEX = {
  gloed: 'lz-gloed',
  kern: 'lz-kern',
  ster: 'lz-ster',
  nevel: 'lz-nevel',
  ring: 'lz-ring',
  vonk: 'lz-vonk',
  pijl: 'lz-pijl',
  straal: 'lz-straal',
} as const;

let gemaakt = false;

/** Maakt alle sprites aan. Veilig om vanuit elke scene aan te roepen. */
export function maakTexturen(scene: Phaser.Scene): void {
  if (gemaakt && scene.textures.exists(TEX.gloed)) return;
  gemaakt = true;
  // --- diffuse gloed (de ziel van het spel) -------------------------------
  {
    const { tex, ctx } = canvas(scene, TEX.gloed, 160);
    const g = ctx.createRadialGradient(80, 80, 0, 80, 80, 80);
    g.addColorStop(0.0, 'rgba(255,255,255,1)');
    g.addColorStop(0.08, 'rgba(255,255,255,0.82)');
    g.addColorStop(0.22, 'rgba(255,255,255,0.38)');
    g.addColorStop(0.45, 'rgba(255,255,255,0.13)');
    g.addColorStop(0.72, 'rgba(255,255,255,0.035)');
    g.addColorStop(1.0, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 160, 160);
    tex.refresh();
  }

  // --- heldere kern -------------------------------------------------------
  {
    const { tex, ctx } = canvas(scene, TEX.kern, 48);
    const g = ctx.createRadialGradient(24, 24, 0, 24, 24, 24);
    g.addColorStop(0.0, 'rgba(255,255,255,1)');
    g.addColorStop(0.34, 'rgba(255,255,255,0.98)');
    g.addColorStop(0.55, 'rgba(255,255,255,0.55)');
    g.addColorStop(0.8, 'rgba(255,255,255,0.12)');
    g.addColorStop(1.0, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 48, 48);
    tex.refresh();
  }

  // --- ster ---------------------------------------------------------------
  {
    const { tex, ctx } = canvas(scene, TEX.ster, 24);
    const g = ctx.createRadialGradient(12, 12, 0, 12, 12, 12);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.3, 'rgba(255,255,255,0.6)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 24, 24);
    // Kleine kruisglans voor de helderste sterren.
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(12, 2);
    ctx.lineTo(12, 22);
    ctx.moveTo(2, 12);
    ctx.lineTo(22, 12);
    ctx.stroke();
    tex.refresh();
  }

  // --- nevelwolk ----------------------------------------------------------
  {
    const maat = 320;
    const { tex, ctx } = canvas(scene, TEX.nevel, maat);
    // Een paar overlappende zachte blobs geeft een organischer wolk.
    const blobs: Array<[number, number, number, number]> = [
      [160, 160, 155, 0.5],
      [120, 135, 105, 0.34],
      [200, 180, 115, 0.3],
      [150, 205, 85, 0.26],
      [195, 118, 72, 0.22],
    ];
    for (const [x, y, r, a] of blobs) {
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(255,255,255,${a})`);
      g.addColorStop(0.45, `rgba(255,255,255,${a * 0.35})`);
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, maat, maat);
    }
    tex.refresh();
  }

  // --- ring (waarschuwing / aanmoediging rond vijanden) -------------------
  {
    const maat = 192;
    const { tex, ctx } = canvas(scene, TEX.ring, maat);
    const c = maat / 2;
    const buiten = ctx.createRadialGradient(c, c, c * 0.62, c, c, c);
    buiten.addColorStop(0, 'rgba(255,255,255,0)');
    buiten.addColorStop(0.55, 'rgba(255,255,255,0.5)');
    buiten.addColorStop(0.78, 'rgba(255,255,255,0.14)');
    buiten.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = buiten;
    ctx.fillRect(0, 0, maat, maat);
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(c, c, c * 0.8, 0, Math.PI * 2);
    ctx.stroke();
    tex.refresh();
  }

  // --- vonk (deeltjes) ----------------------------------------------------
  {
    const { tex, ctx } = canvas(scene, TEX.vonk, 32);
    const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.25, 'rgba(255,255,255,0.8)');
    g.addColorStop(0.6, 'rgba(255,255,255,0.22)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 32, 32);
    tex.refresh();
  }

  // --- pijl naar de Lichtkoning -------------------------------------------
  {
    const { tex, ctx } = canvas(scene, TEX.pijl, 64);
    ctx.fillStyle = 'rgba(255,255,255,1)';
    ctx.beginPath();
    ctx.moveTo(58, 32);
    ctx.lineTo(18, 10);
    ctx.lineTo(28, 32);
    ctx.lineTo(18, 54);
    ctx.closePath();
    ctx.fill();
    tex.refresh();
  }

  // --- zachte straal (voor lichtsporen en de nevel van de koning) ---------
  {
    const { tex, ctx } = canvas(scene, TEX.straal, 64);
    const g = ctx.createLinearGradient(0, 32, 64, 32);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.5, 'rgba(255,255,255,0.85)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 22, 64, 20);
    tex.refresh();
  }
}

/** Kleurenpalet van het spel. */
export const KLEUR = {
  blauwKern: 0xffffff,
  blauwGloed: 0x3fc9ff,
  blauwDiep: 0x1a6bff,
  leiderGloed: 0x8ff2ff,
  roodKern: 0xffd9c0,
  roodGloed: 0xff3a46,
  roodDiep: 0xb00f32,
  goud: 0xffd36b,
  nevelBlauw: 0x2a4bb8,
  nevelPaars: 0x5c2a9c,
  nevelRood: 0x8c1230,
} as const;
