/**
 * Browsertests met Playwright: draait het echte spel in een echte browser.
 * Starten met:  npm run test:browser
 *
 * Het spel legt een kleine testhaak klaar op `window.__lichtzwerm`
 * (model, teleport, zetAantal) zodat we niet minutenlang hoeven te spelen.
 */
import { test, expect, type Page } from '@playwright/test';

type Haak = {
  model: {
    aantal: number;
    stand: 'spelen' | 'gewonnen' | 'verloren';
    gepauzeerd: boolean;
    tijd: number;
    boostKlaar: boolean;
    boostLading: number;
    isBoostend: boolean;
    verlorenTegen: number;
    speler: { x: number; y: number; midX: number; midY: number };
    wereld: {
      baas: { x: number; y: number; kracht: number; verslagen: boolean };
      vijanden: Array<{ x: number; y: number; kracht: number; verslagen: boolean; rust: number }>;
      losseBolletjes: Array<{ x: number; y: number; verzameld: boolean }>;
    };
  };
  zetAantal: (n: number) => void;
  teleport: (x: number, y: number) => void;
};

declare global {
  interface Window {
    __spel: { scene: { getScene: (k: string) => unknown; isActive: (k: string) => boolean } };
    __lichtzwerm: Haak;
  }
}

const fouten: string[] = [];

test.beforeEach(async ({ page }) => {
  fouten.length = 0;
  page.on('pageerror', (e) => fouten.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error') fouten.push(m.text());
  });
  await page.goto('/');
  await page.waitForFunction(() => !!window.__spel, null, { timeout: 20_000 });
});

/** Start het spel via het startscherm en wacht tot de spelscene draait. */
async function startSpel(page: Page): Promise<void> {
  await page.waitForFunction(() => window.__spel.scene.isActive('Menu'));
  await page.evaluate(() => {
    (window.__spel.scene.getScene('Menu') as { speel: () => void }).speel();
  });
  await page.waitForFunction(() => !!window.__lichtzwerm, null, { timeout: 20_000 });
}

/** Houdt een toets ingedrukt en laat de simulatie doorlopen. */
async function houdToets(page: Page, toets: string, ms: number): Promise<void> {
  await page.keyboard.down(toets);
  await page.waitForTimeout(ms);
  await page.keyboard.up(toets);
}

/** Leest iets uit het spelmodel; de haak gaat als argument mee naar de pagina. */
async function model<T>(page: Page, fn: (h: Haak) => T): Promise<T> {
  const haak = await page.evaluateHandle(() => window.__lichtzwerm);
  try {
    return (await page.evaluate(fn as never, haak as never)) as T;
  } finally {
    await haak.dispose();
  }
}

test('1. het startscherm verschijnt zonder fouten', async ({ page }) => {
  await expect
    .poll(() => page.evaluate(() => window.__spel.scene.isActive('Menu')))
    .toBe(true);
  expect(fouten).toEqual([]);
});

test('2. de speler beweegt met de pijltjestoetsen', async ({ page }) => {
  await startSpel(page);
  const voor = await page.evaluate(() => ({ ...window.__lichtzwerm.model.speler }));
  await houdToets(page, 'ArrowRight', 800);
  const na = await page.evaluate(() => ({ ...window.__lichtzwerm.model.speler }));
  expect(na.x).toBeGreaterThan(voor.x + 100);

  await houdToets(page, 'ArrowDown', 800);
  const na2 = await page.evaluate(() => ({ ...window.__lichtzwerm.model.speler }));
  expect(na2.y).toBeGreaterThan(na.y + 80);
});

test('3. de camera volgt de speler', async ({ page }) => {
  await startSpel(page);
  const camVoor = await page.evaluate(
    () =>
      (
        window.__spel.scene.getScene('Spel') as {
          cameras: { main: { scrollX: number } };
        }
      ).cameras.main.scrollX,
  );
  await houdToets(page, 'ArrowRight', 1200);
  await page.waitForTimeout(300);
  const camNa = await page.evaluate(
    () =>
      (
        window.__spel.scene.getScene('Spel') as {
          cameras: { main: { scrollX: number } };
        }
      ).cameras.main.scrollX,
  );
  expect(camNa).toBeGreaterThan(camVoor + 100);
});

