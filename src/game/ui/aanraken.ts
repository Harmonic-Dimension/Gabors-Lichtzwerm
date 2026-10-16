/**
 * Herkent of dit apparaat met een vinger bediend wordt.
 *
 * We kijken naar de soort aanwijzer, niet naar het schermformaat: een laptop
 * met aanraakscherm én muis houdt gewoon toetsenbordbesturing, een telefoon
 * krijgt knoppen op het scherm.
 */

let geforceerd: boolean | null = null;
let aanraakGezien = false;

try {
  const vraag = new URLSearchParams(window.location.search).get('touch');
  if (vraag === '1' || vraag === 'aan') geforceerd = true;
  if (vraag === '0' || vraag === 'uit') geforceerd = false;
} catch {
  geforceerd = null;
}

// Zodra er écht met een vinger getikt wordt, weten we het zeker.
if (typeof window !== 'undefined') {
  window.addEventListener(
    'touchstart',
    () => {
      aanraakGezien = true;
    },
    { once: true, passive: true },
  );
}

function past(vraag: string): boolean {
  try {
    return window.matchMedia(vraag).matches;
  } catch {
    return false;
  }
}

/** Heeft deze speler knoppen op het scherm nodig? */
export function gebruiktAanraking(): boolean {
  if (geforceerd !== null) return geforceerd;
  if (aanraakGezien) return true;
  const grof = past('(any-pointer: coarse)');
  const fijn = past('(any-pointer: fine)');
  return grof && !fijn;
}

/** Staat de telefoon rechtop? Dan is het speelveld een stuk smaller. */
export function isStaand(): boolean {
  return window.innerHeight > window.innerWidth;
}
