/** Win- en verliesscherm, als laag over het spel heen. */
import Phaser from 'phaser';
import { maakTexturen } from '../textures';
import { TEX } from '../textures';
import { MAX_BOLLETJES } from '../../core/config';
import { geluid } from '../audio';
import { maakKnop } from '../ui/knop';

const LETTER = 'Trebuchet MS, Segoe UI, sans-serif';

export interface EindData {
  gewonnen: boolean;
  aantal: number;
  seconden: number;
  kracht: number;
  doorBaas: boolean;
}

function tijdTekst(seconden: number): string {
  const m = Math.floor(seconden / 60);
  const s = Math.floor(seconden % 60);
  return m > 0 ? `${m} min ${s < 10 ? '0' : ''}${s} sec` : `${s} seconden`;
}

export class EindScene extends Phaser.Scene {
  private eind!: EindData;
  private onderdelen: Phaser.GameObjects.GameObject[] = [];

  constructor() {
    super('Eind');
  }

  preload(): void {
    maakTexturen(this);
  }

  create(data: EindData): void {
    this.eind = data;
    this.bouw();
    this.scale.on('resize', this.bouw, this);
    this.events.once('shutdown', () => this.scale.off('resize', this.bouw, this));

    this.input.keyboard?.on('keydown-R', () => this.opnieuw());
    this.input.keyboard?.on('keydown-ENTER', () => this.opnieuw());
    this.input.keyboard?.on('keydown-SPACE', () => this.opnieuw());
  }

  private bouw(): void {
    for (const o of this.onderdelen) o.destroy();
    this.onderdelen = [];
    const cam = this.cameras.main;
    const cx = cam.width / 2;
    const cy = cam.height / 2;
    const win = this.eind.gewonnen;
    // Schaal mee met het venster, zodat alles leesbaar blijft en past.
    const u = Phaser.Math.Clamp(Math.min(cam.height / 760, cam.width / 1180), 0.6, 1.1);

    const scherm = this.add
      .rectangle(0, 0, cam.width, cam.height, win ? 0x06122c : 0x1a0410, win ? 0.68 : 0.74)
      .setOrigin(0, 0);

    const pb = Math.min(640 * u, cam.width - 48);
    const ph = Math.min((win ? 410 : 350) * u, cam.height - 40);
    const px = cx - pb / 2;
    const py = cy - ph / 2;

    const gloed = this.add
      .image(cx, cy, TEX.gloed)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setTint(win ? 0xffd36b : 0xff5a6a)
      .setAlpha(0.3)
      .setDisplaySize(pb * 1.7, ph * 1.9);

    const paneel = this.add.graphics();
    paneel.fillStyle(0x071130, 0.78);
    paneel.fillRoundedRect(px, py, pb, ph, 26 * u);
    for (let i = 0; i < 4; i++) {
      paneel.lineStyle((12 - i * 2.6) * u, win ? 0xffd36b : 0xff6a7a, 0.05 + i * 0.05);
      paneel.strokeRoundedRect(px, py, pb, ph, 26 * u);
    }
    paneel.lineStyle(2, win ? 0xffe9a8 : 0xffa8b2, 0.7);
    paneel.strokeRoundedRect(px, py, pb, ph, 26 * u);

    const titel = this.add
      .text(cx, py + ph * 0.13, win ? 'GEWONNEN!' : 'Oei!', {
        fontFamily: LETTER,
        fontSize: `${Math.round((win ? 66 : 56) * u)}px`,
        color: '#ffffff',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setStroke(win ? '#6b4a00' : '#4a000f', Math.round(9 * u))
      .setShadow(0, 0, win ? '#ffd36b' : '#ff5a6a', 18, false, true);

    const regel = win
      ? 'Jij bent de nieuwe lichtkoning!'
      : this.eind.doorBaas
        ? `De Lichtkoning was te sterk. Hij heeft kracht ${this.eind.kracht}.`
        : `Die groep was te sterk. Hij had kracht ${this.eind.kracht}.`;

    const sub = this.add
      .text(cx, py + ph * 0.31, regel, {
        fontFamily: LETTER,
        fontSize: `${Math.round(23 * u)}px`,
        color: win ? '#ffe9a8' : '#ffc9cf',
        fontStyle: win ? 'italic' : 'normal',
        align: 'center',
        wordWrap: { width: pb - 70 * u },
      })
      .setOrigin(0.5);

    const stats = this.add
      .text(
        cx,
        py + ph * 0.52,
        win
          ? `Verzamelde bolletjes: ${this.eind.aantal} van de ${MAX_BOLLETJES}\nSpeeltijd: ${tijdTekst(this.eind.seconden)}`
          : `Je had ${this.eind.aantal} ${this.eind.aantal === 1 ? 'bolletje' : 'bolletjes'}.\nProbeer eerst wat meer licht te verzamelen!`,
        {
          fontFamily: LETTER,
          fontSize: `${Math.round(21 * u)}px`,
          color: '#cfe9ff',
          align: 'center',
          lineSpacing: 10 * u,
          wordWrap: { width: pb - 60 * u },
        },
      )
      .setOrigin(0.5);

    const knopY = py + ph * 0.79;
    const knop = maakKnop(
      this,
      cx,
      knopY,
      win ? 'Nog een keer!' : 'Opnieuw spelen',
      () => this.opnieuw(),
      {
        grootte: Math.round(31 * u),
        padding: Math.round(34 * u),
        kleur: win ? 0xffd98a : 0x7fe4ff,
        randKleur: win ? 0xfff0c4 : 0xd6f6ff,
      },
    );

    const hint = this.add
      .text(cx, py + ph * 0.93, 'of druk op R', {
        fontFamily: LETTER,
        fontSize: `${Math.round(15 * u)}px`,
        color: '#7fb6e8',
      })
      .setOrigin(0.5);

    this.onderdelen = [scherm, gloed, paneel, titel, sub, stats, knop.container, hint];

    titel.setScale(0.7);
    this.tweens.add({ targets: titel, scale: 1, duration: 420, ease: 'Back.easeOut' });
  }

  private opnieuw(): void {
    geluid.ontwaak();
    geluid.klik();
    const spel = this.scene.manager.getScene('Spel');
    this.scene.stop();
    if (spel) spel.scene.restart();
    else this.scene.start('Spel');
  }
}
