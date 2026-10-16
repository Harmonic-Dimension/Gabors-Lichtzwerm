/**
 * Wiskundige controle van de spelbalans + een botsimulatie met drie
 * verschillende spelerstrategieën. Draai met: npm run balans
 */
import { describe, expect, it } from 'vitest';
import { BALANS, MAX_BOLLETJES, NODIG_VOOR_BAAS } from '../src/core/config';
import { SpelModel } from '../src/core/SpelModel';
import { botsStraal } from '../src/core/rules';
import type { VijandGroep } from '../src/core/types';

const GROEPEN = [...BALANS.rodeGroepen];
const LOS = BALANS.losseBlauweBolletjes;

/**
 * Alle bereikbare toestanden (welke groepen verslagen, hoeveel los licht
 * opgepakt). Puur combinatorisch, los van posities.
 */
function bereikbareToestanden() {
  const start = BALANS.startBolletjes;
  // key = masker * (LOS + 1) + aantalLos  -> totaal aantal bolletjes
  const bereikbaar = new Set<number>();
  const rij: Array<{ masker: number; los: number; totaal: number }> = [];
  const push = (masker: number, los: number, totaal: number) => {
    const key = masker * (LOS + 1) + los;
    if (bereikbaar.has(key)) return;
    bereikbaar.add(key);
    rij.push({ masker, los, totaal });
  };
  push(0, 0, start);

  const toestanden: Array<{ masker: number; los: number; totaal: number }> = [];
  while (rij.length) {
    const s = rij.pop()!;
    toestanden.push(s);
    if (s.los < LOS) push(s.masker, s.los + 1, s.totaal + 1);
    for (let i = 0; i < GROEPEN.length; i++) {
      if (s.masker & (1 << i)) continue;
      if (s.totaal > GROEPEN[i]) push(s.masker | (1 << i), s.los, s.totaal + GROEPEN[i]);
    }
  }
  return toestanden;
}

describe('wiskundige bereikbaarheid', () => {
  const toestanden = bereikbareToestanden();
  const winnend = toestanden.filter((t) => t.totaal >= NODIG_VOOR_BAAS);

  it('het maximum is precies 97', () => {
    expect(MAX_BOLLETJES).toBe(97);
    expect(Math.max(...toestanden.map((t) => t.totaal))).toBe(97);
  });

  it('66 is daadwerkelijk bereikbaar', () => {
    expect(winnend.length).toBeGreaterThan(0);
  });

  it('er bestaan heel veel verschillende routes naar 66', () => {
    // Verschillende combinaties van (verslagen groepen, opgepakt los licht).
    const uniek = new Set(winnend.map((t) => `${t.masker}:${t.los}`));
    expect(uniek.size).toBeGreaterThan(50);
  });

  it('je hoeft niet alles te verzamelen', () => {
    const zonderAlles = winnend.filter((t) => t.los < LOS);
    expect(zonderAlles.length).toBeGreaterThan(0);

    const zonderGrootste = winnend.filter((t) => !(t.masker & (1 << (GROEPEN.length - 1))));
    expect(zonderGrootste.length).toBeGreaterThan(0);
  });

  it('er bestaat een route die de grote groepen 14 en 16 overslaat', () => {
    const i14 = GROEPEN.indexOf(14);
    const i16 = GROEPEN.indexOf(16);
    const zonder = winnend.filter((t) => !(t.masker & (1 << i14)) && !(t.masker & (1 << i16)));
    // 1 + 16 los + 2+3+4+5+6+8+10+12 = 67 — dat kan net.
    expect(zonder.length).toBeGreaterThan(0);
  });

  it('65 bolletjes is niet genoeg, 66 wel', () => {
    const model = new SpelModel();
    expect(model.wereld.baas.kracht).toBe(65);
    expect(65 > model.wereld.baas.kracht).toBe(false);
    expect(66 > model.wereld.baas.kracht).toBe(true);
  });

  it('een speler met 1 bolletje kan altijd ergens beginnen', () => {
    // Met 1 bolletje kun je nog geen groep van 2 aan: er moet dus los licht zijn.
    expect(LOS).toBeGreaterThan(0);
    expect(Math.min(...GROEPEN)).toBeGreaterThan(BALANS.startBolletjes);
  });

  it('er is nooit een doodlopende situatie vóór 66', () => {
    for (const t of toestanden) {
      if (t.totaal >= NODIG_VOOR_BAAS) continue;
      const kanLos = t.los < LOS;
      const kanVechten = GROEPEN.some((k, i) => !(t.masker & (1 << i)) && t.totaal > k);
      expect(kanLos || kanVechten).toBe(true);
    }
  });
});

