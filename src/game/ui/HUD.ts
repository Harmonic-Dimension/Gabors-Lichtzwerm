/**
 * De interface tijdens het spel: het aantal bolletjes (hét getal van het spel),
 * de boostmeter, korte meldingen en een pijl naar de Lichtkoning.
 */
import Phaser from 'phaser';
import { TEX } from '../textures';
import { NODIG_VOOR_BAAS } from '../../core/config';

const LETTER = 'Trebuchet MS, Segoe UI, sans-serif';

export class HUD {
  private readonly container: Phaser.GameObjects.Container;
  private paneel: Phaser.GameObjects.Graphics;
  private label: Phaser.GameObjects.Text;
  private getal: Phaser.GameObjects.Text;
  private getalGloed: Phaser.GameObjects.Image;
  private boostBalk: Phaser.GameObjects.Graphics;
  private boostLabel: Phaser.GameObjects.Text;
  private melding: Phaser.GameObjects.Text;
  private meldingPil: Phaser.GameObjects.Graphics;
  private meldingBox: Phaser.GameObjects.Container;
  private pijl: Phaser.GameObjects.Image;
  private pijlTekst: Phaser.GameObjects.Text;
  private geluidKnop: Phaser.GameObjects.Text;
  private hint: Phaser.GameObjects.Text;
  private rechtsboven: Phaser.GameObjects.Container;
  private baasBox: Phaser.GameObjects.Container;
  private baasPaneel: Phaser.GameObjects.Graphics;
  private baasGetal: Phaser.GameObjects.Text;
  private baasBalk: Phaser.GameObjects.Graphics;
  private raakRand: Phaser.GameObjects.Graphics;
  private laatsteAantal = -1;
  private laatsteBaas = -1;
  private baasStart = 0;

