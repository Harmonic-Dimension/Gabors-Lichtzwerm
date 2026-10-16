/**
 * Wereldopbouw met een reproduceerbare seed.
 * Dezelfde seed geeft altijd exact dezelfde plaatsing — handig bij testen.
 *
 * De wereld bestaat uit drie in elkaar overlopende gebieden:
 *   start  — rustig, kleine groepen, veel los licht
 *   midden — meer keuzevrijheid, stevigere groepen
 *   buiten — de zwaarste groepen én de Lichtkoning
 */

import { BALANS, WERELD, STANDAARD_SEED } from './config';
import { formatieStraal } from './rules';
import { GOLDEN_ANGLE, TAU, makeRng, rangeFrom } from './mathx';
import type { Baas, Bolletje, GebiedId, LosBolletje, Nevel, VijandGroep } from './types';

export interface Wereld {
  seed: number;
  breedte: number;
  hoogte: number;
  losseBolletjes: LosBolletje[];
  vijanden: VijandGroep[];
  baas: Baas;
  nevels: Nevel[];
}

function maakBolletje(rng: () => number, x: number, y: number): Bolletje {
  return {
    x,
    y,
    vx: 0,
    vy: 0,
    fase: rng() * TAU,
    maat: 0.82 + rng() * 0.42,
    glans: 0.76 + rng() * 0.24,
    omkleuren: 0,
  };
}

/** Legt de bolletjes van een vijandelijke groep in een losse wolk rond het middelpunt. */
export function vulGroep(rng: () => number, groep: VijandGroep): void {
  const straal = formatieStraal(groep.kracht);
  groep.bolletjes = [];
  for (let i = 0; i < groep.kracht; i++) {
    const hoek = i * GOLDEN_ANGLE;
    const r = straal * Math.sqrt((i + 0.55) / groep.kracht);
    groep.bolletjes.push(
      maakBolletje(rng, groep.x + Math.cos(hoek) * r, groep.y + Math.sin(hoek) * r),
    );
  }
}

interface Plek {
  x: number;
  y: number;
  r: number;
}

function zoekPlek(
  rng: () => number,
  gebied: { cx: number; cy: number; r: number },
  eigenStraal: number,
  bezet: Plek[],
  mijdStart: boolean,
): Plek {
  for (let poging = 0; poging < 400; poging++) {
    // sqrt zorgt voor een gelijkmatige spreiding over het oppervlak
    const hoek = rng() * TAU;
    const r = gebied.r * Math.sqrt(rng());
    const x = gebied.cx + Math.cos(hoek) * r;
    const y = gebied.cy + Math.sin(hoek) * r;
    if (x < WERELD.marge || x > WERELD.breedte - WERELD.marge) continue;
    if (y < WERELD.marge || y > WERELD.hoogte - WERELD.marge) continue;

    if (mijdStart) {
      const dStart = Math.hypot(x - WERELD.start.x, y - WERELD.start.y);
      if (dStart < WERELD.veiligeStraal + eigenStraal) continue;
    }
    // Niet bovenop de troon van de Lichtkoning
    const dBaas = Math.hypot(x - WERELD.baas.x, y - WERELD.baas.y);
    if (dBaas < 320 + eigenStraal) continue;

    let botst = false;
    for (const p of bezet) {
      if (Math.hypot(x - p.x, y - p.y) < p.r + eigenStraal + 150) {
        botst = true;
        break;
      }
    }
    if (!botst) return { x, y, r: eigenStraal };
  }
  // Noodgeval: leg hem gewoon op de rand van het gebied
  const hoek = rng() * TAU;
  return {
    x: gebied.cx + Math.cos(hoek) * gebied.r * 0.9,
    y: gebied.cy + Math.sin(hoek) * gebied.r * 0.9,
    r: eigenStraal,
  };
}