// --------------------------------------------------------------------------
// Botsimulatie: speelt het echte spel met drie verschillende strategieën.
// --------------------------------------------------------------------------

type Strategie = 'voorzichtig' | 'winstjager' | 'verzamelaar';

interface Resultaat {
  gewonnen: boolean;
  aantal: number;
  /** Het hoogste aantal bolletjes dat de speler ooit had. */
  piek: number;
  /** Aantal bolletjes op het moment dat de arena sloot. */
  bijArena: number;
  seconden: number;
  reden: string;
}

function speel(strategie: Strategie, seed: number, maxSeconden = 900): Resultaat {
  const model = new SpelModel(seed);
  const dt = 1 / 60;
  let t = 0;
  let piek = 1;
  let bijArena = 0;

  while (t < maxSeconden && model.stand === 'spelen') {
    const sx = model.speler.midX;
    const sy = model.speler.midY;
    const afstand = (o: { x: number; y: number }) => Math.hypot(o.x - sx, o.y - sy);

    piek = Math.max(piek, model.aantal);
    if (model.arenaActief && bijArena === 0) bijArena = model.aantal;

    // ---------------------------------------------------- het arenagevecht
    if (model.arenaActief) {
      const b = model.wereld.baas;
      const licht = model.wereld.losseBolletjes.filter((o) => !o.verzameld);
      let dx: number;
      let dy: number;
      if (licht.length) {
        // Gevallen licht oprapen: dat houdt je gevecht gaande.
        const doel = licht.reduce((a, c) => (afstand(a) < afstand(c) ? a : c));
        dx = doel.x - model.speler.x;
        dy = doel.y - model.speler.y;
      } else {
        // Anders op veilige afstand om de koning heen cirkelen.
        const hoek = Math.atan2(sy - b.y, sx - b.x) + 0.9;
        dx = b.x + Math.cos(hoek) * 470 - model.speler.x;
        dy = b.y + Math.sin(hoek) * 470 - model.speler.y;
      }
      let nx = dx;
      let ny = dy;
      const duw = (ox: number, oy: number, veilig: number, kracht: number) => {
        const ax = model.speler.x - ox;
        const ay = model.speler.y - oy;
        const ad = Math.hypot(ax, ay) || 1;
        if (ad < veilig) {
          nx += (ax / ad) * (1 - ad / veilig) * kracht;
          ny += (ay / ad) * (1 - ad / veilig) * kracht;
        }
      };
      duw(b.x, b.y, 330, 900);
      for (const v of model.vonken) duw(v.x, v.y, 110, 700);
      const nl = Math.hypot(nx, ny) || 1;
      model.update(dt, { x: nx / nl, y: ny / nl, boost: false, schiet: true });
      t += dt;
      continue;
    }

    const losVrij = model.wereld.losseBolletjes.filter((o) => !o.verzameld);
    const teVerslaan = model.wereld.vijanden.filter((v) => !v.verslagen && v.kracht < model.aantal);

    let doel: { x: number; y: number } | null = null;
    if (model.aantal > model.wereld.baas.kracht) {
      doel = model.wereld.baas;
    } else if (strategie === 'verzamelaar' && losVrij.length) {
      doel = losVrij.reduce((a, b) => (afstand(a) < afstand(b) ? a : b));
    } else if (strategie === 'winstjager' && teVerslaan.length) {
      doel = teVerslaan.reduce((a, b) =>
        b.kracht > a.kracht || (b.kracht === a.kracht && afstand(b) < afstand(a)) ? b : a,
      );
    } else {
      const kandidaten: Array<{ x: number; y: number; score: number }> = [];
      for (const o of losVrij) kandidaten.push({ x: o.x, y: o.y, score: afstand(o) });
      for (const v of teVerslaan) {
        const bonus = strategie === 'voorzichtig' ? v.kracht * 55 : -v.kracht * 60;
        kandidaten.push({ x: v.x, y: v.y, score: afstand(v) + bonus });
      }
      if (kandidaten.length) doel = kandidaten.reduce((a, b) => (a.score < b.score ? a : b));
    }

    if (!doel) {
      return { gewonnen: false, aantal: model.aantal, piek, bijArena, seconden: t, reden: 'geen doel meer' };
    }

    let dx = doel.x - model.speler.x;
    let dy = doel.y - model.speler.y;
    const d = Math.hypot(dx, dy) || 1;
    dx /= d;
    dy /= d;

    // Wijk uit voor alles wat sterker is dan jij.
    const mijd = (ox: number, oy: number, straal: number) => {
      const ddx = model.speler.x - ox;
      const ddy = model.speler.y - oy;
      const dd = Math.hypot(ddx, ddy) || 1;
      const veilig = straal + botsStraal(model.aantal) + 170;
      if (dd < veilig) {
        const kracht = (1 - dd / veilig) * 3.2;
        dx += (ddx / dd) * kracht;
        dy += (ddy / dd) * kracht;
      }
    };
    for (const v of model.wereld.vijanden as VijandGroep[]) {
      if (v.verslagen || v.kracht < model.aantal) continue;
      if (doel === (v as unknown as { x: number; y: number })) continue;
      mijd(v.x, v.y, botsStraal(v.kracht));
    }
    if (model.aantal <= model.wereld.baas.kracht) mijd(model.wereld.baas.x, model.wereld.baas.y, 190);

    const nl = Math.hypot(dx, dy) || 1;
    model.update(dt, { x: dx / nl, y: dy / nl, boost: model.boostKlaar, schiet: false });
    t += dt;
  }

  return {
    gewonnen: model.stand === 'gewonnen',
    aantal: model.aantal,
    piek,
    bijArena,
    seconden: t,
    reden: model.stand,
  };
}

