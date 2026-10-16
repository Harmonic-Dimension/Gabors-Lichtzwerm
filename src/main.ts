/** Lichtzwerm — opstart. */
import Phaser from 'phaser';
import { MenuScene } from './game/scenes/MenuScene';
import { SpelScene } from './game/scenes/SpelScene';
import { EindScene } from './game/scenes/EindScene';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'spel',
  backgroundColor: '#03061a',
  scale: {
    mode: Phaser.Scale.RESIZE,
    width: window.innerWidth,
    height: window.innerHeight,
    // De wereld rekt niet uit: we laten simpelweg meer of minder ruimte zien.
    expandParent: true,
  },
  render: {
    antialias: true,
    roundPixels: false,
    powerPreference: 'high-performance',
  },
  fps: { target: 60, min: 30 },
  scene: [MenuScene, SpelScene, EindScene],
};

export const spel = new Phaser.Game(config);

// Handig bij handmatig en geautomatiseerd testen.
(window as unknown as Record<string, unknown>).__spel = spel;
