/**
 * Besturing met je vingers, voor telefoons en tablets.
 *
 * Links: een zwevende joystick. Je zet je duim ergens in de linkerhelft neer en
 * sleept; daar verschijnt de stick. Rechts: een grote knop (boost, en in de
 * arena schieten) met daarnaast een kleine boostknop tijdens het gevecht.
 *
 * Alles hangt aan de UI-camera, dus het schuift niet mee met de wereld.
 */
import Phaser from 'phaser';
import { TEX } from '../textures';

const LETTER = 'Trebuchet MS, Segoe UI, sans-serif';

interface Knop {
  container: Phaser.GameObjects.Container;
  grafiek: Phaser.GameObjects.Graphics;
  tekst: Phaser.GameObjects.Text;
  label: Phaser.GameObjects.Text;
  gloed: Phaser.GameObjects.Image;
  straal: number;
  kleur: number;
  ingedrukt: boolean;
  pointerId: number | null;
}

export interface Aanraakinvoer {
  x: number;
  y: number;
  boost: boolean;
  schiet: boolean;
}

export class Aanraakbesturing {
  private laag: Phaser.GameObjects.Container;
  private stickBasis: Phaser.GameObjects.Graphics;
  private stickKnop: Phaser.GameObjects.Graphics;
  private stickGloed: Phaser.GameObjects.Image;
  private hoofdknop: Knop;
  private boostknop: Knop;
  private stickPointer: number | null = null;
  private stickX = 0;
  private stickY = 0;
  private richtingX = 0;
  private richtingY = 0;
  private arena = false;
  private actief = true;
  /** Zolang je nog nooit gestuurd hebt, laten we zien waar de stick hoort. */
  private heeftGestuurd = false;
  private rustX = 0;
  private rustY = 0;
  private tijd = 0;
  /** Eén korte tik op de boostknop mag niet tussen twee frames verdwijnen. */
  private boostLatch = false;

  /** Straal waarbinnen de stick volledig uitslaat. */
  private readonly stickStraal: number;

  constructor(private scene: Phaser.Scene, diepte = 1200) {
    const klein = Math.min(scene.scale.width, scene.scale.height);
    this.stickStraal = Phaser.Math.Clamp(klein * 0.16, 52, 86);

    // Meer dan één vinger tegelijk: bewegen én schieten.
    scene.input.addPointer(3);

    this.stickGloed = scene.add
      .image(0, 0, TEX.gloed)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setTint(0x4fd8ff)
      .setAlpha(0)
      .setDisplaySize(this.stickStraal * 4, this.stickStraal * 4);
    this.stickBasis = scene.add.graphics();
    this.stickKnop = scene.add.graphics();

    this.hoofdknop = this.maakKnop('»', 'BOOST', Phaser.Math.Clamp(klein * 0.105, 38, 60), 0x7fe4ff);
    this.boostknop = this.maakKnop('»', 'BOOST', Phaser.Math.Clamp(klein * 0.075, 28, 44), 0xffd36b);

    this.laag = scene.add
      .container(0, 0, [
        this.stickGloed,
        this.stickBasis,
        this.stickKnop,
        this.hoofdknop.container,
        this.boostknop.container,
      ])
      .setScrollFactor(0)
      .setDepth(diepte);

    this.tekenStick(0, 0, 0);
    this.herschaal();
    this.luister();
  }

  /** De objecten die de wereldcamera moet negeren. */
  objecten(): Phaser.GameObjects.GameObject[] {
    return [this.laag];
  }

