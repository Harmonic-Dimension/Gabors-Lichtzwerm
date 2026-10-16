/** Startscherm met een rustig bewegende lichtzwerm op de achtergrond. */
import Phaser from 'phaser';
import { maakTexturen } from '../textures';
import { KLEUR, TEX } from '../textures';
import { Achtergrond } from '../render/Achtergrond';
import { BolPool, type BolStijl } from '../render/Bolletjes';
import { stuurZwerm, type FormatieAnker } from '../../core/flock';
import { TAU, makeRng } from '../../core/mathx';
import type { Bolletje, Nevel } from '../../core/types';
import { geluid } from '../audio';
import { maakKnop } from '../ui/knop';

const LETTER = 'Trebuchet MS, Segoe UI, sans-serif';

const BLAUW: BolStijl = {
  gloedKleur: KLEUR.blauwGloed,
  kernKleur: 0xffffff,
  gloedMaat: 92,
  kernMaat: 14,
  gloedAlpha: 0.6,
};
const LEIDER: BolStijl = {
  gloedKleur: KLEUR.leiderGloed,
  kernKleur: 0xffffff,
  gloedMaat: 140,
  kernMaat: 22,
  gloedAlpha: 0.8,
};

export class MenuScene extends Phaser.Scene {
  private achtergrond!: Achtergrond;
  private pool!: BolPool;
  private zwerm: Bolletje[] = [];
  private ankerX = 0;
  private ankerY = 0;
  private vorigeX = 0;
  private vorigeY = 0;
  private tijd = 0;
  private onderdelen: Phaser.GameObjects.GameObject[] = [];
  private geluidKnop!: Phaser.GameObjects.Text;

  constructor() {
    super('Menu');
  }

  preload(): void {
    maakTexturen(this);
  }

  create(): void {
    const cam = this.cameras.main;
    cam.setBackgroundColor('#03061a');

    const rng = makeRng(4242);
    const nevels: Nevel[] = [];
    for (let i = 0; i < 6; i++) {
      nevels.push({
        x: rng() * cam.width,
        y: rng() * cam.height,
        r: 260 + rng() * 320,
        tint: [0x2a4bb8, 0x5c2a9c, 0x14618f][Math.floor(rng() * 3)],
        alpha: 0.2 + rng() * 0.2,
      });
    }
    this.achtergrond = new Achtergrond(this, nevels);
    this.pool = new BolPool(this, 2, 3);

    for (let i = 0; i < 26; i++) {
      this.zwerm.push({
        x: cam.width / 2,
        y: cam.height * 0.62,
        vx: 0,
        vy: 0,
        fase: rng() * TAU,
        maat: 0.85 + rng() * 0.4,
        glans: 0.8 + rng() * 0.2,
        omkleuren: 0,
      });
    }
    this.ankerX = cam.width / 2;
    this.ankerY = cam.height * 0.62;
    this.vorigeX = this.ankerX;
    this.vorigeY = this.ankerY;

    this.bouwUI();
    this.scale.on('resize', this.bouwUI, this);
    this.events.once('shutdown', () => {
      this.scale.off('resize', this.bouwUI, this);
      this.pool.vernietig();
    });

    this.input.keyboard?.on('keydown', (e: KeyboardEvent) => {
      geluid.ontwaak();
      if (e.code === 'Space' || e.code === 'Enter' || e.code === 'NumpadEnter') this.speel();
    });
    this.input.on('pointerdown', () => geluid.ontwaak());
  }