describe('botsimulatie met verschillende strategieën', () => {
  const strategieen: Strategie[] = ['voorzichtig', 'winstjager', 'verzamelaar'];

  for (const strategie of strategieen) {
    it(`strategie "${strategie}" haalt 66 en verslaat de Lichtkoning`, () => {
      const r = speel(strategie, 20251016);
      // eslint-disable-next-line no-console
      console.log(
        `  ${strategie.padEnd(12)} → ${r.gewonnen ? 'GEWONNEN' : r.reden} · piek ${r.piek} · arena met ${r.bijArena} · over ${r.aantal} · ${r.seconden.toFixed(0)}s`,
      );
      expect(r.piek).toBeGreaterThanOrEqual(NODIG_VOOR_BAAS);
      expect(r.bijArena).toBeGreaterThanOrEqual(NODIG_VOOR_BAAS);
      expect(r.gewonnen).toBe(true);
      // Na het gevecht moet er licht overblijven — anders is de balans te krap.
      expect(r.aantal).toBeGreaterThan(0);
    });
  }

  it('werkt ook met andere wereld-seeds', () => {
    for (const seed of [1, 777, 31337]) {
      const r = speel('voorzichtig', seed);
      // eslint-disable-next-line no-console
      console.log(
        `  seed ${String(seed).padEnd(7)} → ${r.gewonnen ? 'GEWONNEN' : r.reden} · arena met ${r.bijArena} · over ${r.aantal} · ${r.seconden.toFixed(0)}s`,
      );
      expect(r.gewonnen).toBe(true);
    }
  });

  it('telt na iedere overwinning correct op', () => {
    const model = new SpelModel();
    const dt = 1 / 60;
    let verwacht = 1;
    for (let i = 0; i < 60 * 600 && model.stand === 'spelen'; i++) {
      const losVrij = model.wereld.losseBolletjes.filter((o) => !o.verzameld);
      const teVerslaan = model.wereld.vijanden.filter((v) => !v.verslagen && v.kracht < model.aantal);
      const alles = [...losVrij, ...teVerslaan];
      if (!alles.length) break;
      const doel = alles.reduce((a, b) =>
        Math.hypot(a.x - model.speler.x, a.y - model.speler.y) <
        Math.hypot(b.x - model.speler.x, b.y - model.speler.y)
          ? a
          : b,
      );
      const dx = doel.x - model.speler.x;
      const dy = doel.y - model.speler.y;
      const d = Math.hypot(dx, dy) || 1;
      for (const e of model.update(dt, { x: dx / d, y: dy / d, boost: false, schiet: false })) {
        if (e.soort === 'verzameld') verwacht += 1;
        if (e.soort === 'verslagen') verwacht += e.winst;
        if (e.soort === 'verzameld' || e.soort === 'verslagen') {
          expect(e.totaal).toBe(verwacht);
          expect(model.aantal).toBe(verwacht);
        }
      }
    }
    expect(verwacht).toBeGreaterThan(20);
  });
});
