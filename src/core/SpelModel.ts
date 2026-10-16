/**
 * De volledige spelsimulatie van Lichtzwerm — zonder Phaser.
 *
 * GameScene tekent alleen wat hier staat en luistert naar `gebeurtenissen`.
 * Daardoor zijn alle spelregels (verzamelen, verslaan, gelijkspel, eindbaas,
 * pauzeren) los te testen zonder browser.
 */

import { BAAS, SPELER, VIJAND, WERELD, ZWERM, NODIG_VOOR_BAAS, STANDAARD_SEED } from './config';
import { stuurZwerm, type FormatieAnker, type ZwermInstellingen } from './flock';
import { TAU, clamp, damp, makeRng } from './mathx';
import { botsStraal, formatieStraal, vergelijkGroepen, verslaatBaas } from './rules';
import type { Bolletje, Gebeurtenis, Invoer, SpelStand } from './types';
import { maakWereld, type Wereld } from './world';

const ZWERM_INST: ZwermInstellingen = {
  veer: ZWERM.veer,
  demping: ZWERM.demping,
  afstotingAfstand: ZWERM.afstotingAfstand,
  afstotingKracht: ZWERM.afstotingKracht,
  zweefAmplitude: ZWERM.zweefAmplitude,
};

const VIJAND_INST: ZwermInstellingen = {
  veer: VIJAND.veer,
  demping: VIJAND.demping,
  afstotingAfstand: VIJAND.afstotingAfstand,
  afstotingKracht: VIJAND.afstotingKracht,
  zweefAmplitude: ZWERM.zweefAmplitude * 1.35,
};

export interface Speler {
  x: number;
  y: number;
  vx: number;
  vy: number;
  bolletjes: Bolletje[];
  boostTimer: number;
  afkoeling: number;
  /** Gemiddelde van de wolk — hier zit de botsingscirkel omheen. */
  midX: number;
  midY: number;
  raaktGrens: number;
}

export class SpelModel {
  readonly wereld: Wereld;
  readonly speler: Speler;
  tijd = 0;
  stand: SpelStand = 'spelen';
  gepauzeerd = false;
  sterkGenoegGemeld = false;
  verlorenTegen = 0;
  verlorenDoorBaas = false;

  private rng: () => number;
  private gebeurtenissen: Gebeurtenis[] = [];
  private stormX = 0;
  private stormY = 0;

  constructor(seed: number = STANDAARD_SEED) {
    this.rng = makeRng(seed ^ 0x9e3779b9);
    this.wereld = maakWereld(seed);
    this.speler = {
      x: WERELD.start.x,
      y: WERELD.start.y,
      vx: 0,
      vy: 0,
      bolletjes: [this.nieuwBolletje(WERELD.start.x, WERELD.start.y)],
      boostTimer: 0,
      afkoeling: 0,
      midX: WERELD.start.x,
      midY: WERELD.start.y,
      raaktGrens: 0,
    };
  }

  // ---------------------------------------------------------------- helpers

  private nieuwBolletje(x: number, y: number, omkleuren = 0): Bolletje {
    return {
      x,
      y,
      vx: 0,
      vy: 0,
      fase: this.rng() * TAU,
      maat: 0.84 + this.rng() * 0.4,
      glans: 0.78 + this.rng() * 0.22,
      omkleuren,
    };
  }

  /** Aantal blauwe bolletjes — hét getal van het spel. */
  get aantal(): number {
    return this.speler.bolletjes.length;
  }

  get spelerStraal(): number {
    return botsStraal(this.aantal);
  }

  get boostKlaar(): boolean {
    return this.speler.afkoeling <= 0 && this.speler.boostTimer <= 0;
  }

  /** 0 = net gebruikt, 1 = weer klaar. */
  get boostLading(): number {
    if (this.speler.boostTimer > 0) return 0;
    if (this.speler.afkoeling <= 0) return 1;
    return 1 - this.speler.afkoeling / SPELER.boostAfkoeling;
  }

  get isBoostend(): boolean {
    return this.speler.boostTimer > 0;
  }

  get sterkGenoegVoorBaas(): boolean {
    return this.aantal >= NODIG_VOOR_BAAS;
  }

