/** Eén stijl voor alle knoppen: afgerond, met een zachte gloed eromheen. */
import Phaser from 'phaser';
import { TEX } from '../textures';
import { geluid } from '../audio';

const LETTER = 'Trebuchet MS, Segoe UI, sans-serif';

export interface KnopOpties {
  grootte?: number;
  kleur?: number;
  tekstKleur?: string;
  randKleur?: number;
  /** Extra ruimte links en rechts van de tekst. */
  padding?: number;
  gloed?: boolean;
}

export interface Knop {
  container: Phaser.GameObjects.Container;
  tekstObject: Phaser.GameObjects.Text;
  zetTekst(t: string): void;
}

export function maakKnop(
  scene: Phaser.Scene,
  x: number,
  y: number,
  tekst: string,
  opKlik: () => void,
  opties: KnopOpties = {},
): Knop {
  const grootte = opties.grootte ?? 30;
  const kleur = opties.kleur ?? 0x7fe4ff;
  const randKleur = opties.randKleur ?? 0xd6f6ff;
  const padX = opties.padding ?? 34;

  const label = scene.add
    .text(0, 0, tekst, {
      fontFamily: LETTER,
      fontSize: `${grootte}px`,
      color: opties.tekstKleur ?? '#04172e',
      fontStyle: 'bold',
    })
    .setOrigin(0.5);

  const achtergrond = scene.add.graphics();
  const gloed = scene.add
    .image(0, 0, TEX.gloed)
    .setBlendMode(Phaser.BlendModes.ADD)
    .setTint(kleur)
    .setAlpha(opties.gloed === false ? 0 : 0.4);

  const container = scene.add.container(x, y, [gloed, achtergrond, label]);

  const teken = (schaal: number) => {
    const b = label.width + padX * 2;
    const h = label.height + grootte * 0.52;
    const r = h / 2;
    achtergrond.clear();
    achtergrond.fillStyle(kleur, 0.96);
    achtergrond.fillRoundedRect(-b / 2, -h / 2, b, h, r);
    achtergrond.lineStyle(2.5, randKleur, 0.9);
    achtergrond.strokeRoundedRect(-b / 2, -h / 2, b, h, r);
    gloed.setDisplaySize(b * 1.9 * schaal, h * 3.1 * schaal);
    container.setSize(b, h);
  };
  teken(1);

  container
    .setInteractive(
      new Phaser.Geom.Rectangle(-container.width / 2, -container.height / 2, container.width, container.height),
      Phaser.Geom.Rectangle.Contains,
    )
    .on('pointerover', () => {
      scene.tweens.add({ targets: container, scale: 1.06, duration: 120, ease: 'Quad.easeOut' });
      scene.input.manager.canvas.style.cursor = 'pointer';
    })
    .on('pointerout', () => {
      scene.tweens.add({ targets: container, scale: 1, duration: 120 });
      scene.input.manager.canvas.style.cursor = 'default';
    })
    .on('pointerdown', () => {
      geluid.ontwaak();
      geluid.klik();
      scene.input.manager.canvas.style.cursor = 'default';
      opKlik();
    });

  return {
    container,
    tekstObject: label,
    zetTekst(t: string) {
      label.setText(t);
      teken(container.scale);
    },
  };
}
