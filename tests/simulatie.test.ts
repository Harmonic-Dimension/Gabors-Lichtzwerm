import { describe, expect, it } from 'vitest';
import { SpelModel } from '../src/core/SpelModel';
import { maakWereld, totaalBeschikbaar } from '../src/core/world';
import { ARENA, BALANS, MAX_BOLLETJES, SPELER, VIJAND } from '../src/core/config';
import type { Invoer } from '../src/core/types';

const STIL: Invoer = { x: 0, y: 0, boost: false, schiet: false };

function stap(model: SpelModel, seconden: number, invoer: Invoer = STIL) {
  const dt = 1 / 60;
  const n = Math.round(seconden / dt);
  for (let i = 0; i < n; i++) model.update(dt, invoer);
}

/** Vliegt de speler recht naar een (eventueel bewegend) doel toe. */
function vliegNaar(
  model: SpelModel,
  doel: { x: number; y: number },
  maxSeconden = 60,
  boost = false,
) {
  const dt = 1 / 60;
  for (let i = 0; i < maxSeconden / dt; i++) {
    const dx = doel.x - model.speler.x;
    const dy = doel.y - model.speler.y;
    const d = Math.hypot(dx, dy) || 1;
    model.update(dt, { x: dx / d, y: dy / d, boost: boost && model.boostKlaar, schiet: false });
    if (model.stand !== 'spelen') return true;
    if (d < 8) return true;
  }
  return false;
}

describe('wereldopbouw', () => {
  it('is reproduceerbaar met dezelfde seed', () => {
    const a = maakWereld(12345);
    const b = maakWereld(12345);
    expect(a.losseBolletjes.map((o) => [o.x, o.y])).toEqual(b.losseBolletjes.map((o) => [o.x, o.y]));
    expect(a.vijanden.map((v) => [v.x, v.y, v.kracht])).toEqual(
      b.vijanden.map((v) => [v.x, v.y, v.kracht]),
    );
  });

  it('bevat 16 losse bolletjes en 10 rode groepen', () => {
    const w = maakWereld();
    expect(w.losseBolletjes.length).toBe(BALANS.losseBlauweBolletjes);
    expect(w.vijanden.length).toBe(BALANS.rodeGroepen.length);
    expect(w.vijanden.map((v) => v.kracht).sort((a, b) => a - b)).toEqual([
      2, 3, 4, 5, 6, 8, 10, 12, 14, 16,
    ]);
  });

  it('telt in totaal precies 97 beschikbare bolletjes', () => {
    expect(totaalBeschikbaar(maakWereld())).toBe(MAX_BOLLETJES);
    expect(totaalBeschikbaar(maakWereld(777))).toBe(97);
  });

  it('zet geen vijanden in het veilige startgebied', () => {
    for (const seed of [1, 42, 2024, 99999]) {
      const w = maakWereld(seed);
      for (const v of w.vijanden) {
        expect(Math.hypot(v.x - 950, v.y - 2700)).toBeGreaterThan(580);
      }
    }
  });

  it('legt een paar bolletjes vlakbij de start voor een snel eerste succes', () => {
    const w = maakWereld();
    const dichtbij = w.losseBolletjes.filter(
      (o) => Math.hypot(o.x - 950, o.y - 2700) < 480,
    );
    expect(dichtbij.length).toBeGreaterThanOrEqual(1);
  });

  it('verdeelt de gebieden zoals afgesproken', () => {
    const w = maakWereld();
    const per = (g: string) => w.vijanden.filter((v) => v.gebied === g).map((v) => v.kracht).sort((a, b) => a - b);
    expect(per('start')).toEqual([2, 3, 4, 5]);
    expect(per('midden')).toEqual([6, 8, 10, 12]);
    expect(per('buiten')).toEqual([14, 16]);
  });
});

