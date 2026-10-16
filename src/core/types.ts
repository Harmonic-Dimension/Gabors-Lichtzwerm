/** Gedeelde datatypes van de simulatie. */

export interface Bolletje {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Eigen fase voor de zweefbeweging, zodat niet alles synchroon pulseert. */
  fase: number;
  /** Subtiele variatie in grootte (0.8 – 1.25). */
  maat: number;
  /** Subtiele variatie in helderheid (0.75 – 1). */
  glans: number;
  /** > 0 wanneer dit bolletje net van rood naar blauw verandert. */
  omkleuren: number;
}

export type GebiedId = 'start' | 'midden' | 'buiten';

export interface LosBolletje {
  id: number;
  x: number;
  y: number;
  fase: number;
  gebied: GebiedId;
  verzameld: boolean;
}

export interface VijandGroep {
  id: number;
  kracht: number;
  gebied: GebiedId;
  /** Middelpunt van de groep. */
  x: number;
  y: number;
  vx: number;
  vy: number;
  thuisX: number;
  thuisY: number;
  patrouilleStraal: number;
  patrouilleFase: number;
  patrouilleSnelheid: number;
  bolletjes: Bolletje[];
  verslagen: boolean;
  /** Rusttijd na een gelijkspel, zodat je niet meteen opnieuw botst. */
  rust: number;
  /** Zichtbare 'opwinding' wanneer de speler dichtbij is (0–1). */
  alert: number;
}

export interface Nevel {
  x: number;
  y: number;
  r: number;
  tint: number;
  alpha: number;
}

export type BaasStand = 'zweven' | 'aankondigen' | 'stormen' | 'herstellen' | 'verslagen';

export interface Baas {
  x: number;
  y: number;
  vx: number;
  vy: number;
  thuisX: number;
  thuisY: number;
  kracht: number;
  stand: BaasStand;
  timer: number;
  /** Richting waarin hij kijkt, in radialen. */
  kijkhoek: number;
  dwaalFase: number;
  verslagen: boolean;
  gezien: boolean;
}

export type Gebeurtenis =
  | { soort: 'verzameld'; x: number; y: number; totaal: number }
  | { soort: 'verslagen'; x: number; y: number; winst: number; totaal: number; groepId: number }
  | { soort: 'gelijk'; x: number; y: number; kracht: number }
  | { soort: 'verloren'; x: number; y: number; kracht: number; doorBaas: boolean }
  | { soort: 'baas_gezien' }
  | { soort: 'baas_aankondiging'; x: number; y: number }
  | { soort: 'baas_stormt'; x: number; y: number }
  | { soort: 'baas_verslagen'; x: number; y: number }
  | { soort: 'sterk_genoeg' }
  | { soort: 'boost'; x: number; y: number }
  | { soort: 'grens' };

export interface Invoer {
  x: number;
  y: number;
  boost: boolean;
}

export type SpelStand = 'spelen' | 'gewonnen' | 'verloren';
