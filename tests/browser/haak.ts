/** Vorm van `window.__lichtzwerm`, de testhaak van het spel. */
export interface Haak {
  model: {
    aantal: number;
    piek: number;
    stand: 'spelen' | 'gewonnen' | 'verloren';
    gepauzeerd: boolean;
    tijd: number;
    boostKlaar: boolean;
    boostLading: number;
    isBoostend: boolean;
    verlorenTegen: number;
    verlorenReden: 'groep' | 'baas' | 'lichtOp';
    arenaActief: boolean;
    baasLeven: number;
    speler: { x: number; y: number; midX: number; midY: number; vx: number; vy: number };
    wereld: {
      baas: {
        x: number;
        y: number;
        thuisX: number;
        thuisY: number;
        kracht: number;
        leven: number;
        verslagen: boolean;
      };
      vijanden: Array<{ x: number; y: number; kracht: number; verslagen: boolean; rust: number }>;
      losseBolletjes: Array<{ x: number; y: number; verzameld: boolean }>;
    };
  };
  scene: {
    aanraak?: {
      lees: () => { x: number; y: number; boost: boolean; schiet: boolean };
      hoofdknop: { container: { x: number; y: number }; label: { text: string } };
      boostknop: { container: { x: number; y: number; visible: boolean } };
    };
  };
  zetAantal: (n: number) => void;
  teleport: (x: number, y: number) => void;
}