describe('verzamelen en vechten in de simulatie', () => {
  it('pakt een los bolletje op en telt naar 2', () => {
    const model = new SpelModel();
    const doel = model.wereld.losseBolletjes[0];
    expect(model.aantal).toBe(1);
    vliegNaar(model, doel);
    expect(model.aantal).toBe(2);
    expect(doel.verzameld).toBe(true);
  });

  it('een eerste bolletje is binnen 10 seconden te halen', () => {
    const model = new SpelModel();
    const dt = 1 / 60;
    const doel = model.wereld.losseBolletjes[0];
    let t = 0;
    while (t < 10 && model.aantal < 2) {
      const dx = doel.x - model.speler.x;
      const dy = doel.y - model.speler.y;
      const d = Math.hypot(dx, dy) || 1;
      model.update(dt, { x: dx / d, y: dy / d, boost: false, schiet: false });
      t += dt;
    }
    expect(model.aantal).toBe(2);
    expect(t).toBeLessThan(10);
  });

  it('verslaat een zwakkere rode groep en telt precies op', () => {
    const model = new SpelModel();
    // Los licht even buiten beschouwing: we testen alleen de ontmoeting.
    for (const o of model.wereld.losseBolletjes) o.verzameld = true;
    const groep = model.wereld.vijanden.find((v) => v.kracht === 2)!;
    // Geef de speler genoeg bolletjes om te winnen.
    while (model.aantal < 5) model.speler.bolletjes.push({ ...model.speler.bolletjes[0], omkleuren: 0 });

    const dt = 1 / 60;
    let winst = 0;
    let voor = 0;
    for (let i = 0; i < 60 * 60 && !groep.verslagen && model.stand === 'spelen'; i++) {
      const dx = groep.x - model.speler.x;
      const dy = groep.y - model.speler.y;
      const d = Math.hypot(dx, dy) || 1;
      voor = model.aantal;
      for (const e of model.update(dt, { x: dx / d, y: dy / d, boost: false, schiet: false })) {
        if (e.soort === 'verslagen' && e.groepId === groep.id) winst = e.winst;
      }
    }
    expect(groep.verslagen).toBe(true);
    expect(winst).toBe(2);
    expect(model.aantal).toBe(voor + 2);
    expect(model.stand).toBe('spelen');
  });

  it('een rode groep kan maar één keer verslagen worden', () => {
    const model = new SpelModel();
    // Los licht even buiten beschouwing: we testen alleen de ontmoeting.
    for (const o of model.wereld.losseBolletjes) o.verzameld = true;
    const groep = model.wereld.vijanden.find((v) => v.kracht === 2)!;
    while (model.aantal < 5) model.speler.bolletjes.push({ ...model.speler.bolletjes[0] });
    vliegNaar(model, groep);
    const na = model.aantal;
    stap(model, 3);
    vliegNaar(model, groep);
    expect(model.aantal).toBe(na);
  });

  it('verliest tegen een sterkere groep', () => {
    const model = new SpelModel();
    for (const o of model.wereld.losseBolletjes) o.verzameld = true;
    const groep = model.wereld.vijanden.find((v) => v.kracht === 5)!;
    vliegNaar(model, groep);
    expect(model.stand).toBe('verloren');
    expect(model.verlorenTegen).toBe(5);
  });

  it('kaatst af bij gelijke kracht, zonder winst of verlies', () => {
    const model = new SpelModel();
    // Los licht even buiten beschouwing: we testen alleen de ontmoeting.
    for (const o of model.wereld.losseBolletjes) o.verzameld = true;
    const groep = model.wereld.vijanden.find((v) => v.kracht === 4)!;
    while (model.aantal < 4) model.speler.bolletjes.push({ ...model.speler.bolletjes[0] });
    vliegNaar(model, groep, 40);
    expect(model.stand).toBe('spelen');
    expect(model.aantal).toBe(4);
    expect(groep.verslagen).toBe(false);
    expect(groep.rust).toBeGreaterThan(0);
  });

  it('botst na een gelijkspel niet meteen opnieuw', () => {
    const model = new SpelModel();
    // Los licht even buiten beschouwing: we testen alleen de ontmoeting.
    for (const o of model.wereld.losseBolletjes) o.verzameld = true;
    const groep = model.wereld.vijanden.find((v) => v.kracht === 4)!;
    while (model.aantal < 4) model.speler.bolletjes.push({ ...model.speler.bolletjes[0] });
    vliegNaar(model, groep, 40);
    let gelijkspellen = 0;
    const dt = 1 / 60;
    for (let i = 0; i < 60; i++) {
      for (const e of model.update(dt, { x: 0, y: 0, boost: false, schiet: false })) {
        if (e.soort === 'gelijk') gelijkspellen++;
      }
    }
    expect(gelijkspellen).toBe(0);
  });
});

