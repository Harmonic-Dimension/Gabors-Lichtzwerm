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
  seconden: number;
  reden: string;
}

function speel(strategie: Strategie, seed: number, maxSeconden = 900): Resultaat {
  const model = new SpelModel(seed);
  const dt = 1 / 60;
  let t = 0;

  while (t < maxSeconden && model.stand === 'spelen') {
    const sx = model.speler.midX;
    const sy = model.speler.midY;
    const afstand = (o: { x: number; y: number }) => Math.hypot(o.x - sx, o.y - sy);

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

    if (!doel) return { gewonnen: false, aantal: model.aantal, seconden: t, reden: 'geen doel meer' };

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
    model.update(dt, { x: dx / nl, y: dy / nl, boost: model.boostKlaar });
    t += dt;
  }

  return {
    gewonnen: model.stand === 'gewonnen',
    aantal: model.aantal,
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
        `  ${strategie.padEnd(12)} → ${r.gewonnen ? 'GEWONNEN' : r.reden} met ${r.aantal} bolletjes in ${r.seconden.toFixed(0)}s`,
      );
      expect(r.aantal).toBeGreaterThanOrEqual(NODIG_VOOR_BAAS);
      expect(r.gewonnen).toBe(true);
    });
  }

  it('werkt ook met andere wereld-seeds', () => {
    for (const seed of [1, 777, 31337]) {
      const r = speel('voorzichtig', seed);
      // eslint-disable-next-line no-console
      console.log(`  seed ${String(seed).padEnd(7)} → ${r.gewonnen ? 'GEWONNEN' : r.reden} (${r.aantal}) in ${r.seconden.toFixed(0)}s`);
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
      for (const e of model.update(dt, { x: dx / d, y: dy / d, boost: false })) {
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
