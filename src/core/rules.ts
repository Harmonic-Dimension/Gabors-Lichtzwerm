/**
 * De spelregels van Lichtzwerm, helemaal los van tekenwerk en animatie.
 * Dit bestand bevat geen enkele afhankelijkheid, zodat het triviaal te testen is.
 *
 * Hoofdregel: de grootste groep wint.
 */

import { BALANS, ZWERM } from './config';

export type Uitslag = 'speler_wint' | 'vijand_wint' | 'gelijk';

/** Vergelijk twee groepen. Strikt groter is nodig om te winnen. */
export function vergelijkGroepen(blauw: number, rood: number): Uitslag {
  if (blauw > rood) return 'speler_wint';
  if (blauw < rood) return 'vijand_wint';
  return 'gelijk';
}

/** Hoeveel bolletjes de speler heeft ná een ontmoeting. */
export function nieuweTelling(blauw: number, rood: number): number {
  return vergelijkGroepen(blauw, rood) === 'speler_wint' ? blauw + rood : blauw;
}

/** Kan deze zwerm de Lichtkoning verslaan? */
export function verslaatBaas(blauw: number, baasKracht: number = BALANS.baasKracht): boolean {
  return blauw > baasKracht;
}

/** Straal van de zichtbare formatie bij n bolletjes. */
export function formatieStraal(n: number): number {
  return ZWERM.basisStraal + ZWERM.groei * Math.sqrt(Math.max(0, n - 1));
}

/**
 * Straal van de botsingscirkel. Bewust iets kleiner dan de formatie,
 * zodat je nooit verliest door één bolletje dat ver achterop raakt.
 */
export function botsStraal(n: number): number {
  return formatieStraal(n) * ZWERM.botsFactor + ZWERM.botsExtra;
}