test('4+5. blauwe bolletjes verzamelen laat de teller correct oplopen', async ({ page }) => {
  await startSpel(page);
  expect(await model(page, (h) => h.model.aantal)).toBe(1);

  await page.evaluate(() => {
    const h = window.__lichtzwerm;
    const los = h.model.wereld.losseBolletjes.find((o) => !o.verzameld)!;
    h.teleport(los.x - 40, los.y);
  });
  await expect.poll(() => model(page, (h) => h.model.aantal)).toBeGreaterThanOrEqual(2);
});

test('6. een kleinere rode groep wordt verslagen en telt op', async ({ page }) => {
  await startSpel(page);
  const winst = await page.evaluate(async () => {
    const h = window.__lichtzwerm;
    h.zetAantal(9);
    const groep = h.model.wereld.vijanden.find((v) => v.kracht === 4)!;
    const voor = h.model.aantal;
    h.teleport(groep.x - 30, groep.y);
    await new Promise((r) => setTimeout(r, 700));
    return { voor, na: h.model.aantal, verslagen: groep.verslagen, stand: h.model.stand };
  });
  expect(winst.verslagen).toBe(true);
  expect(winst.na).toBe(winst.voor + 4);
  expect(winst.stand).toBe('spelen');
});

test('7. een grotere groep verslaat de speler', async ({ page }) => {
  await startSpel(page);
  await page.evaluate(() => {
    const h = window.__lichtzwerm;
    const groep = h.model.wereld.vijanden.find((v) => v.kracht === 12)!;
    h.teleport(groep.x - 20, groep.y);
  });
  await expect.poll(() => model(page, (h) => h.model.stand)).toBe('verloren');
  expect(await model(page, (h) => h.model.verlorenTegen)).toBe(12);
  await expect.poll(() => page.evaluate(() => window.__spel.scene.isActive('Eind'))).toBe(true);
});

test('8. gelijke sterkte geeft geen winst en geen verlies', async ({ page }) => {
  await startSpel(page);
  const uitslag = await page.evaluate(async () => {
    const h = window.__lichtzwerm;
    // Los licht weghalen zodat de telling niet verandert tijdens de test.
    for (const o of h.model.wereld.losseBolletjes) o.verzameld = true;
    h.zetAantal(8);
    const groep = h.model.wereld.vijanden.find((v) => v.kracht === 8)!;
    h.teleport(groep.x - 20, groep.y);
    await new Promise((r) => setTimeout(r, 900));
    return {
      aantal: h.model.aantal,
      stand: h.model.stand,
      verslagen: groep.verslagen,
      rust: groep.rust,
    };
  });
  expect(uitslag.stand).toBe('spelen');
  expect(uitslag.aantal).toBe(8);
  expect(uitslag.verslagen).toBe(false);
  expect(uitslag.rust).toBeGreaterThan(0);
});

test('9. de boost werkt en heeft een afkoeltijd', async ({ page }) => {
  await startSpel(page);
  await houdToets(page, 'ArrowRight', 900);
  await page.keyboard.down('ArrowRight');
  const snelVoor = await model(page, (h) => Math.abs(h.model.speler.x));
  await page.keyboard.press('Space');
  await page.waitForTimeout(250);
  const boostend = await model(page, (h) => h.model.isBoostend);
  expect(boostend).toBe(true);
  await page.waitForTimeout(300);
  const snelNa = await model(page, (h) => Math.abs(h.model.speler.x));
  await page.keyboard.up('ArrowRight');
  // Tijdens de boost is de afgelegde afstand duidelijk groter.
  expect(snelNa - snelVoor).toBeGreaterThan(200);

  await page.waitForTimeout(400);
  expect(await model(page, (h) => h.model.boostKlaar)).toBe(false);
  expect(await model(page, (h) => h.model.boostLading)).toBeLessThan(1);
});

