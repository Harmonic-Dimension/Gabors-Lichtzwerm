/**
 * De hoofdscene: hier wordt de simulatie uit `core` zichtbaar gemaakt.
 * Alle spelregels staan in SpelModel — deze scene tekent en animeert alleen,
 * en reageert op de gebeurtenissen die het model teruggeeft.
 */
import Phaser from 'phaser';
import { maakTexturen } from '../textures';
import { SpelModel } from '../../core/SpelModel';
import { BAAS, NODIG_VOOR_BAAS, SPELER, WERELD } from '../../core/config';
import { botsStraal, formatieStraal } from '../../core/rules';
import type { Gebeurtenis, Invoer } from '../../core/types';
import { KLEUR, TEX } from '../textures';
import { Achtergrond } from '../render/Achtergrond';
import { BolPool, mengKleur, type BolStijl } from '../render/Bolletjes';
import { Lichtkoning } from '../entities/Lichtkoning';
import { HUD } from '../ui/HUD';
import { geluid } from '../audio';
import { maakKnop } from '../ui/knop';

const LETTER = 'Trebuchet MS, Segoe UI, sans-serif';

const BLAUW: BolStijl = {
  gloedKleur: KLEUR.blauwGloed,
  kernKleur: 0xffffff,
  gloedMaat: 112,
  kernMaat: 11,
  gloedAlpha: 0.5,
};
const LEIDER: BolStijl = {
  gloedKleur: KLEUR.leiderGloed,
  kernKleur: 0xffffff,
  gloedMaat: 176,
  kernMaat: 17,
  gloedAlpha: 0.66,
};
const ROOD: BolStijl = {
  gloedKleur: KLEUR.roodGloed,
  kernKleur: 0xffe3d2,
  gloedMaat: 116,
  kernMaat: 11,
  gloedAlpha: 0.5,
};
const LOS: BolStijl = {
  gloedKleur: 0x6fe0ff,
  kernKleur: 0xffffff,
  gloedMaat: 138,
  kernMaat: 14,
  gloedAlpha: 0.58,
};

interface VijandWeergave {
  ring: Phaser.GameObjects.Image;
  label: Phaser.GameObjects.Text;
  /** Zachte wolk onder de groep, zodat hij als één lichtwolk leest. */
  wolk: Phaser.GameObjects.Image;
}

export class SpelScene extends Phaser.Scene {
  private model!: SpelModel;
  private achtergrond!: Achtergrond;
  private spelerPool!: BolPool;
  private vijandPool!: BolPool;
  private losPool!: BolPool;
  private sporen!: Phaser.GameObjects.Graphics;
  private koning!: Lichtkoning;
  private hud!: HUD;
  private volgPunt!: Phaser.GameObjects.Zone;
  private vijandWeergave: VijandWeergave[] = [];
  private pauzeLaag!: Phaser.GameObjects.Container;
  private troonGloed!: Phaser.GameObjects.Image;
  private spelerWolk!: Phaser.GameObjects.Image;
  /** Aparte camera voor de interface, zodat de zoom van de wereld die niet meeschaalt. */
  private uiCam!: Phaser.Cameras.Scene2D.Camera;

  private toetsen!: {
    op: Phaser.Input.Keyboard.Key;
    neer: Phaser.Input.Keyboard.Key;
    links: Phaser.Input.Keyboard.Key;
    rechts: Phaser.Input.Keyboard.Key;
    w: Phaser.Input.Keyboard.Key;
    a: Phaser.Input.Keyboard.Key;
    s: Phaser.Input.Keyboard.Key;
    d: Phaser.Input.Keyboard.Key;
    spatie: Phaser.Input.Keyboard.Key;
  };

  private afgelopen = false;
  private feestTimer = 0;
  private kroon?: Phaser.GameObjects.Container;
  private startTijd = 0;
  private gevaarWaarschuwing = 0;
  /** Latch voor de boost, zodat één korte tik op spatie altijd telt. */
  private boostGevraagd = false;
  /** Tijdstempel van de laatst verwerkte aanslag per toets (dubbele events eruit). */
  private laatsteToets: Record<string, number> = {};