  pauzeer(): void {
    this.gepauzeerd = true;
  }

  hervat(): void {
    this.gepauzeerd = false;
  }

  // ------------------------------------------------------------ hoofdupdate

  /** Eén simulatiestap. Geeft terug wat er in deze stap gebeurd is. */
  update(dtRuw: number, invoer: Invoer): Gebeurtenis[] {
    this.gebeurtenissen = [];
    if (this.gepauzeerd || this.stand !== 'spelen') return this.gebeurtenissen;

    // Grote tijdsprongen (tabblad op de achtergrond) mogen de physics niet slopen.
    const dt = clamp(dtRuw, 0, 1 / 30);
    this.tijd += dt;

    this.updateSpeler(dt, invoer);
    this.updateVijanden(dt);
    this.updateBaas(dt);
    this.checkBotsingen(dt);

    if (!this.sterkGenoegGemeld && this.sterkGenoegVoorBaas) {
      this.sterkGenoegGemeld = true;
      this.gebeurtenissen.push({ soort: 'sterk_genoeg' });
    }
    return this.gebeurtenissen;
  }

  /**
   * Alleen de speler en zijn zwerm bijwerken, zonder botsingen of vijanden.
   * Wordt gebruikt voor het overwinningsrondje ná afloop van het spel.
   */
  naspelUpdate(dtRuw: number, invoer: Invoer): void {
    const dt = clamp(dtRuw, 0, 1 / 30);
    this.tijd += dt;
    this.gebeurtenissen = [];
    this.updateSpeler(dt, invoer);
  }

  // ---------------------------------------------------------------- speler

  private updateSpeler(dt: number, invoer: Invoer): void {
    const s = this.speler;

    s.boostTimer = Math.max(0, s.boostTimer - dt);
    if (s.boostTimer <= 0) s.afkoeling = Math.max(0, s.afkoeling - dt);

    if (invoer.boost && this.boostKlaar) {
      s.boostTimer = SPELER.boostDuur;
      s.afkoeling = SPELER.boostAfkoeling;
      this.gebeurtenissen.push({ soort: 'boost', x: s.x, y: s.y });
    }

    // Diagonaal mag niet sneller zijn dan recht vooruit.
    let ix = clamp(invoer.x, -1, 1);
    let iy = clamp(invoer.y, -1, 1);
    const len = Math.hypot(ix, iy);
    if (len > 1) {
      ix /= len;
      iy /= len;
    }

    const boost = s.boostTimer > 0;
    const top = boost ? SPELER.boostSnelheid : SPELER.topSnelheid;
    const wend = boost ? SPELER.boostWendbaarheid : SPELER.wendbaarheid;
    const f = 1 - damp(wend, dt);
    s.vx += (ix * top - s.vx) * f;
    s.vy += (iy * top - s.vy) * f;

    s.x += s.vx * dt;
    s.y += s.vy * dt;

    // Zachte grens: afremmen en terugduwen, niet hard stoppen.
    const m = WERELD.marge;
    let grens = 0;
    if (s.x < m) {
      const d = (m - s.x) / m;
      s.vx += d * 1400 * dt;
      grens = Math.max(grens, d);
    } else if (s.x > WERELD.breedte - m) {
      const d = (s.x - (WERELD.breedte - m)) / m;
      s.vx -= d * 1400 * dt;
      grens = Math.max(grens, d);
    }
    if (s.y < m) {
      const d = (m - s.y) / m;
      s.vy += d * 1400 * dt;
      grens = Math.max(grens, d);
    } else if (s.y > WERELD.hoogte - m) {
      const d = (s.y - (WERELD.hoogte - m)) / m;
      s.vy -= d * 1400 * dt;
      grens = Math.max(grens, d);
    }
    s.x = clamp(s.x, 24, WERELD.breedte - 24);
    s.y = clamp(s.y, 24, WERELD.hoogte - 24);
    s.raaktGrens = clamp(grens, 0, 1);

    // De leider staat altijd exact op de spelerpositie.
    const leider = s.bolletjes[0];
    leider.x = s.x;
    leider.y = s.y;
    leider.vx = s.vx;
    leider.vy = s.vy;

    const snelheid = Math.hypot(s.vx, s.vy);
    const straal = formatieStraal(this.aantal);
    const rek = 1 + (snelheid / SPELER.topSnelheid) * 0.25 + (boost ? ZWERM.boostRek - 1 : 0);
    const anker: FormatieAnker = {
      x: s.x,
      y: s.y,
      richtingX: s.vx,
      richtingY: s.vy,
      straal,
      rek,
      sleep: ZWERM.sleep * (0.35 + (snelheid / SPELER.topSnelheid) * 0.9) + (boost ? 26 : 0),
    };
    stuurZwerm(s.bolletjes, 1, anker, ZWERM_INST, this.tijd, dt);

    // Middelpunt van de wolk, iets naar de leider toe getrokken.
    let sx = 0;
    let sy = 0;
    for (const b of s.bolletjes) {
      sx += b.x;
      sy += b.y;
    }
    const cx = sx / s.bolletjes.length;
    const cy = sy / s.bolletjes.length;
    s.midX = cx + (s.x - cx) * 0.35;
    s.midY = cy + (s.y - cy) * 0.35;
  }