  constructor(
    private scene: Phaser.Scene,
    opGeluidKnop: () => void,
  ) {
    const d = 1000;
    this.paneel = scene.add.graphics();
    this.tekenPaneel();

    this.label = scene.add.text(30, 26, 'JOUW ZWERM', {
      fontFamily: LETTER,
      fontSize: '17px',
      color: '#8fd9ff',
      fontStyle: 'bold',
    });
    this.label.setLetterSpacing?.(3);

    this.getalGloed = scene.add
      .image(108, 76, TEX.gloed)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setTint(0x4fd8ff)
      .setAlpha(0.5)
      .setDisplaySize(190, 130);

    this.getal = scene.add
      .text(30, 44, '1', {
        fontFamily: LETTER,
        fontSize: '62px',
        color: '#ffffff',
        fontStyle: 'bold',
      })
      .setStroke('#0a2f6b', 7)
      .setShadow(0, 0, '#49d4ff', 22, false, true);

    this.boostBalk = scene.add.graphics();
    this.boostLabel = scene.add.text(30, 123, 'BOOST', {
      fontFamily: LETTER,
      fontSize: '13px',
      color: '#7fb6e8',
      fontStyle: 'bold',
    });
    this.boostLabel.setLetterSpacing?.(2);

    this.container = scene.add
      .container(0, 0, [
        this.paneel,
        this.getalGloed,
        this.label,
        this.getal,
        this.boostBalk,
        this.boostLabel,
      ])
      .setScrollFactor(0)
      .setDepth(d);

    // Paneel van de Lichtkoning, alleen zichtbaar tijdens het eindgevecht.
    this.baasPaneel = scene.add.graphics();
    const baasLabel = scene.add
      .text(0, -34, 'LICHTKONING', {
        fontFamily: LETTER,
        fontSize: '15px',
        color: '#ffb0a8',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
    baasLabel.setLetterSpacing?.(3);
    this.baasGetal = scene.add
      .text(0, 6, '65', {
        fontFamily: LETTER,
        fontSize: '46px',
        color: '#ffffff',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setStroke('#55000f', 6)
      .setShadow(0, 0, '#ff4a4a', 14, false, true);
    this.baasBalk = scene.add.graphics();
    this.baasBox = scene.add
      .container(0, 0, [this.baasPaneel, this.baasBalk, baasLabel, this.baasGetal])
      .setScrollFactor(0)
      .setDepth(d)
      .setAlpha(0);

    this.raakRand = scene.add.graphics().setScrollFactor(0).setDepth(d + 3).setAlpha(0);

    this.meldingPil = scene.add.graphics();
    this.melding = scene.add
      .text(0, 0, '', {
        fontFamily: LETTER,
        fontSize: '26px',
        color: '#eaf8ff',
        fontStyle: 'bold',
        align: 'center',
      })
      .setOrigin(0.5);
    this.meldingBox = scene.add
      .container(0, 0, [this.meldingPil, this.melding])
      .setScrollFactor(0)
      .setDepth(d + 2)
      .setAlpha(0);

    this.pijl = scene.add
      .image(0, 0, TEX.pijl)
      .setScrollFactor(0)
      .setDepth(d + 1)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setTint(0xff7a6a)
      .setAlpha(0)
      .setDisplaySize(52, 52);

    this.pijlTekst = scene.add
      .text(0, 0, 'LICHTKONING', {
        fontFamily: LETTER,
        fontSize: '14px',
        color: '#ffb3a8',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(d + 1)
      .setAlpha(0);

    this.geluidKnop = scene.add
      .text(0, 0, '🔊', { fontFamily: LETTER, fontSize: '26px' })
      .setOrigin(0.5)
      .setPadding(10)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', opGeluidKnop);

    this.hint = scene.add
      .text(0, 0, 'Esc = pauze', {
        fontFamily: LETTER,
        fontSize: '14px',
        color: '#6f9fd0',
      })
      .setOrigin(1, 0.5);

    this.rechtsboven = scene.add
      .container(0, 0, [this.geluidKnop, this.hint])
      .setScrollFactor(0)
      .setDepth(d);

    this.herschaal();
  }

  private tekenPaneel(): void {
    const g = this.paneel;
    g.clear();
    g.fillStyle(0x071130, 0.55);
    g.fillRoundedRect(16, 14, 240, 128, 22);
    for (let i = 0; i < 4; i++) {
      g.lineStyle(10 - i * 2.2, 0x3fc9ff, 0.05 + i * 0.045);
      g.strokeRoundedRect(16, 14, 240, 128, 22);
    }
    g.lineStyle(2, 0x7fe4ff, 0.65);
    g.strokeRoundedRect(16, 14, 240, 128, 22);
  }

  /** Alle UI-objecten, zodat de wereldcamera ze kan negeren. */
  objecten(): Phaser.GameObjects.GameObject[] {
    return [
      this.container,
      this.meldingBox,
      this.pijl,
      this.pijlTekst,
      this.rechtsboven,
      this.baasBox,
      this.raakRand,
    ];
  }

  herschaal(): void {
    const cam = this.scene.cameras.main;
    this.container.setPosition(0, 0);
    this.baasBox.setPosition(cam.width / 2, 58);
    this.raakRand.clear();
    this.raakRand.lineStyle(44, 0xff2b3c, 0.5);
    this.raakRand.strokeRect(-22, -22, cam.width + 44, cam.height + 44);
    this.meldingBox.setPosition(cam.width / 2, cam.height - 62);
    this.melding.setWordWrapWidth(Math.max(260, cam.width - 140));
    this.tekenPil();
    this.rechtsboven.setPosition(cam.width - 46, 36);
    this.hint.setPosition(-34, 1);
  }

  zetGeluid(uit: boolean): void {
    this.geluidKnop.setText(uit ? '🔇' : '🔊');
  }

  /** Toont tijdens het gevecht hoeveel kracht de Lichtkoning nog heeft. */
  private updateBaasPaneel(leven: number | null): void {
    if (leven === null) {
      if (this.baasBox.alpha > 0) this.baasBox.setAlpha(Math.max(0, this.baasBox.alpha - 0.06));
      return;
    }
    if (this.baasBox.alpha < 1) this.baasBox.setAlpha(Math.min(1, this.baasBox.alpha + 0.05));
    if (this.baasStart === 0) this.baasStart = leven;

    if (leven !== this.laatsteBaas) {
      this.laatsteBaas = leven;
      this.baasGetal.setText(String(leven));
      this.scene.tweens.killTweensOf(this.baasGetal);
      this.baasGetal.setScale(1.22);
      this.scene.tweens.add({ targets: this.baasGetal, scale: 1, duration: 150 });

      const b = 196;
      const h = 94;
      const g = this.baasPaneel;
      g.clear();
      g.fillStyle(0x24050c, 0.6);
      g.fillRoundedRect(-b / 2, -h / 2 - 8, b, h, 20);
      for (let i = 0; i < 4; i++) {
        g.lineStyle(9 - i * 2, 0xff3a46, 0.05 + i * 0.05);
        g.strokeRoundedRect(-b / 2, -h / 2 - 8, b, h, 20);
      }
      g.lineStyle(2, 0xffa8a0, 0.65);
      g.strokeRoundedRect(-b / 2, -h / 2 - 8, b, h, 20);

      // Balkje dat leegloopt terwijl jij hem afbreekt.
      const deel = this.baasStart > 0 ? leven / this.baasStart : 0;
      const bb = this.baasBalk;
      bb.clear();
      bb.fillStyle(0x3d0a14, 0.9);
      bb.fillRoundedRect(-74, 28, 148, 9, 4);
      bb.fillStyle(0xff5a4a, 1);
      bb.fillRoundedRect(-74, 28, Math.max(3, 148 * deel), 9, 4);
    }
  }

  private tekenPil(): void {
    const g = this.meldingPil;
    g.clear();
    if (!this.melding.text) return;
    const b = this.melding.width + 46;
    const h = this.melding.height + 20;
    g.fillStyle(0x061634, 0.62);
    g.fillRoundedRect(-b / 2, -h / 2, b, h, h / 2);
    g.lineStyle(1.5, 0x4fd8ff, 0.3);
    g.strokeRoundedRect(-b / 2, -h / 2, b, h, h / 2);
  }

  /** Korte, rustige melding onderin — altijd leesbaar, nooit in de weg. */
  toon(tekst: string, kleur = '#eaf8ff', duur = 2200): void {
    this.melding.setText(tekst).setColor(kleur);
    this.tekenPil();
    this.scene.tweens.killTweensOf(this.meldingBox);
    this.meldingBox.setAlpha(0).setScale(0.9);
    this.scene.tweens.add({
      targets: this.meldingBox,
      alpha: 1,
      scale: 1,
      duration: 240,
      ease: 'Back.easeOut',
      onComplete: () => {
        this.scene.tweens.add({
          targets: this.meldingBox,
          alpha: 0,
          delay: duur,
          duration: 420,
        });
      },
    });
  }

  /** Laat het getal even oplichten en omhoog springen. */
  vierTelling(): void {
    this.scene.tweens.killTweensOf(this.getal);
    this.getal.setScale(1);
    this.scene.tweens.add({
      targets: this.getal,
      scaleX: 1.28,
      scaleY: 1.28,
      duration: 130,
      yoyo: true,
      ease: 'Quad.easeOut',
    });
    this.scene.tweens.add({
      targets: this.getalGloed,
      alpha: 1,
      duration: 110,
      yoyo: true,
    });
  }

  update(
    aantal: number,
    boostLading: number,
    sterkGenoeg: boolean,
    baasRichting: { hoek: number; zichtbaar: boolean } | null,
    baasLeven: number | null,
    geraakt: boolean,
  ): void {
    this.updateBaasPaneel(baasLeven);
    this.raakRand.setAlpha(
      geraakt ? 0.35 + Math.sin(this.scene.time.now / 70) * 0.2 : Math.max(0, this.raakRand.alpha - 0.05),
    );
    if (aantal !== this.laatsteAantal) {
      this.getal.setText(String(aantal));
      this.laatsteAantal = aantal;
      this.getalGloed.setDisplaySize(130 + this.getal.width, 130);
    }

    // Boostmeter.
    const g = this.boostBalk;
    g.clear();
    const x = 94;
    const y = 124;
    const b = 150;
    const h = 11;
    g.fillStyle(0x0b2550, 0.9);
    g.fillRoundedRect(x, y, b, h, 5);
    const vol = boostLading >= 1;
    g.fillStyle(vol ? 0x7af0ff : 0x3a86c9, vol ? 1 : 0.85);
    g.fillRoundedRect(x, y, Math.max(4, b * boostLading), h, 5);
    g.lineStyle(1.5, vol ? 0xbdf6ff : 0x2b5f96, 0.9);
    g.strokeRoundedRect(x, y, b, h, 5);
    this.boostLabel.setColor(vol ? '#b6f2ff' : '#6b94bd');

    // Pijl naar de Lichtkoning zodra je sterk genoeg bent.
    if (sterkGenoeg && baasRichting && !baasRichting.zichtbaar) {
      const cam = this.scene.cameras.main;
      const cx = cam.width / 2;
      const cy = cam.height / 2;
      const r = Math.min(cam.width, cam.height) * 0.38;
      const px = cx + Math.cos(baasRichting.hoek) * r;
      const py = cy + Math.sin(baasRichting.hoek) * r;
      const puls = 0.78 + Math.sin(this.scene.time.now / 260) * 0.22;
      this.pijl.setPosition(px, py).setRotation(baasRichting.hoek).setAlpha(puls);
      this.pijlTekst
        .setPosition(px - Math.cos(baasRichting.hoek) * 62, py - Math.sin(baasRichting.hoek) * 62)
        .setAlpha(puls * 0.9);
    } else {
      this.pijl.setAlpha(0);
      this.pijlTekst.setAlpha(0);
    }

    // Subtiele kleurwissel zodra je sterk genoeg bent voor de baas.
    if (aantal >= NODIG_VOOR_BAAS) {
      this.getal.setColor('#fff3c4');
    }
  }
}