  constructor() {
    super('Spel');
  }

  preload(): void {
    maakTexturen(this);
  }

  create(data?: { seed?: number }): void {
    this.afgelopen = false;
    this.feestTimer = 0;
    this.kroon = undefined;
    this.vijandWeergave = [];
    this.gevaarWaarschuwing = 0;
    this.boostGevraagd = false;
    this.laatsteToets = {};

    this.model = new SpelModel(data?.seed);
    const w = this.model.wereld;

    this.uiCam = this.cameras.add(0, 0, this.scale.width, this.scale.height);
    this.uiCam.setName('ui');
    this.cameras.main.setBounds(0, 0, w.breedte, w.hoogte);
    this.cameras.main.setBackgroundColor('#03061a');
    this.achtergrond = new Achtergrond(this, w.nevels, w.breedte, w.hoogte);
    for (const o of this.achtergrond.objecten()) this.wereld(o);

    // Gloed in de verte rond de troon van de Lichtkoning.
    this.troonGloed = this.wereld(
      this.add.image(WERELD.baas.x, WERELD.baas.y, TEX.gloed)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setTint(0xff2d4a)
      .setAlpha(0.3)
      .setDisplaySize(WERELD.baas.nevelStraal * 3, WERELD.baas.nevelStraal * 3)
        .setDepth(-92)
        .setScrollFactor(0.9),
    );

    const alsWereld = (o: Phaser.GameObjects.Image) => this.wereld(o);
    this.vijandPool = new BolPool(this, 0, 1, alsWereld);
    this.losPool = new BolPool(this, 2, 3, alsWereld);
    this.sporen = this.wereld(
      this.add.graphics().setBlendMode(Phaser.BlendModes.ADD).setDepth(10),
    );
    this.spelerWolk = this.wereld(
      this.add
        .image(0, 0, TEX.gloed)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setTint(0x1f7fdd)
        .setDepth(9)
        .setAlpha(0.2),
    );
    this.spelerPool = new BolPool(this, 12, 13, alsWereld);

    // Ringen en krachtlabels bij iedere vijandelijke groep.
    for (const v of w.vijanden) {
      const ring = this.add
        .image(v.x, v.y, TEX.ring)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setDepth(4)
        .setAlpha(0)
        .setDisplaySize(botsStraal(v.kracht) * 2.4, botsStraal(v.kracht) * 2.4);
      const label = this.add
        .text(v.x, v.y, String(v.kracht), {
          fontFamily: LETTER,
          fontSize: v.kracht >= 10 ? '34px' : '28px',
          color: '#ffe2dc',
          fontStyle: 'bold',
        })
        .setOrigin(0.5)
        .setDepth(6)
        .setStroke('#48000f', 6)
        .setShadow(0, 0, '#ff3344', 12, false, true);
      const wolk = this.wereld(
        this.add
          .image(v.x, v.y, TEX.gloed)
          .setBlendMode(Phaser.BlendModes.ADD)
          .setTint(0xc01020)
          .setDepth(-1)
          .setAlpha(0.22)
          .setDisplaySize(formatieStraal(v.kracht) * 4.4, formatieStraal(v.kracht) * 4.4),
      );
      this.wereld(ring);
      this.wereld(label);
      this.vijandWeergave.push({ ring, label, wolk });
    }

    this.koning = new Lichtkoning(this, w.baas, 8);
    this.wereld(this.koning.container);

    this.volgPunt = this.add.zone(this.model.speler.x, this.model.speler.y, 1, 1);
    this.cameras.main.startFollow(this.volgPunt, false, 0.1, 0.1);
    this.cameras.main.setZoom(1.05);

    this.hud = new HUD(this, () => {
      geluid.ontwaak();
      this.hud.zetGeluid(geluid.wissel());
    });
    this.hud.zetGeluid(geluid.uit);
    this.cameras.main.ignore(this.hud.objecten());

    this.maakToetsen();
    this.maakPauzeLaag();
    this.cameras.main.ignore(this.pauzeLaag);

    this.scale.on('resize', this.opHerschaal, this);
    this.events.once('shutdown', () => {
      this.scale.off('resize', this.opHerschaal, this);
      this.spelerPool.vernietig();
      this.vijandPool.vernietig();
      this.losPool.vernietig();
    });

    this.startTijd = this.time.now;
    this.hud.toon('Verzamel het blauwe licht!', '#bff0ff', 2600);

    // Kleine hulpmiddelen voor geautomatiseerd testen.
    (window as unknown as Record<string, unknown>).__lichtzwerm = {
      model: this.model,
      scene: this,
      zetAantal: (n: number) => {
        while (this.model.aantal < n) {
          this.model.speler.bolletjes.push({
            ...this.model.speler.bolletjes[0],
            fase: Math.random() * 6.28,
            omkleuren: 0,
          });
        }
      },
      teleport: (x: number, y: number) => {
        this.model.speler.x = x;
        this.model.speler.y = y;
        for (const b of this.model.speler.bolletjes) {
          b.x = x;
          b.y = y;
          b.vx = 0;
          b.vy = 0;
        }
      },
      naarBaas: () => {
        const b = this.model.wereld.baas;
        (window as unknown as { __lichtzwerm: { teleport: (x: number, y: number) => void } }).__lichtzwerm.teleport(
          b.x - 420,
          b.y,
        );
      },
    };
  }

