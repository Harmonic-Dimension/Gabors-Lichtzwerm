/**
 * Tekent lichtbolletjes: een zeer heldere kern met daaromheen een diffuse
 * gloed. Door additive blending smelten de gloeden van nabije bolletjes
 * samen tot één lichtwolk.
 *
 * Alles loopt via een pool van sprites, zodat er per frame niets
 * aangemaakt of weggegooid wordt.
 */
import Phaser from 'phaser';
import { TEX } from '../textures';

const GLOED_TEX_MAAT = 160;
const KERN_TEX_MAAT = 48;

export interface BolStijl {
  gloedKleur: number;
  kernKleur: number;
  gloedMaat: number;
  kernMaat: number;
  gloedAlpha: number;
}

export class BolPool {
  private gloeden: Phaser.GameObjects.Image[] = [];
  private kernen: Phaser.GameObjects.Image[] = [];
  private index = 0;

  constructor(
    private scene: Phaser.Scene,
    private gloedDiepte: number,
    private kernDiepte: number,
    /** Wordt aangeroepen voor elke nieuwe sprite (bv. om een camera te laten negeren). */
    private opNieuw?: (o: Phaser.GameObjects.Image) => void,
  ) {}

  begin(): void {
    this.index = 0;
  }

  teken(
    x: number,
    y: number,
    stijl: BolStijl,
    maat: number,
    glans: number,
  ): void {
    let g = this.gloeden[this.index];
    let k = this.kernen[this.index];
    if (!g) {
      g = this.scene.add
        .image(0, 0, TEX.gloed)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setDepth(this.gloedDiepte);
      k = this.scene.add
        .image(0, 0, TEX.kern)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setDepth(this.kernDiepte);
      this.gloeden[this.index] = g;
      this.kernen[this.index] = k;
      this.opNieuw?.(g);
      this.opNieuw?.(k);
    }
    g.setVisible(true).setPosition(x, y);
    g.setScale((stijl.gloedMaat * maat) / GLOED_TEX_MAAT);
    g.setTint(stijl.gloedKleur);
    g.setAlpha(stijl.gloedAlpha * glans);

    k.setVisible(true).setPosition(x, y);
    k.setScale((stijl.kernMaat * maat) / KERN_TEX_MAAT);
    k.setTint(stijl.kernKleur);
    k.setAlpha(Math.min(1, 0.72 + glans * 0.3));
    this.index++;
  }

  eind(): void {
    for (let i = this.index; i < this.gloeden.length; i++) {
      if (!this.gloeden[i].visible) break;
      this.gloeden[i].setVisible(false);
      this.kernen[i].setVisible(false);
    }
  }

  vernietig(): void {
    for (const g of this.gloeden) g.destroy();
    for (const k of this.kernen) k.destroy();
    this.gloeden = [];
    this.kernen = [];
  }
}

/** Mengt twee kleuren (0 = a, 1 = b). */
export function mengKleur(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 0xff;
  const ag = (a >> 8) & 0xff;
  const ab = a & 0xff;
  const br = (b >> 16) & 0xff;
  const bg = (b >> 8) & 0xff;
  const bb = b & 0xff;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return (r << 16) | (g << 8) | bl;
}
