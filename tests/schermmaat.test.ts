/**
 * Het spel mag nooit starten met een canvas van 0 bij 0: dan mislukt de
 * WebGL-framebuffer en start het spel helemaal niet meer.
 */
import { describe, expect, it } from 'vitest';
import { eersteBruikbareMaat, MINIMALE_MAAT } from '../src/game/schermmaat';

describe('schermmaat kiezen', () => {
  it('neemt de eerste kandidaat met een echte maat', () => {
    expect(eersteBruikbareMaat([[1280, 800]])).toEqual({ breedte: 1280, hoogte: 800 });
  });

  it('slaat een nulmaat over en pakt de volgende', () => {
    expect(
      eersteBruikbareMaat([
        [0, 0],
        [390, 844],
      ]),
    ).toEqual({ breedte: 390, hoogte: 844 });
  });

  it('slaat ook een half lege maat over', () => {
    expect(
      eersteBruikbareMaat([
        [1024, 0],
        [0, 768],
        [800, 600],
      ]),
    ).toEqual({ breedte: 800, hoogte: 600 });
  });

  it('geeft null als de pagina nog nergens een maat heeft', () => {
    expect(
      eersteBruikbareMaat([
        [0, 0],
        [0, 0],
      ]),
    ).toBeNull();
    expect(eersteBruikbareMaat([])).toBeNull();
  });

  it('vertrouwt een piepklein scherm niet', () => {
    expect(eersteBruikbareMaat([[1, 1]])).toBeNull();
    expect(eersteBruikbareMaat([[MINIMALE_MAAT, MINIMALE_MAAT]])).not.toBeNull();
  });

  it('negeert rommel zoals NaN en oneindig', () => {
    expect(
      eersteBruikbareMaat([
        [Number.NaN, 800],
        [Number.POSITIVE_INFINITY, 800],
        [640, 480],
      ]),
    ).toEqual({ breedte: 640, hoogte: 480 });
  });

  it('rondt af op hele pixels', () => {
    expect(eersteBruikbareMaat([[1279.6, 799.4]])).toEqual({ breedte: 1280, hoogte: 799 });
  });
});