  /** Markeert een object als wereldobject: de UI-camera negeert het. */
  private wereld<T extends Phaser.GameObjects.GameObject>(o: T): T {
    this.uiCam.ignore(o);
    return o;
  }

  // ------------------------------------------------------------------ input

  private maakToetsen(): void {
    const kb = this.input.keyboard!;
    const K = Phaser.Input.Keyboard.KeyCodes;
    this.toetsen = {
      op: kb.addKey(K.UP),
      neer: kb.addKey(K.DOWN),
      links: kb.addKey(K.LEFT),
      rechts: kb.addKey(K.RIGHT),
      w: kb.addKey(K.W),
      a: kb.addKey(K.A),
      s: kb.addKey(K.S),
      d: kb.addKey(K.D),
      spatie: kb.addKey(K.SPACE),
    };

    /*
     * Toetsen die één keer per druk iets doen, lezen we uit het keydown-event
     * en niet uit `JustDown`: een korte tik die binnen één frame begint én
     * eindigt zou anders verloren gaan. Phaser kan diezelfde aanslag soms twee
     * keer doorgeven (de interne wachtrij wordt pas na het renderen geleegd),
     * dus filteren we op de tijdstempel van het browser-event.
     */
    kb.on('keydown', (e: KeyboardEvent) => {
      geluid.ontwaak();
      if (e.repeat) return;
      if (this.laatsteToets[e.code] === e.timeStamp) return;
      this.laatsteToets[e.code] = e.timeStamp;
      switch (e.code) {
        case 'Escape':
        case 'KeyP':
          this.wisselPauze();
          break;
        case 'KeyM':
          this.hud.zetGeluid(geluid.wissel());
          break;
        case 'KeyR':
          if (this.afgelopen || this.model.gepauzeerd) this.herstart();
          break;
        case 'Space':
          this.boostGevraagd = true;
          break;
        default:
          break;
      }
    });
    this.input.on('pointerdown', () => geluid.ontwaak());
  }

  private leesInvoer(): Invoer {
    if (this.model.gepauzeerd || this.afgelopen) {
      this.boostGevraagd = false;
      return { x: 0, y: 0, boost: false };
    }
    const t = this.toetsen;
    let x = 0;
    let y = 0;
    if (t.links.isDown || t.a.isDown) x -= 1;
    if (t.rechts.isDown || t.d.isDown) x += 1;
    if (t.op.isDown || t.w.isDown) y -= 1;
    if (t.neer.isDown || t.s.isDown) y += 1;
    const boost = t.spatie.isDown || this.boostGevraagd;
    this.boostGevraagd = false;
    return { x, y, boost };
  }

