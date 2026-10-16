/**
 * De Lichtkoning — rechtstreeks naar Gábors tekening:
 * één grote, boze rode bol met twee ogen, schuine wenkbrauwen,
 * een norse mond en een kroon met drie punten.
 */
import Phaser from 'phaser';
import { KLEUR, TEX } from '../textures';
import { BAAS } from '../../core/config';
import type { Baas } from '../../core/types';

export class Lichtkoning {
  readonly container: Phaser.GameObjects.Container;
  private lijf: Phaser.GameObjects.Graphics;
  private gezicht: Phaser.GameObjects.Graphics;
  private kroon: Phaser.GameObjects.Container;
  private gloed: Phaser.GameObjects.Image;
  private aura: Phaser.GameObjects.Image;
  private puls: Phaser.GameObjects.Image;
  private ogen: Phaser.GameObjects.Image[] = [];
  private krachtTekst: Phaser.GameObjects.Text;
  private tijd = 0;
  private verbaasd = 0;
  /** Waar hij naar kijkt, als verschuiving van de pupillen. */
  private kijkX = 0;
  private kijkY = 0;

  constructor(scene: Phaser.Scene, baas: Baas, diepte: number) {
    const R = BAAS.straal;

    this.aura = scene.add
      .image(0, 0, TEX.nevel)
      .setBlendMode(Phaser.BlendModes.SCREEN)
      .setTint(KLEUR.nevelRood)
      .setAlpha(0.85)
      .setDisplaySize(R * 12, R * 12);

    this.gloed = scene.add
      .image(0, 0, TEX.gloed)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setTint(KLEUR.roodGloed)
      .setAlpha(0.9)
      .setDisplaySize(R * 6.2, R * 6.2);

    this.puls = scene.add
      .image(0, 0, TEX.ring)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setTint(0xff6a5a)
      .setAlpha(0)
      .setDisplaySize(R * 3, R * 3);

    this.lijf = scene.add.graphics();
    this.tekenLijf(R);

    this.gezicht = scene.add.graphics();
    this.tekenGezicht(R, false);

    // Twee oogglimmers die kunnen oplichten vóór een stormaanval.
    for (const zijde of [-1, 1]) {
      const oog = scene.add
        .image(zijde * R * 0.34, -R * 0.2, TEX.gloed)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setTint(0xffe9a0)
        .setAlpha(0)
        .setDisplaySize(R * 1.3, R * 1.3);
      this.ogen.push(oog);
    }

    this.kroon = scene.add.container(0, -R * 1.02);
    this.tekenKroon(R);

    this.krachtTekst = scene.add
      .text(0, R * 1.42, String(baas.kracht), {
        fontFamily: 'Trebuchet MS, Segoe UI, sans-serif',
        fontSize: '46px',
        color: '#ffd9d0',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setStroke('#5a0012', 8)
      .setShadow(0, 0, '#ff2b3c', 18, false, true);

    this.container = scene.add
      .container(baas.x, baas.y, [
        this.aura,
        this.gloed,
        this.puls,
        this.lijf,
        this.gezicht,
        ...this.ogen,
        this.kroon,
        this.krachtTekst,
      ])
      .setDepth(diepte);
  }

  private tekenLijf(R: number): void {
    const g = this.lijf;
    g.clear();
    // Een lichtjes hobbelige bol, net als op de tekening.
    const punten: Phaser.Math.Vector2[] = [];
    const n = 44;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const r =
        R *
        (1 +
          Math.sin(a * 3 + 0.7) * 0.055 +
          Math.sin(a * 5 - 1.2) * 0.035 +
          Math.cos(a * 2 + 2.1) * 0.03);
      punten.push(new Phaser.Math.Vector2(Math.cos(a) * r, Math.sin(a) * r * 1.03));
    }
    // Buitenste zachte rand
    g.fillStyle(KLEUR.roodDiep, 0.55);
    g.beginPath();
    g.moveTo(punten[0].x * 1.1, punten[0].y * 1.1);
    for (const p of punten) g.lineTo(p.x * 1.1, p.y * 1.1);
    g.closePath();
    g.fillPath();
    // Hoofdkleur
    g.fillStyle(0xd3172f, 1);
    g.beginPath();
    g.moveTo(punten[0].x, punten[0].y);
    for (const p of punten) g.lineTo(p.x, p.y);
    g.closePath();
    g.fillPath();
    // Lichtere binnenkant links-boven (alsof er licht op valt)
    g.fillStyle(0xff5d55, 0.5);
    g.fillEllipse(-R * 0.22, -R * 0.26, R * 1.05, R * 0.85);
    g.fillStyle(0xffa07a, 0.28);
    g.fillEllipse(-R * 0.3, -R * 0.36, R * 0.6, R * 0.44);
    // Donkere onderrand
    g.fillStyle(0x72001c, 0.35);
    g.fillEllipse(R * 0.12, R * 0.45, R * 1.3, R * 0.7);
    // Rand
    g.lineStyle(5, 0x3d0010, 0.85);
    g.beginPath();
    g.moveTo(punten[0].x, punten[0].y);
    for (const p of punten) g.lineTo(p.x, p.y);
    g.closePath();
    g.strokePath();
  }

  private tekenGezicht(R: number, verbaasd: boolean): void {
    const g = this.gezicht;
    g.clear();
    const oogX = R * 0.34;
    const oogY = -R * 0.2;

    if (verbaasd) {
      // Grote verbaasde ogen en een open mond.
      for (const z of [-1, 1]) {
        g.fillStyle(0xfff4ec, 1);
        g.fillCircle(z * oogX, oogY, R * 0.19);
        g.fillStyle(0x1a0008, 1);
        g.fillCircle(z * oogX + this.kijkX * 0.5, oogY + this.kijkY * 0.5, R * 0.095);
      }
      g.lineStyle(7, 0x3d0010, 1);
      g.strokeCircle(0, R * 0.42, R * 0.2);
      g.fillStyle(0x3d0010, 0.9);
      g.fillCircle(0, R * 0.42, R * 0.2);
      return;
    }

    // Boze ogen: twee donkere pupillen met een glimlichtje.
    for (const z of [-1, 1]) {
      g.fillStyle(0xfff0e4, 0.95);
      g.fillEllipse(z * oogX, oogY, R * 0.3, R * 0.26);
      g.fillStyle(0x230007, 1);
      g.fillCircle(z * oogX + this.kijkX, oogY + this.kijkY, R * 0.115);
      g.fillStyle(0xffffff, 0.8);
      g.fillCircle(z * oogX + this.kijkX - R * 0.04, oogY + this.kijkY - R * 0.045, R * 0.034);
    }

    // Schuin naar beneden gerichte wenkbrauwen → boos.
    g.lineStyle(R * 0.11, 0x2b0009, 1);
    g.beginPath();
    g.moveTo(-oogX - R * 0.22, oogY - R * 0.42);
    g.lineTo(-oogX + R * 0.2, oogY - R * 0.17);
    g.strokePath();
    g.beginPath();
    g.moveTo(oogX + R * 0.22, oogY - R * 0.42);
    g.lineTo(oogX - R * 0.2, oogY - R * 0.17);
    g.strokePath();

    // Nors gebogen mond (naar beneden).
    g.lineStyle(R * 0.095, 0x2b0009, 1);
    g.beginPath();
    const mx = 0;
    const my = R * 0.56;
    const breedte = R * 0.52;
    for (let i = 0; i <= 18; i++) {
      const t = i / 18;
      const x = mx + (t - 0.5) * 2 * breedte;
      const y = my - Math.sin(t * Math.PI) * R * 0.22;
      if (i === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.strokePath();
  }

  private tekenKroon(R: number): void {
    const g = this.kroon.scene.add.graphics();
    const b = R * 0.92;
    const h = R * 0.62;
    g.fillStyle(KLEUR.goud, 1);
    g.lineStyle(4, 0x8a5b00, 0.9);
    g.beginPath();
    g.moveTo(-b, h * 0.45);
    g.lineTo(-b * 0.62, -h * 0.55);
    g.lineTo(-b * 0.31, h * 0.1);
    g.lineTo(0, -h * 0.95);
    g.lineTo(b * 0.31, h * 0.1);
    g.lineTo(b * 0.62, -h * 0.55);
    g.lineTo(b, h * 0.45);
    g.closePath();
    g.fillPath();
    g.strokePath();
    // De bolletjes op de punten, precies zoals in de tekening.
    const toppen: Array<[number, number]> = [
      [-b * 0.62, -h * 0.55],
      [0, -h * 0.95],
      [b * 0.62, -h * 0.55],
    ];
    for (const [x, y] of toppen) {
      g.fillStyle(0xfff0b8, 1);
      g.fillCircle(x, y, R * 0.11);
      g.lineStyle(3, 0x8a5b00, 0.9);
      g.strokeCircle(x, y, R * 0.11);
    }
    const glans = this.kroon.scene.add
      .image(0, -h * 0.3, TEX.gloed)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setTint(0xffe9a0)
      .setAlpha(0.5)
      .setDisplaySize(R * 2.6, R * 2.0);
    this.kroon.add([glans, g]);
  }

  /** De kroon losmaken (voor het overwinningsmoment). */
  pakKroon(): Phaser.GameObjects.Container {
    this.container.remove(this.kroon);
    const wereldX = this.container.x + this.kroon.x;
    const wereldY = this.container.y + this.kroon.y;
    this.kroon.setPosition(wereldX, wereldY);
    this.kroon.setDepth(this.container.depth + 2);
    this.container.scene.add.existing(this.kroon);
    return this.kroon;
  }

  zetVerbaasd(): void {
    this.verbaasd = 1;
    this.tekenGezicht(BAAS.straal, true);
  }

  update(baas: Baas, dt: number, spelerX: number, spelerY: number): void {
    this.tijd += dt;
    const R = BAAS.straal;
    this.container.setPosition(baas.x, baas.y);

    // Ademen.
    const adem = 1 + Math.sin(this.tijd * 1.6) * 0.035;
    const spanning = baas.stand === 'aankondigen' ? 1 + (baas.timer / BAAS.aankondiging) * 0.12 : 1;
    this.container.setScale(adem * spanning);

    // Wiebelen.
    this.container.setRotation(Math.sin(this.tijd * 0.9) * 0.045);

    // Kroon zweeft net iets anders mee.
    this.kroon.setY(-R * 1.02 + Math.sin(this.tijd * 2.1) * R * 0.05);
    this.kroon.setRotation(Math.sin(this.tijd * 1.3 + 0.8) * 0.08);

    // Pupillen kijken de speler aan.
    const dx = spelerX - baas.x;
    const dy = spelerY - baas.y;
    const d = Math.hypot(dx, dy) || 1;
    const maxKijk = R * 0.07;
    const doelX = (dx / d) * maxKijk;
    const doelY = (dy / d) * maxKijk;
    if (Math.abs(doelX - this.kijkX) > 0.3 || Math.abs(doelY - this.kijkY) > 0.3) {
      this.kijkX += (doelX - this.kijkX) * Math.min(1, dt * 6);
      this.kijkY += (doelY - this.kijkY) * Math.min(1, dt * 6);
      this.tekenGezicht(R, this.verbaasd > 0);
    }

    // Ogen lichten op bij een aangekondigde stormaanval.
    const oogGloed =
      baas.stand === 'aankondigen'
        ? 0.35 + 0.65 * (baas.timer / BAAS.aankondiging)
        : baas.stand === 'stormen'
          ? 0.9
          : 0;
    for (const oog of this.ogen) oog.setAlpha(oogGloed);

    // Waarschuwingspuls.
    if (baas.stand === 'aankondigen') {
      const t = baas.timer / BAAS.aankondiging;
      this.puls.setAlpha((1 - t) * 0.85);
      this.puls.setDisplaySize(R * (2.4 + t * 4.2), R * (2.4 + t * 4.2));
    } else {
      this.puls.setAlpha(Math.max(0, this.puls.alpha - dt * 2.5));
    }

    const hartslag = baas.stand === 'stormen' ? 1.25 : 1;
    this.gloed.setDisplaySize(R * 6.2 * hartslag, R * 6.2 * hartslag);
    this.gloed.setAlpha(0.75 + Math.sin(this.tijd * 2.3) * 0.12 + (baas.stand === 'stormen' ? 0.25 : 0));
    this.aura.setRotation(this.tijd * 0.03);
    this.krachtTekst.setAlpha(0.75 + Math.sin(this.tijd * 2) * 0.2);
  }
}