  // --------------------------------------------------------------- vijanden

  private updateVijanden(dt: number): void {
    const s = this.speler;
    for (const v of this.wereld.vijanden) {
      if (v.verslagen) continue;
      if (v.rust > 0) v.rust -= dt;

      const gebied = WERELD.gebieden.find((g) => g.id === v.gebied)!;
      const dSpeler = Math.hypot(s.midX - v.x, s.midY - v.y);
      const dichtbij = dSpeler < VIJAND.aggroAfstand;
      v.alert += ((dichtbij ? 1 : 0) - v.alert) * (1 - damp(2.5, dt));

      v.patrouilleFase += v.patrouilleSnelheid * dt;
      let doelX = v.thuisX + Math.cos(v.patrouilleFase) * v.patrouilleStraal;
      let doelY = v.thuisY + Math.sin(v.patrouilleFase * 0.83) * v.patrouilleStraal;

      // Stevigere groepen komen langzaam op je af als je dichtbij komt —
      // nooit vanaf de andere kant van de wereld.
      let snelheid = VIJAND.patrouilleSnelheid;
      if (dichtbij && v.kracht >= 6 && v.rust <= 0) {
        doelX = s.midX;
        doelY = s.midY;
        snelheid = VIJAND.achtervolgSnelheid;
      }

      const dx = doelX - v.x;
      const dy = doelY - v.y;
      const dl = Math.hypot(dx, dy) || 1;
      const wensX = (dx / dl) * snelheid * Math.min(1, dl / 60);
      const wensY = (dy / dl) * snelheid * Math.min(1, dl / 60);
      const f = 1 - damp(1.9, dt);
      v.vx += (wensX - v.vx) * f;
      v.vy += (wensY - v.vy) * f;
      v.x += v.vx * dt;
      v.y += v.vy * dt;

      // Een groep blijft binnen zijn eigen gebied — sterke vijanden dwalen
      // dus niet zomaar het veilige startgebied in.
      const gx = v.x - gebied.cx;
      const gy = v.y - gebied.cy;
      const gd = Math.hypot(gx, gy);
      const maxR = gebied.r + 90;
      if (gd > maxR) {
        v.x = gebied.cx + (gx / gd) * maxR;
        v.y = gebied.cy + (gy / gd) * maxR;
        v.vx *= 0.4;
        v.vy *= 0.4;
      }

      const anker: FormatieAnker = {
        x: v.x,
        y: v.y,
        richtingX: v.vx,
        richtingY: v.vy,
        straal: formatieStraal(v.kracht),
        rek: 1 + v.alert * 0.2,
        sleep: 6,
      };
      stuurZwerm(v.bolletjes, 0, anker, VIJAND_INST, this.tijd + v.id * 3.1, dt);
    }
  }

  // ------------------------------------------------------------------- baas