export function maakWereld(seed: number = STANDAARD_SEED): Wereld {
  const rng = makeRng(seed);
  const bezet: Plek[] = [];
  const losseBolletjes: LosBolletje[] = [];
  const vijanden: VijandGroep[] = [];

  // Drie bolletjes vlak bij de start, zodat het eerste succes binnen ~10 seconden komt.
  const welkom: Array<[number, number]> = [
    [WERELD.start.x + 215, WERELD.start.y - 95],
    [WERELD.start.x + 395, WERELD.start.y + 150],
    [WERELD.start.x + 640, WERELD.start.y - 60],
  ];
  let losId = 0;
  for (const [x, y] of welkom) {
    losseBolletjes.push({ id: losId++, x, y, fase: rng() * TAU, gebied: 'start', verzameld: false });
    bezet.push({ x, y, r: 30 });
  }

  for (const gebied of WERELD.gebieden) {
    const id = gebied.id as GebiedId;
    const aantalBlauw = gebied.blauw - (id === 'start' ? welkom.length : 0);
    for (let i = 0; i < aantalBlauw; i++) {
      const p = zoekPlek(rng, gebied, 26, bezet, false);
      bezet.push(p);
      losseBolletjes.push({ id: losId++, x: p.x, y: p.y, fase: rng() * TAU, gebied: id, verzameld: false });
    }
    for (const kracht of gebied.groepen) {
      const straal = formatieStraal(kracht);
      const p = zoekPlek(rng, gebied, straal + 40, bezet, true);
      bezet.push(p);
      const groep: VijandGroep = {
        id: vijanden.length,
        kracht,
        gebied: id,
        x: p.x,
        y: p.y,
        vx: 0,
        vy: 0,
        thuisX: p.x,
        thuisY: p.y,
        patrouilleStraal: rangeFrom(rng, 90, 230),
        patrouilleFase: rng() * TAU,
        patrouilleSnelheid: rangeFrom(rng, 0.14, 0.34) * (rng() < 0.5 ? -1 : 1),
        bolletjes: [],
        verslagen: false,
        rust: 0,
        alert: 0,
      };
      vulGroep(rng, groep);
      vijanden.push(groep);
    }
  }

  const baas: Baas = {
    x: WERELD.baas.x,
    y: WERELD.baas.y,
    vx: 0,
    vy: 0,
    thuisX: WERELD.baas.x,
    thuisY: WERELD.baas.y,
    kracht: BALANS.baasKracht,
    leven: BALANS.baasKracht,
    stand: 'zweven',
    timer: 0,
    kijkhoek: Math.PI,
    dwaalFase: rng() * TAU,
    verslagen: false,
    gezien: false,
  };

  // Sfeernevels: zachte blauw-paarse wolken, en een dieprode rond de troon.
  const nevels: Nevel[] = [
    { x: WERELD.baas.x, y: WERELD.baas.y, r: WERELD.baas.nevelStraal, tint: 0x6b0f2a, alpha: 0.5 },
    { x: WERELD.baas.x - 180, y: WERELD.baas.y + 120, r: 520, tint: 0x3d0c52, alpha: 0.42 },
  ];
  const nevelTinten = [0x1b3a8c, 0x2a1d6b, 0x123c6e, 0x3a1a63, 0x0f4a6e];
  for (let i = 0; i < 11; i++) {
    nevels.push({
      x: rangeFrom(rng, 200, WERELD.breedte - 1000),
      y: rangeFrom(rng, 200, WERELD.hoogte - 200),
      r: rangeFrom(rng, 340, 760),
      tint: nevelTinten[Math.floor(rng() * nevelTinten.length)],
      alpha: rangeFrom(rng, 0.18, 0.34),
    });
  }

  return {
    seed,
    breedte: WERELD.breedte,
    hoogte: WERELD.hoogte,
    losseBolletjes,
    vijanden,
    baas,
    nevels,
  };
}

/** Handig voor tests: het totaal aan te verzamelen blauwe bolletjes in een wereld. */
export function totaalBeschikbaar(wereld: Wereld): number {
  return (
    BALANS.startBolletjes +
    wereld.losseBolletjes.length +
    wereld.vijanden.reduce((som, v) => som + v.kracht, 0)
  );
}
