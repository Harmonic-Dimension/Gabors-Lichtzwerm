import { describe, expect, it } from 'vitest';
import { BALANS, MAX_BOLLETJES, NODIG_VOOR_BAAS } from '../src/core/config';
import {
  botsStraal,
  formatieStraal,
  naTreffer,
  nieuweTelling,
  sterkGenoegVoorArena,
  vergelijkGroepen,
} from '../src/core/rules';
import { SpelModel } from '../src/core/SpelModel';

describe('de hoofdregel: de grootste groep wint', () => {
  it('speler begint met 1 bolletje', () => {
    expect(new SpelModel().aantal).toBe(BALANS.startBolletjes);
    expect(BALANS.startBolletjes).toBe(1);
  });

  it('blauw 8 tegen rood 5 wordt 13', () => {
    expect(vergelijkGroepen(8, 5)).toBe('speler_wint');
    expect(nieuweTelling(8, 5)).toBe(13);
  });

  it('blauw 8 tegen rood 12 verliest en telt niet op', () => {
    expect(vergelijkGroepen(8, 12)).toBe('vijand_wint');
    expect(nieuweTelling(8, 12)).toBe(8);
  });

  it('blauw 8 tegen rood 8 is gelijk, zonder verlies', () => {
    expect(vergelijkGroepen(8, 8)).toBe('gelijk');
    expect(nieuweTelling(8, 8)).toBe(8);
  });

  it('gelijke kracht is altijd gelijk, ongeacht de grootte', () => {
    for (const n of [1, 2, 7, 16, 65, 97]) {
      expect(vergelijkGroepen(n, n)).toBe('gelijk');
      expect(nieuweTelling(n, n)).toBe(n);
    }
  });

  it('winnen vereist strikt meer bolletjes', () => {
    expect(vergelijkGroepen(6, 5)).toBe('speler_wint');
    expect(vergelijkGroepen(5, 5)).not.toBe('speler_wint');
  });
});

describe('de Lichtkoning', () => {
  it('heeft kracht 65', () => {
    expect(BALANS.baasKracht).toBe(65);
    expect(NODIG_VOOR_BAAS).toBe(66);
  });

  it('laat je de arena niet in met 65 bolletjes', () => {
    expect(sterkGenoegVoorArena(65)).toBe(false);
  });

  it('laat je de arena wel in met 66 bolletjes', () => {
    expect(sterkGenoegVoorArena(66)).toBe(true);
  });

  it('verliest precies 1 kracht per treffer', () => {
    expect(naTreffer(65)).toBe(64);
    expect(naTreffer(1)).toBe(0);
    expect(naTreffer(0)).toBe(0);
  });

  it('heeft 65 treffers nodig om van 65 naar 0 te gaan', () => {
    let leven: number = BALANS.baasKracht;
    let treffers = 0;
    while (leven > 0) {
      leven = naTreffer(leven);
      treffers++;
    }
    expect(treffers).toBe(65);
  });

  it('wordt niet sterker als de speler groeit', () => {
    const model = new SpelModel();
    const voor = model.wereld.baas.kracht;
    for (let i = 0; i < 50; i++) model.speler.bolletjes.push({ ...model.speler.bolletjes[0] });
    expect(model.wereld.baas.kracht).toBe(voor);
    expect(model.wereld.baas.kracht).toBe(65);
    expect(model.wereld.baas.leven).toBe(65);
  });
});

describe('zwermafmetingen', () => {
  it('groeien mee met het aantal bolletjes', () => {
    expect(formatieStraal(1)).toBeLessThan(formatieStraal(10));
    expect(formatieStraal(10)).toBeLessThan(formatieStraal(66));
  });

  it('de botsingscirkel is kleiner dan de zichtbare wolk', () => {
    for (const n of [1, 5, 20, 66, 97]) {
      expect(botsStraal(n)).toBeLessThan(formatieStraal(n) + 30);
    }
  });
});

describe('totale verdeling', () => {
  it('bevat precies 97 blauwe bolletjes', () => {
    expect(MAX_BOLLETJES).toBe(97);
  });

  it('gebruikt de afgesproken rode groepen', () => {
    expect([...BALANS.rodeGroepen]).toEqual([2, 3, 4, 5, 6, 8, 10, 12, 14, 16]);
  });
});