  // ------------------------------------------------------------------ pauze

  private maakPauzeLaag(): void {
    const cam = this.cameras.main;
    const scherm = this.add
      .rectangle(0, 0, cam.width, cam.height, 0x030718, 0.78)
      .setOrigin(0, 0)
      .setScrollFactor(0);
    const titel = this.add
      .text(cam.width / 2, cam.height / 2 - 130, 'PAUZE', {
        fontFamily: LETTER,
        fontSize: '58px',
        color: '#eaf8ff',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setShadow(0, 0, '#3fc9ff', 22, false, true);

    const knopIn = (y: number, tekst: string, bijKlik: () => void) =>
      maakKnop(this, cam.width / 2, y, tekst, bijKlik, { grootte: 26, padding: 30 });

    const verder = knopIn(cam.height / 2 - 30, 'Verder spelen', () => this.wisselPauze());
    const opnieuw = knopIn(cam.height / 2 + 46, 'Opnieuw beginnen', () => this.herstart());
    const geluidKnop = knopIn(cam.height / 2 + 122, geluid.uit ? 'Geluid: uit' : 'Geluid: aan', () => {
      this.hud.zetGeluid(geluid.wissel());
      geluidKnop.zetTekst(geluid.uit ? 'Geluid: uit' : 'Geluid: aan');
    });

    const hint = this.add
      .text(cam.width / 2, cam.height / 2 + 190, 'Esc = verder   ·   R = opnieuw   ·   M = geluid', {
        fontFamily: LETTER,
        fontSize: '15px',
        color: '#6f9fd0',
      })
      .setOrigin(0.5)
      .setScrollFactor(0);

    this.pauzeLaag = this.add
      .container(0, 0, [scherm, titel, verder.container, opnieuw.container, geluidKnop.container, hint])
      .setScrollFactor(0)
      .setDepth(1500)
      .setVisible(false);
    this.pauzeLaag.setData('scherm', scherm);
    this.pauzeLaag.setData('onderdelen', [
      titel,
      verder.container,
      opnieuw.container,
      geluidKnop.container,
      hint,
    ]);
  }

  private wisselPauze(): void {
    if (this.afgelopen) return;
    if (this.model.gepauzeerd) {
      this.model.hervat();
      this.pauzeLaag.setVisible(false);
    } else {
      this.model.pauzeer();
      this.opHerschaal();
      this.pauzeLaag.setVisible(true);
    }
  }

  herstart(): void {
    this.scene.stop('Eind');
    this.scene.restart();
  }

  private opHerschaal(): void {
    const cam = this.cameras.main;
    this.uiCam?.setSize(this.scale.width, this.scale.height);
    this.achtergrond?.herschaal(cam.width, cam.height);
    this.hud?.herschaal();
    if (!this.pauzeLaag) return;
    const scherm = this.pauzeLaag.getData('scherm') as Phaser.GameObjects.Rectangle;
    scherm.setSize(cam.width, cam.height);
    const onderdelen = this.pauzeLaag.getData('onderdelen') as Array<
      Phaser.GameObjects.Text | Phaser.GameObjects.Container
    >;
    const yS = [-130, -30, 46, 122, 190];
    onderdelen.forEach((o, i) => o.setPosition(cam.width / 2, cam.height / 2 + yS[i]));
  }

  // ----------------------------------------------------------------- update

  update(_tijd: number, deltaMs: number): void {
    const dt = Math.min(deltaMs / 1000, 1 / 20);
    const invoer = this.leesInvoer();

    if (!this.afgelopen) {
      const gebeurtenissen = this.model.update(dt, invoer);
      this.verwerk(gebeurtenissen);
    } else if (this.feestTimer > 0) {
      // Overwinningsrondje om de plek van de koning heen.
      this.feestTimer -= dt;
      const b = this.model.wereld.baas;
      const hoek = this.time.now / 420;
      const dx = b.x + Math.cos(hoek) * 300 - this.model.speler.x;
      const dy = b.y + Math.sin(hoek) * 300 - this.model.speler.y;
      const d = Math.hypot(dx, dy) || 1;
      this.model.naspelUpdate(dt, { x: dx / d, y: dy / d, boost: false });
    } else {
      this.model.naspelUpdate(dt, { x: 0, y: 0, boost: false });
    }

    this.achtergrond.update(this.model.gepauzeerd ? 0 : dt);
    this.tekenSpeler(dt);
    this.tekenVijanden(dt);
    this.tekenLosLicht();
    this.koning.update(
      this.model.wereld.baas,
      this.model.gepauzeerd ? 0 : dt,
      this.model.speler.midX,
      this.model.speler.midY,
    );
    this.updateCamera(dt);
    this.updateHud();

    if (this.kroon) {
      const leider = this.model.speler.bolletjes[0];
      this.kroon.x += (leider.x - this.kroon.x) * Math.min(1, dt * 8);
      this.kroon.y += (leider.y - 46 - this.kroon.y) * Math.min(1, dt * 8);
      this.kroon.setScale(0.42);
    }
  }

  private updateCamera(dt: number): void {
    const s = this.model.speler;
    // Iets vooruitkijken in de richting waarin je vliegt.
    const doelX = s.midX + s.vx * 0.26;
    const doelY = s.midY + s.vy * 0.26;
    this.volgPunt.x += (doelX - this.volgPunt.x) * Math.min(1, dt * 6);
    this.volgPunt.y += (doelY - this.volgPunt.y) * Math.min(1, dt * 6);

    // Hoe groter je zwerm, hoe verder we uitzoomen — je voelt je machtig.
    const groei = Math.min(1, (this.model.aantal - 1) / 80);
    const doelZoom = 1.06 - groei * 0.26 - (this.model.isBoostend ? 0.03 : 0);
    const cam = this.cameras.main;
    cam.setZoom(cam.zoom + (doelZoom - cam.zoom) * Math.min(1, dt * 1.6));
  }

  // --------------------------------------------------------------- tekenen

  private tekenSpeler(dt: number): void {
    const s = this.model.speler;
    const pool = this.spelerPool;
    pool.begin();
    this.sporen.clear();

    const t = this.model.tijd;
    const boost = this.model.isBoostend;

    // Eén zachte wolk onder de hele zwerm: zo leest de groep als één lichtwolk.
    const straal = formatieStraal(this.model.aantal);
    const wolkMaat = straal * 4.2 + 130;
    this.spelerWolk
      .setPosition(s.midX, s.midY)
      .setDisplaySize(wolkMaat, wolkMaat)
      .setAlpha(0.14 + Math.min(0.22, this.model.aantal * 0.0035) + (boost ? 0.06 : 0));

    for (let i = 0; i < s.bolletjes.length; i++) {
      const b = s.bolletjes[i];
      const leider = i === 0;
      const stijl = leider ? LEIDER : BLAUW;
      const puls = 0.82 + Math.sin(t * 2.4 + b.fase) * 0.18;

      let gloedKleur = stijl.gloedKleur;
      let maat = b.maat;
      if (b.omkleuren > 0) {
        const k = b.omkleuren / 0.55;
        gloedKleur = mengKleur(stijl.gloedKleur, KLEUR.roodGloed, k);
        maat *= 1 + k * 0.6;
      }

      pool.teken(b.x, b.y, { ...stijl, gloedKleur }, maat, puls * b.glans);

      // Lichtspoor bij beweging — langer tijdens een boost.
      const snelheid = Math.hypot(b.vx, b.vy);
      if (snelheid > 70) {
        const lengte = Math.min(0.12, snelheid / 7000) * (boost ? 2.1 : 1);
        const alpha = Math.min(0.5, snelheid / 1400) * (leider ? 1.4 : 1);
        this.sporen.lineStyle(
          (leider ? 7 : 4.2) * b.maat,
          leider ? KLEUR.leiderGloed : KLEUR.blauwGloed,
          alpha,
        );
        this.sporen.beginPath();
        this.sporen.moveTo(b.x, b.y);
        this.sporen.lineTo(b.x - b.vx * lengte, b.y - b.vy * lengte);
        this.sporen.strokePath();
      }
    }
    pool.eind();

    // De zachte grens laat van zich horen.
    if (s.raaktGrens > 0.05 && !this.model.gepauzeerd) {
      this.cameras.main.setAlpha(1);
    }
    void dt;
  }

  private tekenVijanden(dt: number): void {
    const pool = this.vijandPool;
    pool.begin();
    const t = this.model.tijd;
    const mijnKracht = this.model.aantal;
    const s = this.model.speler;
    let dichtsteGevaar = Infinity;

    for (let i = 0; i < this.model.wereld.vijanden.length; i++) {
      const v = this.model.wereld.vijanden[i];
      const weergave = this.vijandWeergave[i];
      if (v.verslagen) {
        weergave.ring.setVisible(false);
        weergave.label.setVisible(false);
        weergave.wolk.setVisible(false);
        continue;
      }
      weergave.wolk
        .setPosition(v.x, v.y)
        .setAlpha(0.18 + v.alert * 0.1 + Math.sin(t * 1.7 + v.id) * 0.03);

      for (const b of v.bolletjes) {
        const puls = 0.78 + Math.sin(t * 3.1 + b.fase) * 0.22 + v.alert * 0.2;
        pool.teken(b.x, b.y, ROOD, b.maat, puls * b.glans);
      }

      const afstand = Math.hypot(v.x - s.midX, v.y - s.midY);
      const straal = formatieStraal(v.kracht);

      // Duidelijke kleurtaal: groen = je kunt winnen, rood = gevaar.
      let tint = 0xe8d08a;
      let sterkte = 0.4;
      if (mijnKracht > v.kracht) {
        tint = 0x5dffc0;
        sterkte = 0.62;
      } else if (mijnKracht < v.kracht) {
        tint = 0xff3f4f;
        sterkte = 0.78;
        if (afstand < dichtsteGevaar) dichtsteGevaar = afstand;
      }

      const nabij = Phaser.Math.Clamp(1 - (afstand - straal) / 780, 0, 1);
      const puls = mijnKracht < v.kracht ? 0.7 + Math.sin(t * 5) * 0.3 : 0.85;
      weergave.ring
        .setVisible(nabij > 0.01)
        .setPosition(v.x, v.y)
        .setAlpha(nabij * sterkte * puls)
        .setDisplaySize(
          (straal + 34) * 2 * (1 + (mijnKracht < v.kracht ? Math.sin(t * 5) * 0.03 : 0)),
          (straal + 34) * 2 * (1 + (mijnKracht < v.kracht ? Math.sin(t * 5) * 0.03 : 0)),
        )
        .setTint(tint);

      weergave.label
        .setVisible(true)
        .setPosition(v.x, v.y - straal - 30)
        .setAlpha(0.65 + nabij * 0.35)
        .setColor(mijnKracht > v.kracht ? '#d8ffe9' : '#ffe2dc');
    }
    pool.eind();

    // Zachte waarschuwing wanneer iets sterkers vlakbij is.
    const gevaar = dichtsteGevaar < 420 ? 1 - dichtsteGevaar / 420 : 0;
    this.gevaarWaarschuwing += (gevaar - this.gevaarWaarschuwing) * Math.min(1, dt * 3);
    if (this.gevaarWaarschuwing > 0.35 && !this.model.gepauzeerd) {
      geluid.baasDreigt();
    }
  }

  private tekenLosLicht(): void {
    const pool = this.losPool;
    pool.begin();
    const t = this.model.tijd;
    for (const los of this.model.wereld.losseBolletjes) {
      if (los.verzameld) continue;
      const puls = 0.72 + Math.sin(t * 2 + los.fase) * 0.28;
      const zweefX = Math.sin(t * 0.8 + los.fase) * 7;
      const zweefY = Math.cos(t * 0.63 + los.fase * 1.4) * 7;
      pool.teken(los.x + zweefX, los.y + zweefY, LOS, 1 + puls * 0.14, puls);
    }
    pool.eind();
  }

  private updateHud(): void {
    const b = this.model.wereld.baas;
    const cam = this.cameras.main;
    const zichtbaar =
      b.x > cam.worldView.x - 200 &&
      b.x < cam.worldView.right + 200 &&
      b.y > cam.worldView.y - 200 &&
      b.y < cam.worldView.bottom + 200;
    const hoek = Math.atan2(b.y - this.model.speler.midY, b.x - this.model.speler.midX);
    this.hud.update(this.model.aantal, this.model.boostLading, this.model.sterkGenoegVoorBaas, {
      hoek,
      zichtbaar: zichtbaar || b.verslagen,
    });
    this.troonGloed.setAlpha(b.verslagen ? 0 : 0.26 + Math.sin(this.model.tijd * 0.9) * 0.06);
  }

  // --------------------------------------------------------- gebeurtenissen

  private verwerk(gebeurtenissen: Gebeurtenis[]): void {
    for (const e of gebeurtenissen) {
      switch (e.soort) {
        case 'verzameld':
          geluid.verzamel(e.totaal);
          this.vonken(e.x, e.y, 9, 0x8ff2ff, 150);
          this.hud.vierTelling();
          break;
        case 'verslagen':
          geluid.overwinning(e.winst);
          this.flits(e.x, e.y, 0xff6a5a, 170 + e.winst * 11);
          this.vonken(e.x, e.y, Math.min(34, 12 + e.winst * 2), 0xff8a6a, 230);
          this.vonken(e.x, e.y, Math.min(30, 10 + e.winst * 2), 0x7fe8ff, 290);
          this.hud.vierTelling();
          this.cameras.main.shake(130, 0.0014 + Math.min(0.0024, e.winst * 0.00015));
          break;
        case 'gelijk':
          geluid.gelijkspel();
          this.hud.toon('Even sterk!', '#ffe9a8', 900);
          this.flits(e.x, e.y, 0xffe9a8, 110);
          break;
        case 'boost':
          geluid.boost();
          this.boostVonken();
          break;
        case 'sterk_genoeg':
          geluid.sterkGenoeg();
          this.hud.toon('Je bent sterk genoeg voor de lichtkoning!', '#ffe9a8', 3400);
          break;
        case 'baas_gezien':
          geluid.baasVerschijnt();
          this.hud.toon('De Lichtkoning…  kracht 65', '#ff9f93', 2600);
          break;
        case 'baas_aankondiging':
          geluid.baasDreigt();
          break;
        case 'baas_stormt':
          this.cameras.main.shake(180, 0.004);
          break;
        case 'verloren':
          this.verliesMoment(e.x, e.y, e.kracht, e.doorBaas);
          break;
        case 'baas_verslagen':
          this.overwinningsMoment(e.x, e.y);
          break;
        default:
          break;
      }
    }
  }

  private vonken(x: number, y: number, aantal: number, kleur: number, snelheid: number): void {
    const em = this.add.particles(x, y, TEX.vonk, {
      speed: { min: snelheid * 0.3, max: snelheid },
      lifespan: { min: 320, max: 820 },
      scale: { start: 0.9, end: 0 },
      alpha: { start: 0.95, end: 0 },
      tint: kleur,
      blendMode: Phaser.BlendModes.ADD,
      emitting: false,
    });
    em.setDepth(20);
    this.wereld(em);
    em.explode(aantal);
    this.time.delayedCall(1000, () => em.destroy());
  }

  private flits(x: number, y: number, kleur: number, maat: number): void {
    const f = this.add
      .image(x, y, TEX.gloed)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setTint(kleur)
      .setDepth(19)
      .setDisplaySize(maat, maat)
      .setAlpha(0.9);
    this.wereld(f);
    this.tweens.add({
      targets: f,
      alpha: 0,
      displayWidth: maat * 3.4,
      displayHeight: maat * 3.4,
      duration: 460,
      ease: 'Quad.easeOut',
      onComplete: () => f.destroy(),
    });
  }

  private boostVonken(): void {
    const s = this.model.speler;
    const em = this.add.particles(0, 0, TEX.vonk, {
      speed: { min: 20, max: 110 },
      lifespan: 420,
      scale: { start: 0.7, end: 0 },
      alpha: { start: 0.7, end: 0 },
      tint: [0x7fe8ff, 0xffffff],
      blendMode: Phaser.BlendModes.ADD,
      frequency: 18,
      quantity: 2,
    });
    em.setDepth(11);
    this.wereld(em);
    const stop = this.time.addEvent({
      delay: 16,
      repeat: Math.floor(SPELER.boostDuur * 60),
      callback: () => em.setPosition(s.x, s.y),
    });
    this.time.delayedCall(SPELER.boostDuur * 1000, () => em.stop());
    this.time.delayedCall(SPELER.boostDuur * 1000 + 600, () => {
      em.destroy();
      stop.remove();
    });
  }

  // --------------------------------------------------------- eindmomenten

  private verliesMoment(x: number, y: number, kracht: number, doorBaas: boolean): void {
    this.afgelopen = true;
    geluid.verloren();
    this.cameras.main.shake(260, 0.006);
    this.flits(x, y, 0xff4a4a, 320);
    this.vonken(this.model.speler.midX, this.model.speler.midY, 26, 0x9fe8ff, 280);
    // Korte, donkere tint in plaats van een felle flits: rustig genoeg voor kinderen.
    this.cameras.main.flash(170, 70, 8, 22);
    this.time.delayedCall(950, () => {
      this.scene.launch('Eind', {
        gewonnen: false,
        aantal: this.model.aantal,
        seconden: (this.time.now - this.startTijd) / 1000,
        kracht,
        doorBaas,
      });
    });
  }

  private overwinningsMoment(x: number, y: number): void {
    this.afgelopen = true;
    this.feestTimer = 3.4;
    geluid.gewonnen();

    this.koning.zetVerbaasd();
    const kroon = this.wereld(this.koning.pakKroon());
    this.kroon = undefined;

    // 1. Verbaasd kijken, 2. kroon springt omhoog.
    this.tweens.add({
      targets: kroon,
      y: kroon.y - 180,
      scale: 1.2,
      duration: 620,
      ease: 'Back.easeOut',
    });

    // 3. De koning barst uiteen in rode, blauwe en gouden deeltjes.
    this.time.delayedCall(620, () => {
      this.koning.container.setVisible(false);
      this.cameras.main.shake(340, 0.005);
      // Geen schermvullende flits, maar een grote gouden lichtbloem op zijn plek.
      this.flits(x, y, 0xffd36b, 560);
      this.flits(x, y, 0xffffff, 300);
      this.vonken(x, y, 46, 0xff5a4a, 560);
      this.vonken(x, y, 40, 0x7fe8ff, 480);
      this.vonken(x, y, 36, 0xffd36b, 420);
      this.hud.toon('De Lichtkoning is verslagen!', '#ffe9a8', 2600);
    });

    // 5. De kroon landt op het leidende blauwe bolletje.
    this.time.delayedCall(1500, () => {
      this.kroon = kroon;
    });

    this.time.delayedCall(3600, () => {
      this.scene.launch('Eind', {
        gewonnen: true,
        aantal: this.model.aantal,
        seconden: (this.time.now - this.startTijd) / 1000,
        kracht: BAAS ? this.model.wereld.baas.kracht : 0,
        doorBaas: true,
      });
    });
  }
}

export const NODIG = NODIG_VOOR_BAAS;