test('10+11. de eindbaas wordt gevonden en verslagen, met overwinningsscherm', async ({ page }) => {
  await startSpel(page);
  await page.evaluate(() => {
    const h = window.__lichtzwerm;
    h.zetAantal(66);
    const b = h.model.wereld.baas;
    h.teleport(b.x - 220, b.y);
  });
  await houdToets(page, 'ArrowRight', 1500);
  await expect.poll(() => model(page, (h) => h.model.stand), { timeout: 20_000 }).toBe('gewonnen');
  await expect
    .poll(() => page.evaluate(() => window.__spel.scene.isActive('Eind')), { timeout: 20_000 })
    .toBe(true);
});

test('10b. de eindbaas verslaat een speler met 65 bolletjes', async ({ page }) => {
  await startSpel(page);
  await page.evaluate(() => {
    const h = window.__lichtzwerm;
    h.zetAantal(65);
    const b = h.model.wereld.baas;
    h.teleport(b.x - 200, b.y);
  });
  await houdToets(page, 'ArrowRight', 1500);
  await expect.poll(() => model(page, (h) => h.model.stand), { timeout: 20_000 }).toBe('verloren');
});

test('12. het spel kan opnieuw gestart worden', async ({ page }) => {
  await startSpel(page);
  await page.evaluate(() => {
    const h = window.__lichtzwerm;
    const groep = h.model.wereld.vijanden.find((v) => v.kracht === 16)!;
    h.teleport(groep.x - 20, groep.y);
  });
  await expect.poll(() => model(page, (h) => h.model.stand)).toBe('verloren');
  await expect.poll(() => page.evaluate(() => window.__spel.scene.isActive('Eind'))).toBe(true);

  await page.keyboard.press('r');
  await expect.poll(() => model(page, (h) => h.model.stand)).toBe('spelen');
  expect(await model(page, (h) => h.model.aantal)).toBe(1);
  expect(await page.evaluate(() => window.__spel.scene.isActive('Eind'))).toBe(false);
});

test('Esc pauzeert het spel: posities en aantallen bevriezen', async ({ page }) => {
  await startSpel(page);
  await houdToets(page, 'ArrowRight', 500);
  await page.keyboard.press('Escape');
  await expect.poll(() => model(page, (h) => h.model.gepauzeerd)).toBe(true);
  const foto = await model(page, (h) => ({
    x: h.model.speler.x,
    tijd: h.model.tijd,
    aantal: h.model.aantal,
  }));
  await houdToets(page, 'ArrowRight', 700);
  const na = await model(page, (h) => ({
    x: h.model.speler.x,
    tijd: h.model.tijd,
    aantal: h.model.aantal,
    gepauzeerd: h.model.gepauzeerd,
  }));
  expect(na.gepauzeerd).toBe(true);
  expect(na.x).toBe(foto.x);
  expect(na.tijd).toBe(foto.tijd);
  expect(na.aantal).toBe(foto.aantal);

  await page.keyboard.press('Escape');
  await expect.poll(() => model(page, (h) => h.model.gepauzeerd)).toBe(false);
});

test('13. een volledige speelsessie levert geen ernstige console errors op', async ({ page }) => {
  await startSpel(page);
  await page.evaluate(() => {
    const h = window.__lichtzwerm;
    h.zetAantal(66);
    const b = h.model.wereld.baas;
    h.teleport(b.x - 200, b.y);
  });
  await houdToets(page, 'ArrowRight', 1500);
  await expect.poll(() => model(page, (h) => h.model.stand), { timeout: 20_000 }).toBe('gewonnen');
  await page.waitForTimeout(1500);
  expect(fouten).toEqual([]);
});