describe('boost', () => {
  it('maakt je tijdelijk sneller en heeft daarna afkoeltijd', () => {
    const model = new SpelModel();
    const dt = 1 / 60;
    for (let i = 0; i < 120; i++) model.update(dt, { x: 1, y: 0, boost: false, schiet: false });
    const normaal = Math.abs(model.speler.vx);
    expect(normaal).toBeGreaterThan(SPELER.topSnelheid * 0.9);

    model.update(dt, { x: 1, y: 0, boost: true, schiet: false });
    expect(model.isBoostend).toBe(true);
    for (let i = 0; i < 20; i++) model.update(dt, { x: 1, y: 0, boost: false, schiet: false });
    expect(Math.abs(model.speler.vx)).toBeGreaterThan(normaal * 1.15);

    stap(model, SPELER.boostDuur + 0.1, { x: 1, y: 0, boost: false, schiet: false });
    expect(model.isBoostend).toBe(false);
    expect(model.boostKlaar).toBe(false);
    stap(model, SPELER.boostAfkoeling + 0.2, { x: 0, y: 0, boost: false, schiet: false });
    expect(model.boostKlaar).toBe(true);
  });

  it('negeert spatie tijdens afkoeling', () => {
    const model = new SpelModel();
    model.update(1 / 60, { x: 1, y: 0, boost: true, schiet: false });
    stap(model, 1, { x: 1, y: 0, boost: true, schiet: false });
    expect(model.boostLading).toBeLessThan(1);
  });
});

describe('diagonaal bewegen', () => {
  it('gaat niet sneller dan recht vooruit', () => {
    const recht = new SpelModel();
    const schuin = new SpelModel();
    stap(recht, 4, { x: 1, y: 0, boost: false, schiet: false });
    stap(schuin, 4, { x: 1, y: 1, boost: false, schiet: false });
    const vRecht = Math.hypot(recht.speler.vx, recht.speler.vy);
    const vSchuin = Math.hypot(schuin.speler.vx, schuin.speler.vy);
    expect(vSchuin).toBeLessThanOrEqual(vRecht + 0.5);
  });
});

describe('pauzeren', () => {
  it('bevriest posities en aantallen volledig', () => {
    const model = new SpelModel();
    stap(model, 2, { x: 1, y: 0.2, boost: false, schiet: false });
    model.pauzeer();

    const foto = JSON.stringify({
      speler: model.speler,
      vijanden: model.wereld.vijanden,
      baas: model.wereld.baas,
      los: model.wereld.losseBolletjes,
      tijd: model.tijd,
      aantal: model.aantal,
    });

    for (let i = 0; i < 300; i++) {
      expect(model.update(1 / 60, { x: 1, y: 1, boost: true, schiet: false })).toEqual([]);
    }

    expect(
      JSON.stringify({
        speler: model.speler,
        vijanden: model.wereld.vijanden,
        baas: model.wereld.baas,
        los: model.wereld.losseBolletjes,
        tijd: model.tijd,
        aantal: model.aantal,
      }),
    ).toBe(foto);

    model.hervat();
    stap(model, 0.5, { x: 1, y: 0, boost: false, schiet: false });
    expect(model.tijd).toBeGreaterThan(0);
  });

  it('doet ook niets meer na afloop van het spel', () => {
    const model = new SpelModel();
    model.stand = 'verloren';
    const x = model.speler.x;
    stap(model, 2, { x: 1, y: 0, boost: false, schiet: false });
    expect(model.speler.x).toBe(x);
  });
});

describe('de zwerm blijft bij elkaar', () => {
  it('volgt de leider zonder uit elkaar te vallen', () => {
    const model = new SpelModel();
    for (let i = 0; i < 40; i++) {
      model.speler.bolletjes.push({
        ...model.speler.bolletjes[0],
        x: model.speler.x + (i % 7) * 4,
        y: model.speler.y + (i % 5) * 4,
        fase: i,
      });
    }
    stap(model, 6, { x: 1, y: 0.4, boost: false, schiet: false });
    const afstanden = model.speler.bolletjes.map((b) =>
      Math.hypot(b.x - model.speler.midX, b.y - model.speler.midY),
    );
    const maxAfstand = Math.max(...afstanden);
    // Alles blijft binnen ongeveer anderhalve formatiestraal van het midden.
    expect(maxAfstand).toBeLessThan(170);
    expect(afstanden.every((d) => Number.isFinite(d))).toBe(true);
  });

  it('blijft stabiel bij grote tijdstappen', () => {
    const model = new SpelModel();
    for (let i = 0; i < 60; i++) model.speler.bolletjes.push({ ...model.speler.bolletjes[0], fase: i });
    for (let i = 0; i < 100; i++) model.update(0.5, { x: 1, y: 1, boost: true, schiet: false });
    expect(model.speler.bolletjes.every((b) => Number.isFinite(b.x) && Number.isFinite(b.y))).toBe(true);
  });
});