  private maakKnop(teken: string, naam: string, straal: number, kleur: number): Knop {
    const grafiek = this.scene.add.graphics();
    const gloed = this.scene.add
      .image(0, 0, TEX.gloed)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setTint(kleur)
      .setAlpha(0.3)
      .setDisplaySize(straal * 4.2, straal * 4.2);
    const tekst = this.scene.add
      .text(0, 0, teken, {
        fontFamily: LETTER,
        fontSize: `${Math.round(straal * 0.92)}px`,
        color: '#06203f',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
    const label = this.scene.add
      .text(0, straal * 1.32, naam, {
        fontFamily: LETTER,
        fontSize: `${Math.round(Math.max(11, straal * 0.3))}px`,
        color: '#a9d9ff',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
    label.setLetterSpacing?.(2);
    const container = this.scene.add.container(0, 0, [gloed, grafiek, tekst, label]);
    const knop: Knop = {
      container,
      grafiek,
      tekst,
      label,
      gloed,
      straal,
      kleur,
      ingedrukt: false,
      pointerId: null,
    };
    this.tekenKnop(knop);
    return knop;
  }

  private tekenKnop(knop: Knop): void {
    const kleur = knop.kleur;
    const g = knop.grafiek;
    const r = knop.straal * (knop.ingedrukt ? 0.92 : 1);
    g.clear();
    g.fillStyle(0x071130, 0.5);
    g.fillCircle(0, 0, r * 1.06);
    g.fillStyle(kleur, knop.ingedrukt ? 1 : 0.86);
    g.fillCircle(0, 0, r);
    g.lineStyle(3, 0xffffff, knop.ingedrukt ? 0.95 : 0.55);
    g.strokeCircle(0, 0, r);
    knop.gloed.setAlpha(knop.ingedrukt ? 0.6 : 0.26);
    knop.tekst.setScale(knop.ingedrukt ? 0.92 : 1);
  }

  private tekenStick(x: number, y: number, alpha: number): void {
    const b = this.stickBasis;
    const k = this.stickKnop;
    const r = this.stickStraal;
    b.clear();
    k.clear();
    if (alpha <= 0) {
      this.stickGloed.setAlpha(0);
      return;
    }
    b.fillStyle(0x071130, 0.42 * alpha);
    b.fillCircle(this.stickX, this.stickY, r);
    b.lineStyle(3, 0x7fe4ff, 0.5 * alpha);
    b.strokeCircle(this.stickX, this.stickY, r);
    b.lineStyle(2, 0x7fe4ff, 0.22 * alpha);
    b.strokeCircle(this.stickX, this.stickY, r * 0.62);

    k.fillStyle(0x9ff4ff, 0.92 * alpha);
    k.fillCircle(this.stickX + x, this.stickY + y, r * 0.42);
    k.lineStyle(3, 0xffffff, 0.8 * alpha);
    k.strokeCircle(this.stickX + x, this.stickY + y, r * 0.42);
    this.stickGloed.setPosition(this.stickX + x, this.stickY + y).setAlpha(0.3 * alpha);
  }

  private raaktKnop(knop: Knop, px: number, py: number): boolean {
    const dx = px - knop.container.x;
    const dy = py - knop.container.y;
    return dx * dx + dy * dy <= knop.straal * 1.5 * (knop.straal * 1.5);
  }

  private luister(): void {
    const scene = this.scene;

    scene.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (!this.actief) return;
      this.heeftGestuurd = true;
      for (const knop of [this.hoofdknop, this.boostknop]) {
        if (!knop.container.visible) continue;
        if (this.raaktKnop(knop, p.x, p.y)) {
          knop.ingedrukt = true;
          knop.pointerId = p.id;
          if (knop === this.boostknop || !this.arena) this.boostLatch = true;
          this.tekenKnop(knop);
          return;
        }
      }
      // Alles in de linkerhelft is de joystick.
      if (p.x < scene.scale.width * 0.52) {
        this.stickPointer = p.id;
        this.stickX = p.x;
        this.stickY = p.y;
        this.richtingX = 0;
        this.richtingY = 0;
        this.tekenStick(0, 0, 1);
      }
    });

    scene.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!this.actief || p.id !== this.stickPointer) return;
      let dx = p.x - this.stickX;
      let dy = p.y - this.stickY;
      const d = Math.hypot(dx, dy);
      const max = this.stickStraal;
      if (d > max) {
        dx = (dx / d) * max;
        dy = (dy / d) * max;
      }
      // Klein dood zoneje, zodat stilstaan ook echt stilstaan is.
      const uitslag = Math.min(1, Math.hypot(dx, dy) / max);
      if (uitslag < 0.14) {
        this.richtingX = 0;
        this.richtingY = 0;
      } else {
        this.richtingX = dx / max;
        this.richtingY = dy / max;
      }
      this.tekenStick(dx, dy, 1);
    });

