/**
 * Stuurgedrag voor zwermen (een lichte vorm van boids/veerkrachten).
 *
 * Elk bolletje heeft een gewenste plek in een zachte, ronde wolk rond het anker.
 * Daar bovenop komen: afstoting van buren, demping en een eigen zweefbeweging.
 * Het resultaat is een samenhangende lichtwolk — géén stuiterende knikkers.
 *
 * Bewust zonder Phaser, zodat de beweging ook in tests te draaien is.
 */

import { GOLDEN_ANGLE, damp } from './mathx';
import type { Bolletje } from './types';

export interface ZwermInstellingen {
  veer: number;
  demping: number;
  afstotingAfstand: number;
  afstotingKracht: number;
  zweefAmplitude: number;
}

export interface FormatieAnker {
  x: number;
  y: number;
  /** Genormaliseerde bewegingsrichting; (0,0) betekent stilstaand. */
  richtingX: number;
  richtingY: number;
  /** Straal van de wolk. */
  straal: number;
  /** 1 = rond, hoger = uitgerekt in de bewegingsrichting. */
  rek: number;
  /** Hoe ver de wolk achter het anker aan sleept. */
  sleep: number;
}

/**
 * Beweeg de bolletjes vanaf `vanaf` richting hun formatieplek.
 * Index `vanaf` is bedoeld om de leider over te slaan.
 */
export function stuurZwerm(
  bolletjes: Bolletje[],
  vanaf: number,
  anker: FormatieAnker,
  inst: ZwermInstellingen,
  tijd: number,
  dt: number,
): void {
  const n = bolletjes.length - vanaf;
  if (n <= 0) return;

  let dx = anker.richtingX;
  let dy = anker.richtingY;
  const dl = Math.hypot(dx, dy);
  if (dl < 0.0001) {
    dx = 1;
    dy = 0;
  } else {
    dx /= dl;
    dy /= dl;
  }

  const demp = damp(inst.demping, dt);

  for (let i = vanaf; i < bolletjes.length; i++) {
    const b = bolletjes[i];
    const j = i - vanaf;

    // Gulden hoek: spreidt de bolletjes gelijkmatig over de schijf.
    const hoek = j * GOLDEN_ANGLE + tijd * 0.16;
    const r = anker.straal * Math.sqrt((j + 0.62) / n);
    let langs = Math.cos(hoek) * r;
    const dwars = Math.sin(hoek) * r;

    langs = langs * anker.rek - anker.sleep;

    // Draai het lokale frame mee met de bewegingsrichting.
    let wensX = anker.x + langs * dx - dwars * dy;
    let wensY = anker.y + langs * dy + dwars * dx;

    // Eigen zweefbeweging per bolletje.
    const a = inst.zweefAmplitude;
    wensX += Math.sin(tijd * 1.45 + b.fase) * a;
    wensY += Math.cos(tijd * 1.12 + b.fase * 1.7) * a;

    b.vx += (wensX - b.x) * inst.veer * dt;
    b.vy += (wensY - b.y) * inst.veer * dt;
  }

  // Afstoting van nabije buren (O(n²), maar n blijft klein genoeg).
  const d0 = inst.afstotingAfstand;
  const d0Sq = d0 * d0;
  for (let i = vanaf; i < bolletjes.length; i++) {
    const a = bolletjes[i];
    for (let k = i + 1; k < bolletjes.length; k++) {
      const b = bolletjes[k];
      const ox = a.x - b.x;
      const oy = a.y - b.y;
      const dSq = ox * ox + oy * oy;
      if (dSq >= d0Sq || dSq < 0.0001) continue;
      const d = Math.sqrt(dSq);
      const kracht = (1 - d / d0) * inst.afstotingKracht * dt;
      const nx = ox / d;
      const ny = oy / d;
      a.vx += nx * kracht;
      a.vy += ny * kracht;
      b.vx -= nx * kracht;
      b.vy -= ny * kracht;
    }
  }

  for (let i = vanaf; i < bolletjes.length; i++) {
    const b = bolletjes[i];
    b.vx *= demp;
    b.vy *= demp;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    if (b.omkleuren > 0) b.omkleuren = Math.max(0, b.omkleuren - dt);
  }
}
