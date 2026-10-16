/**
 * Alle instelbare waardes van Lichtzwerm op één plek.
 * Na een paar speelsessies kun je hier de balans bijstellen
 * (bijvoorbeeld de kracht van de Lichtkoning of het aantal bolletjes).
 */

export const BALANS = {
  /** Waarmee de speler begint. */
  startBolletjes: 1,
  /** Losse, verzamelbare blauwe bolletjes in de wereld. */
  losseBlauweBolletjes: 16,
  /** Groottes van de rode vijandelijke groepen. */
  rodeGroepen: [2, 3, 4, 5, 6, 8, 10, 12, 14, 16] as const,
  /** Kracht van de Lichtkoning. Je hebt er minstens één meer nodig. */
  baasKracht: 65,
} as const;

/** Totaal aantal blauwe bolletjes dat in theorie te verzamelen is vóór de baas. */
export const MAX_BOLLETJES =
  BALANS.startBolletjes +
  BALANS.losseBlauweBolletjes +
  BALANS.rodeGroepen.reduce((a, b) => a + b, 0);

/** Hoeveel bolletjes je minimaal nodig hebt voor de Lichtkoning. */
export const NODIG_VOOR_BAAS = BALANS.baasKracht + 1;

export const WERELD = {
  breedte: 10500,
  hoogte: 5400,
  /** Zachte rand: hier remt de speler af in plaats van hard te stoppen. */
  marge: 220,
  start: { x: 950, y: 2700 },
  /** Binnen deze straal rond de start staan geen vijanden. */
  veiligeStraal: 580,
  gebieden: [
    { id: 'start', cx: 1700, cy: 2700, r: 1250, blauw: 6, groepen: [2, 3, 4, 5] },
    { id: 'midden', cx: 5100, cy: 2700, r: 2050, blauw: 6, groepen: [6, 8, 10, 12] },
    { id: 'buiten', cx: 8450, cy: 2700, r: 1620, blauw: 4, groepen: [14, 16] },
  ] as const,
  baas: { x: 9600, y: 2700, nevelStraal: 980 },
} as const;

export const SPELER = {
  topSnelheid: 415,
  /** Hoe snel de snelheid naar de gewenste snelheid toe beweegt. */
  wendbaarheid: 4.6,
  boostSnelheid: 870,
  boostWendbaarheid: 7.0,
  boostDuur: 0.6,
  boostAfkoeling: 5.0,
  /** Extra verzamelbereik bovenop de zwermstraal. */
  verzamelMarge: 36,
  /** Binnen dit extra bereik worden losse bolletjes naar de zwerm toe getrokken. */
  aantrekBereik: 185,
};

export const ZWERM = {
  /** Straal van de formatie bij n bolletjes: basis + groei * sqrt(n-1). */
  basisStraal: 16,
  groei: 10.2,
  /** Botsingscirkel = formatieStraal * factor + extra. */
  botsFactor: 0.8,
  botsExtra: 13,
  /** Veerkracht naar de gewenste plek in de formatie. */
  veer: 30,
  demping: 7.5,
  afstotingAfstand: 17,
  afstotingKracht: 150,
  /** Hoeveel de zwerm achter de leider aan sleept. */
  sleep: 22,
  boostRek: 1.65,
  zweefAmplitude: 7,
};

export const VIJAND = {
  patrouilleSnelheid: 46,
  /** Binnen deze afstand komt een vijandelijke groep langzaam op je af. */
  aggroAfstand: 430,
  achtervolgSnelheid: 160,
  /** Na 'even sterk' botsen de groepen even niet opnieuw. */
  gelijkspelRust: 2.4,
  veer: 22,
  demping: 6.5,
  afstotingAfstand: 16,
  afstotingKracht: 130,
};

export const BAAS = {
  straal: 108,
  zweefSnelheid: 42,
  /** Binnen deze afstand merkt de koning je op. */
  merktAfstand: 760,
  aankondiging: 0.95,
  stormDuur: 0.85,
  stormSnelheid: 540,
  herstel: 1.6,
  /** Hoe ver hij van zijn troon weg mag zweven. */
  roamStraal: 430,
};

/** Standaard-seed; dezelfde seed geeft altijd dezelfde wereld. */
export const STANDAARD_SEED = 20251016;
