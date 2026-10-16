/** Lichtzwerm — opstart. */
import Phaser from 'phaser';
import { MenuScene } from './game/scenes/MenuScene';
import { SpelScene } from './game/scenes/SpelScene';
import { EindScene } from './game/scenes/EindScene';
import { huidigeMaat, type Maat } from './game/schermmaat';

const HOUDER = 'spel';
/** Gebeurtenissen die kunnen betekenen dat de pagina nu wél opgemeten is. */
const WEKKERS = ['resize', 'load', 'pageshow', 'orientationchange'] as const;

let spel: Phaser.Game | null = null;
let wachtend = false;

function maakSpel(maat: Maat): Phaser.Game {
  const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    parent: HOUDER,
    backgroundColor: '#03061a',
    scale: {
      mode: Phaser.Scale.RESIZE,
      width: maat.breedte,
      height: maat.hoogte,
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
  return new Phaser.Game(config);
}

/** Laat een leesbare uitleg zien in plaats van een zwart scherm. */
function toonStoring(bericht: string): void {
  const houder = document.getElementById(HOUDER);
  if (!houder || houder.querySelector('.storing')) return;
  const p = document.createElement('p');
  p.className = 'storing';
  p.textContent = bericht;
  houder.appendChild(p);
}

function stopWachten(): void {
  if (!wachtend) return;
  wachtend = false;
  for (const naam of WEKKERS) window.removeEventListener(naam, probeerStarten);
  document.removeEventListener('visibilitychange', probeerStarten);
}

function beginWachten(): void {
  if (wachtend) return;
  wachtend = true;
  for (const naam of WEKKERS) window.addEventListener(naam, probeerStarten, { passive: true });
  document.addEventListener('visibilitychange', probeerStarten, { passive: true });
}

let pogingen = 0;

function probeerStarten(): void {
  if (spel) return;
  const maat = huidigeMaat(document.getElementById(HOUDER));

  if (!maat) {
    // Nog geen layout. Wachten is beter dan starten met een nulmaat.
    pogingen++;
    beginWachten();
    if (pogingen < 900) requestAnimationFrame(probeerStarten);
    else toonStoring('Het spel kon niet starten: het scherm heeft geen afmeting.');
    return;
  }

  stopWachten();
  try {
    spel = maakSpel(maat);
  } catch (fout) {
    toonStoring('Het spel kon niet starten. Herlaad de pagina eens.');
    throw fout;
  }

  // Handig bij handmatig en geautomatiseerd testen.
  (window as unknown as Record<string, unknown>).__spel = spel;

  /*
   * Vangnet: komt de pagina terug uit de geschiedenis of werd hij toch met een
   * nulmaat geboren, dan zetten we het formaat alsnog goed.
   */
  const bijleggen = () => {
    if (!spel?.scale) return;
    const nu = huidigeMaat(document.getElementById(HOUDER));
    if (nu && (spel.scale.width < 2 || spel.scale.height < 2)) {
      spel.scale.resize(nu.breedte, nu.hoogte);
    }
  };
  window.addEventListener('pageshow', bijleggen, { passive: true });
  const bewaker = window.setInterval(bijleggen, 500);
  window.setTimeout(() => window.clearInterval(bewaker), 15_000);
}

probeerStarten();
