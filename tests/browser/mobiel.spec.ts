/**
 * Browsertests voor de mobiele versie: knoppen op het scherm, en alleen daar.
 * Draait met een telefoon-viewport en een echt aanraakscherm.
 */
import { test, expect, type Page } from '@playwright/test';

async function startSpel(page: Page): Promise<void> {
  await page.goto('/');
  await page.waitForFunction(() => !!window.__spel, null, { timeout: 20_000 });
  await page.waitForFunction(() => window.__spel.scene.isActive('Menu'));
  await page.evaluate(() => {
    (window.__spel.scene.getScene('Menu') as { speel: () => void }).speel();
  });
  await page.waitForFunction(() => !!window.__lichtzwerm, null, { timeout: 20_000 });
}

/**
 * Echte aanraakinvoer via het Chrome DevTools Protocol. Zelf TouchEvents in
 * elkaar zetten werkt niet betrouwbaar: Phaser luistert op touchstart/-move/-end
 * en een half nagemaakt event laat de browser omvallen.
 */
async function vinger(page: Page) {
  const cdp = await page.context().newCDPSession(page);
  return {
    neer: (x: number, y: number) =>
      cdp.send('Input.dispatchTouchEvent', {
        type: 'touchStart',
        touchPoints: [{ x, y, id: 1 }],
      }),
    beweeg: (x: number, y: number) =>
      cdp.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{ x, y, id: 1 }],
      }),
    los: () => cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }),
    sluit: () => cdp.detach(),
  };
}

/** Zet een vinger neer, sleep en laat weer los. */
async function sleep(
  page: Page,
  van: { x: number; y: number },
  naar: { x: number; y: number },
  vasthoudenMs = 700,
): Promise<void> {
  const v = await vinger(page);
  await v.neer(van.x, van.y);
  await page.waitForTimeout(80);
  await v.beweeg(naar.x, naar.y);
  await page.waitForTimeout(vasthoudenMs);
  await v.los();
  await v.sluit();
}

/** Houdt een knop even ingedrukt. */
async function tikVast(page: Page, punt: { x: number; y: number }, ms: number): Promise<void> {
  const v = await vinger(page);
  await v.neer(punt.x, punt.y);
  await page.waitForTimeout(ms);
  await v.los();
  await v.sluit();
}

/**
 * Alleen losse getallen teruggeven: een heel Phaser-object serialiseren naar de
 * testrunner laat de browser omvallen.
 */
function knopPlek(page: Page): Promise<{ x: number; y: number }> {
  return page.evaluate(() => {
    const k = window.__lichtzwerm.scene.aanraak!.hoofdknop.container;
    return { x: k.x, y: k.y };
  });
}

function spelerPlek(page: Page): Promise<{ x: number; y: number }> {
  return page.evaluate(() => {
    const s = window.__lichtzwerm.model.speler;
    return { x: s.x, y: s.y };
  });
}

test('op een telefoon verschijnen de knoppen op het scherm', async ({ page }) => {
  await startSpel(page);
  await expect.poll(() => page.evaluate(() => !!window.__lichtzwerm.scene.aanraak)).toBe(true);
});

test('slepen in de linkerhelft laat de zwerm vliegen', async ({ page }) => {
  await startSpel(page);
  await page.waitForFunction(() => !!window.__lichtzwerm.scene.aanraak);

  const voor = await spelerPlek(page);
  await sleep(page, { x: 110, y: 280 }, { x: 190, y: 230 }, 900);
  const na = await spelerPlek(page);

  // Naar rechtsboven gesleept, dus naar rechts en omhoog gevlogen.
  expect(na.x).toBeGreaterThan(voor.x + 80);
  expect(na.y).toBeLessThan(voor.y - 40);

  // Na loslaten staat de stick weer op nul.
  expect(await page.evaluate(() => window.__lichtzwerm.scene.aanraak!.lees().x)).toBe(0);
});

test('de knop rechts geeft een boost', async ({ page }) => {
  await startSpel(page);
  await page.waitForFunction(() => !!window.__lichtzwerm.scene.aanraak);
  const knop = await knopPlek(page);
  expect(await page.evaluate(() => window.__lichtzwerm.scene.aanraak!.hoofdknop.label.text)).toBe(
    'BOOST',
  );

  const boostend = page.waitForFunction(() => window.__lichtzwerm.model.isBoostend, null, {
    timeout: 5000,
  });
  await tikVast(page, knop, 300);
  await boostend;
});

test('in de arena wordt die knop een schietknop', async ({ page }) => {
  await startSpel(page);
  await page.waitForFunction(() => !!window.__lichtzwerm.scene.aanraak);
  await page.evaluate(() => {
    const h = window.__lichtzwerm;
    h.zetAantal(75);
    const b = h.model.wereld.baas;
    h.teleport(b.thuisX - 520, b.thuisY);
  });
  await expect.poll(() => page.evaluate(() => window.__lichtzwerm.model.arenaActief)).toBe(true);
  await expect
    .poll(() => page.evaluate(() => window.__lichtzwerm.scene.aanraak!.hoofdknop.label.text))
    .toBe('SCHIET');
  expect(
    await page.evaluate(() => window.__lichtzwerm.scene.aanraak!.boostknop.container.visible),
  ).toBe(true);

  const knop = await knopPlek(page);
  const voor = await page.evaluate(() => window.__lichtzwerm.model.baasLeven);
  await tikVast(page, knop, 1200);
  await page.waitForTimeout(400);
  const na = await page.evaluate(() => window.__lichtzwerm.model.baasLeven);
  expect(na).toBeLessThan(voor);
});

test('het spel past in een staand telefoonscherm', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await startSpel(page);
  const maten = await page.evaluate(() => {
    const c = window.__spel.canvas;
    return { c: [c.clientWidth, c.clientHeight], w: [window.innerWidth, window.innerHeight] };
  });
  expect(maten.c[0]).toBeLessThanOrEqual(maten.w[0]);
  expect(maten.c[1]).toBeLessThanOrEqual(maten.w[1]);
  expect(await page.evaluate(() => !!window.__lichtzwerm.scene.aanraak)).toBe(true);
});