    const los = (p: Phaser.Input.Pointer) => {
      if (p.id === this.stickPointer) {
        this.stickPointer = null;
        this.richtingX = 0;
        this.richtingY = 0;
        this.tekenStick(0, 0, 0);
      }
      for (const knop of [this.hoofdknop, this.boostknop]) {
        if (knop.pointerId === p.id) {
          knop.ingedrukt = false;
          knop.pointerId = null;
          this.tekenKnop(knop);
        }
      }
    };
    scene.input.on('pointerup', los);
    scene.input.on('pointerupoutside', los);
    scene.input.on('gameout', () => {
      this.loslaten();
    });
  }

  /** Alles loslaten (bij pauzeren of afloop). */
  loslaten(): void {
    this.stickPointer = null;
    this.boostLatch = false;
    this.richtingX = 0;
    this.richtingY = 0;
    this.tekenStick(0, 0, 0);
    for (const knop of [this.hoofdknop, this.boostknop]) {
      knop.ingedrukt = false;
      knop.pointerId = null;
      this.tekenKnop(knop);
    }
  }

  zetActief(actief: boolean): void {
    this.actief = actief;
    this.laag.setVisible(actief);
    if (!actief) this.loslaten();
  }

  /** In de arena wordt de grote knop een schietknop en komt er een boostknop bij. */
  zetArena(arena: boolean): void {
    if (arena === this.arena) return;
    this.arena = arena;
    this.hoofdknop.tekst.setText(arena ? '✦' : '»');
    this.hoofdknop.label.setText(arena ? 'SCHIET' : 'BOOST');
    this.boostknop.container.setVisible(arena);
  }

  herschaal(): void {
    const b = this.scene.scale.width;
    const h = this.scene.scale.height;
    const marge = Math.max(26, Math.min(b, h) * 0.07);
    // Extra ruimte onderaan voor het tekstlabel onder de knop.
    const onder = marge + this.hoofdknop.straal * 0.5;
    this.hoofdknop.container.setPosition(
      b - marge - this.hoofdknop.straal,
      h - onder - this.hoofdknop.straal,
    );
    this.boostknop.container.setPosition(
      b - marge - this.hoofdknop.straal * 2 - this.boostknop.straal * 1.6,
      h - onder - this.boostknop.straal,
    );
    this.boostknop.container.setVisible(this.arena);

    this.rustX = marge + this.stickStraal * 1.1;
    this.rustY = h - onder - this.stickStraal;
    if (this.stickPointer === null) this.tekenStick(0, 0, 0);
  }

  /** Wordt elk frame aangeroepen; laat de stick zien zolang je hem nog niet gebruikt hebt. */
  update(dt: number): void {
    if (!this.actief || this.heeftGestuurd || this.stickPointer !== null) return;
    this.tijd += dt;
    this.stickX = this.rustX;
    this.stickY = this.rustY;
    const puls = 0.3 + Math.sin(this.tijd * 2.2) * 0.14;
    this.tekenStick(0, 0, puls);
  }

  lees(): Aanraakinvoer {
    if (!this.actief) {
      this.boostLatch = false;
      return { x: 0, y: 0, boost: false, schiet: false };
    }
    const vast = this.arena ? this.boostknop.ingedrukt : this.hoofdknop.ingedrukt;
    const boost = vast || this.boostLatch;
    this.boostLatch = false;
    return {
      x: this.richtingX,
      y: this.richtingY,
      boost,
      schiet: this.arena && this.hoofdknop.ingedrukt,
    };
  }
}