describe('de Lichtkoning buiten de arena', () => {
  it('verslaat de speler met 65 bolletjes: de arena gaat niet open', () => {
    const model = new SpelModel();
    while (model.aantal < 65) model.speler.bolletjes.push({ ...model.speler.bolletjes[0] });
    const b = model.wereld.baas;
    model.speler.x = b.x - 400;
    model.speler.y = b.y;
    for (const bol of model.speler.bolletjes) {
      bol.x = model.speler.x;
      bol.y = model.speler.y;
    }
    vliegNaar(model, b, 30);
    expect(model.arenaActief).toBe(false);
    expect(model.stand).toBe('verloren');
    expect(model.verlorenReden).toBe('baas');
  });

  it('kondigt een stormaanval altijd eerst aan', () => {
    const model = new SpelModel();
    // Even geen gewone vijanden in de weg: we kijken puur naar de koning.
    for (const v of model.wereld.vijanden) v.verslagen = true;
    const b = model.wereld.baas;
    model.speler.x = b.x - 500;
    model.speler.y = b.y;
    const volgorde: string[] = [];
    const dt = 1 / 60;
    for (let i = 0; i < 60 * 12 && model.stand === 'spelen'; i++) {
      for (const e of model.update(dt, { x: 0, y: 0, boost: false, schiet: false })) {
        if (e.soort === 'baas_aankondiging') volgorde.push('aankondiging');
        if (e.soort === 'baas_stormt') volgorde.push('storm');
      }
    }
    expect(volgorde.length).toBeGreaterThan(0);
    expect(volgorde[0]).toBe('aankondiging');
    for (let i = 0; i < volgorde.length; i += 2) {
      expect(volgorde[i]).toBe('aankondiging');
    }
  });
});

// --------------------------------------------------------------------------
// Het eindgevecht in de arena (Gábors tweede tekening).
// --------------------------------------------------------------------------

/** Zet de speler met `aantal` bolletjes vlak buiten de arena neer. */
function bijDeKoning(aantal: number, afstand = 600): SpelModel {
  const model = new SpelModel();
  for (const v of model.wereld.vijanden) v.verslagen = true;
  for (const o of model.wereld.losseBolletjes) o.verzameld = true;
  while (model.aantal < aantal) {
    model.speler.bolletjes.push({ ...model.speler.bolletjes[0], fase: model.aantal });
  }
  const b = model.wereld.baas;
  model.speler.x = b.thuisX - afstand;
  model.speler.y = b.thuisY;
  for (const bol of model.speler.bolletjes) {
    bol.x = model.speler.x;
    bol.y = model.speler.y;
  }
  return model;
}

