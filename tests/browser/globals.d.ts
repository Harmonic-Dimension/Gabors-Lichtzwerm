/** Testhaken die het spel op `window` zet, gedeeld door alle browsertests. */
import type { Haak } from './haak';

declare global {
  interface Window {
    __spel: {
      canvas: HTMLCanvasElement;
      renderer: { type: number };
      scene: {
        getScene: (k: string) => unknown;
        isActive: (k: string) => boolean;
      };
    };
    __lichtzwerm: Haak;
  }
}

export {};
