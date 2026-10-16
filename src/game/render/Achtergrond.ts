/**
 * De ruimte: sterrenvelden met parallax, zachte nevels, stofdeeltjes,
 * verre lichtpunten en een gloeiende wereldgrens.
 */
import Phaser from 'phaser';
import { KLEUR, TEX } from '../textures';
import type { Nevel } from '../../core/types';
import { makeRng } from '../../core/mathx';

interface Laag {
  tile: Phaser.GameObjects.TileSprite;
  factor: number;
}

function maakSterrenTegel(
  scene: Phaser.Scene,
  sleutel: string,
  maat: number,
  aantal: number,
  maxStraal: number,
  seed: number,
): void {
  if (scene.textures.exists(sleutel)) return;
  const tex = scene.textures.createCanvas(sleutel, maat, maat)!;
  const ctx = tex.getContext();
  const rng = makeRng(seed);
  const tinten = ['255,255,255', '200,226,255', '255,236,208', '186,200,255', '255,214,236'];
  for (let i = 0; i < aantal; i++) {
    const x = rng() * maat;
    const y = rng() * maat;
    const r = 0.45 + rng() * maxStraal;
    const a = 0.25 + rng() * 0.75;
    const tint = tinten[Math.floor(rng() * tinten.length)];
    const g = ctx.createRadialGradient(x, y, 0, x, y, r * 3.4);
    g.addColorStop(0, `rgba(${tint},${a})`);
    g.addColorStop(0.3, `rgba(${tint},${a * 0.4})`);
    g.addColorStop(1, `rgba(${tint},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(x - r * 3.4, y - r * 3.4, r * 6.8, r * 6.8);
  }
  tex.refresh();
}

export class Achtergrond {
  private lagen: Laag[] = [];
  private nevelSprites: Phaser.GameObjects.Image[] = [];
  private verreLichten: Phaser.GameObjects.Image[] = [];
  private grens?: Phaser.GameObjects.Graphics;
  private tijd = 0;

  constructor(
    private scene: Phaser.Scene,
    nevels: Nevel[],
    wereldBreedte = 0,
    wereldHoogte = 0,
  ) {
    maakSterrenTegel(scene, 'lz-sterren-ver', 512, 260, 0.9, 7);
    maakSterrenTegel(scene, 'lz-sterren-mid', 512, 120, 1.5, 19);
    maakSterrenTegel(scene, 'lz-sterren-dicht', 512, 46, 2.3, 53);
    maakSterrenTegel(scene, 'lz-stof', 512, 150, 1.1, 91);

    const cam = scene.cameras.main;
    const maakLaag = (sleutel: string, factor: number, alpha: number, tint: number) => {
      const tile = scene.add
        .tileSprite(0, 0, cam.width, cam.height, sleutel)
        .setOrigin(0, 0)
        .setScrollFactor(0)
        .setAlpha(alpha)
        .setTint(tint)
        .setDepth(-100);
      this.lagen.push({ tile, factor });
    };
    maakLaag('lz-sterren-ver', 0.05, 0.75, 0xffffff);
    maakLaag('lz-sterren-mid', 0.16, 0.85, 0xdfe9ff);
    maakLaag('lz-stof', 0.45, 0.3, 0x9fc4ff);
    maakLaag('lz-sterren-dicht', 0.32, 1, 0xffffff);

    // Verre, grote lichtpunten.
    const rng = makeRng(31337);
    for (let i = 0; i < 7; i++) {
      const licht = scene.add
        .image(rng() * cam.width * 3 - cam.width, rng() * cam.height * 2 - cam.height * 0.5, TEX.gloed)
        .setScrollFactor(0.12)
        .setDepth(-98)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setAlpha(0.1 + rng() * 0.14)
        .setTint([0x7fd4ff, 0xffd9a0, 0xc6a8ff, 0xffffff][Math.floor(rng() * 4)])
        .setDisplaySize(70 + rng() * 160, 70 + rng() * 160);
      this.verreLichten.push(licht);
    }

    // Nevels in wereldcoördinaten, met lichte parallax.
    for (const n of nevels) {
      const s = scene.add
        .image(n.x, n.y, TEX.nevel)
        .setScrollFactor(0.82)
        .setDepth(-95)
        .setBlendMode(Phaser.BlendModes.SCREEN)
        .setTint(n.tint)
        .setAlpha(n.alpha)
        .setDisplaySize(n.r * 2.6, n.r * 2.6)
        .setAngle(((n.x + n.y) % 360) - 180);
      this.nevelSprites.push(s);
    }

    if (wereldBreedte > 0) {
      this.grens = scene.add.graphics().setDepth(-90);
      for (let i = 0; i < 5; i++) {
        this.grens.lineStyle(26 - i * 5, KLEUR.nevelBlauw, 0.055 + i * 0.035);
        this.grens.strokeRoundedRect(10, 10, wereldBreedte - 20, wereldHoogte - 20, 220);
      }
      this.grens.lineStyle(2, 0x7fd4ff, 0.35);
      this.grens.strokeRoundedRect(10, 10, wereldBreedte - 20, wereldHoogte - 20, 220);
    }
  }

  /** Alle objecten van deze laag (handig om een camera ze te laten negeren). */
  objecten(): Phaser.GameObjects.GameObject[] {
    const lijst: Phaser.GameObjects.GameObject[] = [
      ...this.lagen.map((l) => l.tile),
      ...this.nevelSprites,
      ...this.verreLichten,
    ];
    if (this.grens) lijst.push(this.grens);
    return lijst;
  }

  herschaal(breedte: number, hoogte: number): void {
    for (const l of this.lagen) l.tile.setSize(breedte, hoogte);
  }

  update(dt: number): void {
    this.tijd += dt;
    const cam = this.scene.cameras.main;
    for (const l of this.lagen) {
      l.tile.tilePositionX = cam.scrollX * l.factor;
      l.tile.tilePositionY = cam.scrollY * l.factor;
    }
    // Stof drijft langzaam mee.
    const stof = this.lagen[2];
    stof.tile.tilePositionX += Math.sin(this.tijd * 0.1) * 6;
    stof.tile.tilePositionY += this.tijd * 1.6;

    for (let i = 0; i < this.nevelSprites.length; i++) {
      const s = this.nevelSprites[i];
      s.rotation += dt * 0.004 * (i % 2 === 0 ? 1 : -1);
      s.setScale(s.scaleX * (1 + Math.sin(this.tijd * 0.25 + i) * 0.00035));
    }
    for (let i = 0; i < this.verreLichten.length; i++) {
      const l = this.verreLichten[i];
      l.setAlpha(0.1 + 0.07 * (1 + Math.sin(this.tijd * 0.5 + i * 1.7)));
    }
  }
}