describe('de arena', () => {
  it('blijft dicht zolang je niet sterk genoeg bent', () => {
    const model = bijDeKoning(40, 700);
    stap(model, 1);
    expect(model.arenaActief).toBe(false);
  });

  it('sluit zich zodra je met 66 bolletjes dichtbij komt', () => {
    const model = bijDeKoning(66, 700);
    const gebeurd: string[] = [];
    const dt = 1 / 60;
    for (let i = 0; i < 60 * 10 && !model.arenaActief; i++) {
      for (const e of model.update(dt, { x: 1, y: 0, boost: false, schiet: false })) {
        gebeurd.push(e.soort);
      }
    }
    expect(model.arenaActief).toBe(true);
    expect(gebeurd).toContain('arena_start');
  });

  it('houdt je binnen de arena', () => {
    const model = bijDeKoning(66, 700);
    stap(model, 2, { x: 1, y: 0, boost: false, schiet: false });
    expect(model.arenaActief).toBe(true);
    // Vol gas de andere kant op: je komt er niet uit.
    stap(model, 12, { x: -1, y: 0, boost: false, schiet: false });
    const b = model.wereld.baas;
    expect(Math.hypot(model.speler.x - b.thuisX, model.speler.y - b.thuisY)).toBeLessThanOrEqual(
      ARENA.straal,
    );
  });

  it('één schot kost één bolletje en haalt één kracht van de koning af', () => {
    const model = bijDeKoning(66, 700);
    stap(model, 2, { x: 1, y: 0, boost: false, schiet: false });
    expect(model.arenaActief).toBe(true);

    const voor = model.aantal;
    const levenVoor = model.wereld.baas.leven;
    expect(levenVoor).toBe(65);

    // Precies één schot afvuren.
    const dt = 1 / 60;
    model.update(dt, { x: 0, y: 0, boost: false, schiet: true });
    expect(model.aantal).toBe(voor - 1);
    expect(model.schoten.length).toBe(1);

    // Het schot stuurt zelf naar de koning toe en komt aan.
    let geraakt = 0;
    for (let i = 0; i < 60 * 4 && geraakt === 0; i++) {
      for (const e of model.update(dt, { x: 0, y: 0, boost: false, schiet: false })) {
        if (e.soort === 'baas_geraakt') geraakt = e.leven;
      }
    }
    expect(geraakt).toBe(levenVoor - 1);
    expect(model.wereld.baas.leven).toBe(64);
  });

  it('respecteert de afkoeltijd tussen schoten', () => {
    const model = bijDeKoning(66, 700);
    stap(model, 2, { x: 1, y: 0, boost: false, schiet: false });
    const voor = model.aantal;
    // Tien frames achter elkaar schieten binnen de afkoeltijd.
    for (let i = 0; i < 6; i++) model.update(1 / 60, { x: 0, y: 0, boost: false, schiet: true });
    expect(model.aantal).toBe(voor - 1);
  });

  it('laat de koning licht vallen dat je weer kunt oppakken', () => {
    const model = bijDeKoning(80, 700);
    stap(model, 2, { x: 1, y: 0, boost: false, schiet: false });
    let gevallen = 0;
    const dt = 1 / 60;
    for (let i = 0; i < 60 * 15 && gevallen < 2; i++) {
      for (const e of model.update(dt, { x: 0, y: 0, boost: false, schiet: true })) {
        if (e.soort === 'licht_gevallen') gevallen++;
      }
    }
    expect(gevallen).toBeGreaterThanOrEqual(2);
    expect(model.wereld.losseBolletjes.some((o) => !o.verzameld)).toBe(true);
  });

  it('onthoudt hoe groot je zwerm ooit was', () => {
    const model = bijDeKoning(90, 700);
    expect(model.piek).toBe(1);
    stap(model, 2, { x: 1, y: 0, boost: false, schiet: false });
    expect(model.piek).toBe(90);
    stap(model, 4, { x: 0, y: 0, boost: false, schiet: true });
    expect(model.aantal).toBeLessThan(90);
    expect(model.piek).toBe(90);
  });

  it('is gewonnen na precies 65 treffers', () => {
    const model = bijDeKoning(97, 700);
    stap(model, 2, { x: 1, y: 0, boost: false, schiet: false });
    let treffers = 0;
    const dt = 1 / 60;
    for (let i = 0; i < 60 * 120 && model.stand === 'spelen'; i++) {
      for (const e of model.update(dt, { x: 0, y: 0, boost: false, schiet: true })) {
        if (e.soort === 'baas_geraakt') treffers++;
      }
    }
    expect(treffers).toBe(65);
    expect(model.stand).toBe('gewonnen');
    expect(model.wereld.baas.leven).toBe(0);
    expect(model.wereld.baas.verslagen).toBe(true);
  });

  it('kost je het gevecht als je licht opraakt', () => {
    const model = bijDeKoning(66, 700);
    stap(model, 2, { x: 1, y: 0, boost: false, schiet: false });
    // Al het gevallen licht negeren: dan kom je gegarandeerd tekort.
    const dt = 1 / 60;
    for (let i = 0; i < 60 * 120 && model.stand === 'spelen'; i++) {
      for (const o of model.wereld.losseBolletjes) o.verzameld = true;
      model.update(dt, { x: 0, y: 0, boost: false, schiet: true });
    }
    expect(model.stand).toBe('verloren');
    expect(model.verlorenReden).toBe('lichtOp');
    expect(model.wereld.baas.leven).toBeGreaterThan(0);
  });

  it('raakt je nooit twee keer vlak achter elkaar (genadetijd)', () => {
    const model = bijDeKoning(70, 700);
    stap(model, 2, { x: 1, y: 0, boost: false, schiet: false });
    const dt = 1 / 60;
    const momenten: number[] = [];
    for (let i = 0; i < 60 * 30 && model.stand === 'spelen'; i++) {
      for (const e of model.update(dt, { x: 0, y: 0, boost: false, schiet: false })) {
        if (e.soort === 'speler_geraakt') momenten.push(model.tijd);
      }
    }
    for (let i = 1; i < momenten.length; i++) {
      expect(momenten[i] - momenten[i - 1]).toBeGreaterThanOrEqual(1);
    }
  });

  it('bevriest ook het gevecht tijdens pauze', () => {
    const model = bijDeKoning(80, 700);
    stap(model, 3, { x: 1, y: 0, boost: false, schiet: true });
    expect(model.arenaActief).toBe(true);
    model.pauzeer();
    const foto = JSON.stringify({
      leven: model.wereld.baas.leven,
      aantal: model.aantal,
      schoten: model.schoten,
      vonken: model.vonken,
    });
    for (let i = 0; i < 200; i++) {
      expect(model.update(1 / 60, { x: 1, y: 1, boost: true, schiet: true })).toEqual([]);
    }
    expect(
      JSON.stringify({
        leven: model.wereld.baas.leven,
        aantal: model.aantal,
        schoten: model.schoten,
        vonken: model.vonken,
      }),
    ).toBe(foto);
  });
});