  private updateBaas(dt: number): void {
    const b = this.wereld.baas;
    if (b.verslagen) return;
    const s = this.speler;
    const dSpeler = Math.hypot(s.midX - b.x, s.midY - b.y);
    const merktSpeler = dSpeler < BAAS.merktAfstand;

    if (merktSpeler && !b.gezien) {
      b.gezien = true;
      this.gebeurtenissen.push({ soort: 'baas_gezien' });
    }

    b.timer += dt;
    b.dwaalFase += dt * 0.37;

    let wensX = 0;
    let wensY = 0;

    switch (b.stand) {
      case 'zweven': {
        const doelX = b.thuisX + Math.cos(b.dwaalFase) * BAAS.roamStraal * 0.55;
        const doelY = b.thuisY + Math.sin(b.dwaalFase * 1.3) * BAAS.roamStraal * 0.42;
        const dx = doelX - b.x;
        const dy = doelY - b.y;
        const dl = Math.hypot(dx, dy) || 1;
        wensX = (dx / dl) * BAAS.zweefSnelheid;
        wensY = (dy / dl) * BAAS.zweefSnelheid;
        if (merktSpeler && b.timer > 2.6) {
          b.stand = 'aankondigen';
          b.timer = 0;
          this.gebeurtenissen.push({ soort: 'baas_aankondiging', x: b.x, y: b.y });
        }
        break;
      }
      case 'aankondigen': {
        // Even stilhangen en oplichten: de speler krijgt tijd om weg te duiken.
        wensX = 0;
        wensY = 0;
        if (b.timer >= BAAS.aankondiging) {
          const dx = s.midX - b.x;
          const dy = s.midY - b.y;
          const dl = Math.hypot(dx, dy) || 1;
          this.stormX = dx / dl;
          this.stormY = dy / dl;
          b.stand = 'stormen';
          b.timer = 0;
          this.gebeurtenissen.push({ soort: 'baas_stormt', x: b.x, y: b.y });
        }
        break;
      }
      case 'stormen': {
        wensX = this.stormX * BAAS.stormSnelheid;
        wensY = this.stormY * BAAS.stormSnelheid;
        if (b.timer >= BAAS.stormDuur) {
          b.stand = 'herstellen';
          b.timer = 0;
        }
        break;
      }
      case 'herstellen': {
        const dx = b.thuisX - b.x;
        const dy = b.thuisY - b.y;
        const dl = Math.hypot(dx, dy) || 1;
        wensX = (dx / dl) * BAAS.zweefSnelheid * 0.7;
        wensY = (dy / dl) * BAAS.zweefSnelheid * 0.7;
        if (b.timer >= BAAS.herstel) {
          b.stand = 'zweven';
          b.timer = 0;
        }
        break;
      }
      default:
        break;
    }

    const f = 1 - damp(b.stand === 'stormen' ? 6 : 1.6, dt);
    b.vx += (wensX - b.vx) * f;
    b.vy += (wensY - b.vy) * f;
    b.x += b.vx * dt;
    b.y += b.vy * dt;

    // Hij blijft in de buurt van zijn troon.
    const hx = b.x - b.thuisX;
    const hy = b.y - b.thuisY;
    const hd = Math.hypot(hx, hy);
    if (hd > BAAS.roamStraal) {
      b.x = b.thuisX + (hx / hd) * BAAS.roamStraal;
      b.y = b.thuisY + (hy / hd) * BAAS.roamStraal;
      b.vx *= 0.3;
      b.vy *= 0.3;
    }
    b.x = clamp(b.x, 120, WERELD.breedte - 120);
    b.y = clamp(b.y, 120, WERELD.hoogte - 120);

    // Hij kijkt de speler aan zodra die in de buurt is.
    const doelHoek = merktSpeler
      ? Math.atan2(s.midY - b.y, s.midX - b.x)
      : Math.atan2(b.vy, b.vx);
    let verschil = doelHoek - b.kijkhoek;
    while (verschil > Math.PI) verschil -= TAU;
    while (verschil < -Math.PI) verschil += TAU;
    b.kijkhoek += verschil * (1 - damp(3.2, dt));
  }

  // -------------------------------------------------------------- botsingen

