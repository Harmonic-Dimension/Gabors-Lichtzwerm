/**
 * Bepalen hoe groot het speelveld mag zijn.
 *
 * Dit is kritischer dan het lijkt: start Phaser met een canvas van 0 bij 0, dan
 * mislukt het aanmaken van de WebGL-framebuffer ("Framebuffer status: Incomplete
 * Attachment") en start het spel helemaal niet meer. Dat gebeurt wanneer het
 * script draait vóórdat de browser de pagina heeft opgemeten — bijvoorbeeld in
 * een achtergrondtabblad, bij een vooraf geladen pagina of vlak na het openen
 * vanuit een andere app.
 *
 * Daarom wachten we liever een paar frames dan dat we een nulmaat accepteren.
 */

/** Kleinste maat die we vertrouwen; alles daaronder betekent "nog geen layout". */
export const MINIMALE_MAAT = 2;

export type Maat = { breedte: number; hoogte: number };

/**
 * Geeft de eerste kandidaat die een echte maat heeft, of `null` als geen van
 * alle bruikbaar is.
 */
export function eersteBruikbareMaat(
  kandidaten: ReadonlyArray<readonly [number, number]>,
  minimaal: number = MINIMALE_MAAT,
): Maat | null {
  for (const [breedte, hoogte] of kandidaten) {
    if (
      Number.isFinite(breedte) &&
      Number.isFinite(hoogte) &&
      breedte >= minimaal &&
      hoogte >= minimaal
    ) {
      return { breedte: Math.round(breedte), hoogte: Math.round(hoogte) };
    }
  }
  return null;
}

/** De maat van het speelveld nu, of `null` zolang de pagina nog niet opgemeten is. */
export function huidigeMaat(houder: HTMLElement | null): Maat | null {
  const rand = houder?.getBoundingClientRect();
  return eersteBruikbareMaat([
    [rand?.width ?? 0, rand?.height ?? 0],
    [window.innerWidth, window.innerHeight],
    [document.documentElement?.clientWidth ?? 0, document.documentElement?.clientHeight ?? 0],
  ]);
}