  private bouwUI(): void {
    for (const o of this.onderdelen) o.destroy();
    this.onderdelen = [];
    const cam = this.cameras.main;
    this.achtergrond.herschaal(cam.width, cam.height);
    const cx = cam.width / 2;
    // Eén schaalfactor houdt het scherm leesbaar, ook in een klein venster.
    const u = Phaser.Math.Clamp(Math.min(cam.height / 820, cam.width / 1280), 0.62, 1.15);

    const titelGrootte = Math.min(96, Math.max(40, cam.width * 0.082));
    const titelY = cam.height * 0.17;

    const titel = this.add
      .text(cx, titelY, 'LICHTZWERM', {
        fontFamily: LETTER,
        fontSize: `${titelGrootte}px`,
        color: '#ffffff',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setDepth(6)
      .setStroke('#0a2f6b', Math.round(titelGrootte * 0.11))
      .setShadow(0, 0, '#49d4ff', 16, false, true);
    titel.setLetterSpacing?.(Math.round(titelGrootte * 0.07));

    const gloed = this.add
      .image(cx, titelY, TEX.gloed)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setTint(0x3fc9ff)
      .setAlpha(0.42)
      .setDisplaySize(titel.width * 1.8, titelGrootte * 4.8)
      .setDepth(4);

    const onder = this.add
      .text(cx, titelY + titelGrootte * 0.82, 'Een spel bedacht door Gábor', {
        fontFamily: LETTER,
        fontSize: `${Math.round(23 * u)}px`,
        color: '#a9d9ff',
        fontStyle: 'italic',
      })
      .setOrigin(0.5)
      .setDepth(6);

    const knopY = cam.height * 0.57;
    const knopGloed = this.add
      .image(cx, knopY, TEX.gloed)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setTint(0x4fd8ff)
      .setAlpha(0.3)
      .setDisplaySize(460 * u, 250 * u)
      .setDepth(5);

    const knop = maakKnop(this, cx, knopY, 'SPELEN', () => this.speel(), {
      grootte: Math.round(46 * u),
      padding: Math.round(52 * u),
    });
    knop.container.setDepth(7);
    knop.tekstObject.setLetterSpacing?.(4);

    this.tweens.add({
      targets: knopGloed,
      alpha: 0.6,
      duration: 1300,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    const regelHoogte = Math.round(31 * u);
    const uitlegY = knopY + Math.round(78 * u);
    const regels = ['Pijltjes = bewegen', 'Verzamel blauw licht', 'Versla kleinere rode groepen'];
    const uitleg: Phaser.GameObjects.Text[] = [];
    regels.forEach((r, i) => {
      uitleg.push(
        this.add
          .text(cx, uitlegY + i * regelHoogte, r, {
            fontFamily: LETTER,
            fontSize: `${Math.round(22 * u)}px`,
            color: '#cfe9ff',
          })
          .setOrigin(0.5)
          .setDepth(6),
      );
    });

    const klein = this.add
      .text(cx, uitlegY + 3 * regelHoogte + Math.round(14 * u), 'Spatie = supersnel!', {
        fontFamily: LETTER,
        fontSize: `${Math.round(17 * u)}px`,
        color: '#7fb6e8',
      })
      .setOrigin(0.5)
      .setDepth(6);

    this.geluidKnop = this.add
      .text(cam.width - 42, 34, geluid.uit ? '🔇' : '🔊', { fontFamily: LETTER, fontSize: '26px' })
      .setOrigin(0.5)
      .setDepth(8)
      .setPadding(10)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        geluid.ontwaak();
        this.geluidKnop.setText(geluid.wissel() ? '🔇' : '🔊');
      });

    this.onderdelen = [gloed, titel, onder, knopGloed, knop.container, ...uitleg, klein, this.geluidKnop];
  }

  private speel(): void {
    geluid.ontwaak();
    geluid.klik();
    this.cameras.main.fadeOut(220, 3, 6, 26);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Spel'));
  }

  update(_t: number, deltaMs: number): void {
    const dt = Math.min(deltaMs / 1000, 1 / 20);
    this.tijd += dt;
    this.achtergrond.update(dt);

    const cam = this.cameras.main;
    // De zwerm maakt een rustige lus over het scherm.
    this.ankerX = cam.width / 2 + Math.cos(this.tijd * 0.34) * cam.width * 0.3;
    this.ankerY = cam.height * 0.42 + Math.sin(this.tijd * 0.47) * cam.height * 0.2;
    const vx = (this.ankerX - this.vorigeX) / dt;
    const vy = (this.ankerY - this.vorigeY) / dt;
    this.vorigeX = this.ankerX;
    this.vorigeY = this.ankerY;

    const anker: FormatieAnker = {
      x: this.ankerX,
      y: this.ankerY,
      richtingX: vx,
      richtingY: vy,
      straal: 72,
      rek: 1.25,
      sleep: 18,
    };
    stuurZwerm(
      this.zwerm,
      1,
      anker,
      {
        veer: 26,
        demping: 7,
        afstotingAfstand: 20,
        afstotingKracht: 150,
        zweefAmplitude: 8,
      },
      this.tijd,
      dt,
    );
    this.zwerm[0].x = this.ankerX;
    this.zwerm[0].y = this.ankerY;

    this.pool.begin();
    for (let i = 0; i < this.zwerm.length; i++) {
      const b = this.zwerm[i];
      const puls = 0.8 + Math.sin(this.tijd * 2.3 + b.fase) * 0.2;
      this.pool.teken(b.x, b.y, i === 0 ? LEIDER : BLAUW, b.maat, puls * b.glans);
    }
    this.pool.eind();
  }
}