  private checkBotsingen(dt: number): void {
    const s = this.speler;
    // Losse blauwe bolletjes: eerst aantrekken, dan oppakken.
    const pakStraal = formatieStraal(this.aantal) * 0.85 + SPELER.verzamelMarge;
    const trekStraal = pakStraal + SPELER.aantrekBereik;
    for (const los of this.wereld.losseBolletjes) {
      if (los.verzameld) continue;
      const dL = Math.hypot(s.midX - los.x, s.midY - los.y);
      if (dL > trekStraal) continue;
      if (dL > pakStraal) {
        // Zachte aantrekkingskracht: hoe dichterbij, hoe sterker.
        const k = 1 - (dL - pakStraal) / SPELER.aantrekBereik;
        const f = Math.min(1, k * k * 4.5 * dt);
        los.x += (s.midX - los.x) * f;
        los.y += (s.midY - los.y) * f;
        continue;
      }
      los.verzameld = true;
      s.bolletjes.push(this.nieuwBolletje(los.x, los.y, 0.22));
      this.gebeurtenissen.push({ soort: 'verzameld', x: los.x, y: los.y, totaal: this.aantal });
    }

    // Vijandelijke groepen.
    for (const v of this.wereld.vijanden) {
      if (v.verslagen || v.rust > 0) continue;
      const rB = botsStraal(v.kracht);
      const dx = v.x - s.midX;
      const dy = v.y - s.midY;
      const d = Math.hypot(dx, dy);
      if (d > this.spelerStraal + rB) continue;

      const uitslag = vergelijkGroepen(this.aantal, v.kracht);
      if (uitslag === 'speler_wint') {
        v.verslagen = true;
        const winst = v.kracht;
        for (const rb of v.bolletjes) {
          const nieuw = this.nieuwBolletje(rb.x, rb.y, 0.55);
          nieuw.vx = rb.vx * 0.4;
          nieuw.vy = rb.vy * 0.4;
          s.bolletjes.push(nieuw);
        }
        this.gebeurtenissen.push({
          soort: 'verslagen',
          x: v.x,
          y: v.y,
          winst,
          totaal: this.aantal,
          groepId: v.id,
        });
      } else if (uitslag === 'vijand_wint') {
        this.stand = 'verloren';
        this.verlorenTegen = v.kracht;
        this.verlorenDoorBaas = false;
        this.gebeurtenissen.push({
          soort: 'verloren',
          x: v.x,
          y: v.y,
          kracht: v.kracht,
          doorBaas: false,
        });
        return;
      } else {
        // Even sterk: zacht uit elkaar kaatsen en even niet opnieuw botsen.
        const nx = d > 0.001 ? dx / d : 1;
        const ny = d > 0.001 ? dy / d : 0;
        const overlap = this.spelerStraal + rB - d + 6;
        s.x -= nx * overlap * 0.6;
        s.y -= ny * overlap * 0.6;
        s.vx -= nx * 300;
        s.vy -= ny * 300;
        v.x += nx * overlap * 0.4;
        v.y += ny * overlap * 0.4;
        v.vx += nx * 160;
        v.vy += ny * 160;
        v.rust = VIJAND.gelijkspelRust;
        this.gebeurtenissen.push({ soort: 'gelijk', x: v.x, y: v.y, kracht: v.kracht });
      }
    }

    // De Lichtkoning.
    const b = this.wereld.baas;
    if (!b.verslagen) {
      const d = Math.hypot(b.x - s.midX, b.y - s.midY);
      if (d < this.spelerStraal + BAAS.straal) {
        if (verslaatBaas(this.aantal, b.kracht)) {
          b.verslagen = true;
          b.stand = 'verslagen';
          this.stand = 'gewonnen';
          this.gebeurtenissen.push({ soort: 'baas_verslagen', x: b.x, y: b.y });
        } else {
          this.stand = 'verloren';
          this.verlorenTegen = b.kracht;
          this.verlorenDoorBaas = true;
          this.gebeurtenissen.push({
            soort: 'verloren',
            x: b.x,
            y: b.y,
            kracht: b.kracht,
            doorBaas: true,
          });
        }
      }
    }
  }
}