describe('persoonlijkheid van de vijanden', () => {
  it('een zwakkere groep vlucht voor je weg', () => {
    const model = new SpelModel();
    for (const o of model.wereld.losseBolletjes) o.verzameld = true;
    const groep = model.wereld.vijanden.find((v) => v.kracht === 3)!;
    while (model.aantal < 20) model.speler.bolletjes.push({ ...model.speler.bolletjes[0] });

    // Vlak naast de groep gaan hangen, zonder hem te raken.
    model.speler.x = groep.x - 330;
    model.speler.y = groep.y;
    for (const b of model.speler.bolletjes) {
      b.x = model.speler.x;
      b.y = model.speler.y;
    }
    const voor = Math.hypot(groep.x - model.speler.x, groep.y - model.speler.y);
    stap(model, 2.5);
    const na = Math.hypot(groep.x - model.speler.x, groep.y - model.speler.y);
    expect(na).toBeGreaterThan(voor);
    expect(groep.verslagen).toBe(false);
  });

  it('maar je haalt een vluchtende groep wel in', () => {
    const model = new SpelModel();
    for (const o of model.wereld.losseBolletjes) o.verzameld = true;
    const groep = model.wereld.vijanden.find((v) => v.kracht === 3)!;
    while (model.aantal < 20) model.speler.bolletjes.push({ ...model.speler.bolletjes[0] });
    model.speler.x = groep.x - 330;
    model.speler.y = groep.y;
    for (const b of model.speler.bolletjes) {
      b.x = model.speler.x;
      b.y = model.speler.y;
    }
    vliegNaar(model, groep, 25);
    expect(groep.verslagen).toBe(true);
  });

  it('een sterkere groep komt juist op je af', () => {
    const model = new SpelModel();
    for (const o of model.wereld.losseBolletjes) o.verzameld = true;
    const groep = model.wereld.vijanden.find((v) => v.kracht === 12)!;
    model.speler.x = groep.x - 420;
    model.speler.y = groep.y;
    for (const b of model.speler.bolletjes) {
      b.x = model.speler.x;
      b.y = model.speler.y;
    }
    const voor = Math.hypot(groep.x - model.speler.x, groep.y - model.speler.y);
    for (let i = 0; i < 90 && model.stand === 'spelen'; i++) {
      model.update(1 / 60, { x: 0, y: 0, boost: false, schiet: false });
    }
    const na = Math.hypot(groep.x - model.speler.x, groep.y - model.speler.y);
    expect(na).toBeLessThan(voor);
  });

  it('een sterkere groep remt je af als je er vlak langs vliegt', () => {
    const model = new SpelModel();
    for (const o of model.wereld.losseBolletjes) o.verzameld = true;
    const groep = model.wereld.vijanden.find((v) => v.kracht === 14)!;
    // Vlak naast de groep hangen, net buiten de botsingscirkel.
    model.speler.x = groep.x;
    model.speler.y = groep.y - 150;
    for (const b of model.speler.bolletjes) {
      b.x = model.speler.x;
      b.y = model.speler.y;
    }
    stap(model, 0.5);
    expect(model.stand).toBe('spelen');
    expect(model.speler.geremd).toBeGreaterThan(0.15);

    // Ver weg is er niets aan de hand.
    const vrij = new SpelModel();
    stap(vrij, 2, { x: 1, y: 0, boost: false, schiet: false });
    expect(vrij.speler.geremd).toBeLessThan(0.05);
  });

  it('vluchten en achtervolgen gaat nooit sneller dan de speler', () => {
    expect(VIJAND.vluchtSnelheid).toBeLessThan(SPELER.topSnelheid);
    expect(VIJAND.achtervolgSnelheid).toBeLessThan(SPELER.topSnelheid);
  });
});
