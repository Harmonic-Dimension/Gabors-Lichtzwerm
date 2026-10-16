/**
 * Maakt schermafbeeldingen van het spel met een echte browser.
 * Gebruik:  npm run dev   (in een andere terminal)
 *           node scripts/maak-schermafbeeldingen.mjs
 */
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const URL = process.env.LICHTZWERM_URL ?? 'http://127.0.0.1:5173/';
const MAP = 'schermafbeeldingen';

mkdirSync(MAP, { recursive: true });

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('pageerror', (e) => console.error('paginafout:', e));

await page.goto(URL);
await page.waitForFunction(() => !!window.__spel, null, { timeout: 30000 });
await page.waitForTimeout(2500);
console.log('renderer:', await page.evaluate(() => window.__spel.renderer.type === 2 ? 'WebGL' : 'Canvas'));

await page.screenshot({ path: `${MAP}/1-startscherm.png` });
console.log('1-startscherm.png');

await page.evaluate(() => window.__spel.scene.getScene('Menu').speel());
await page.waitForFunction(() => !!window.__lichtzwerm, null, { timeout: 20000 });
await page.waitForTimeout(900);

// Middelgrote zwerm naast een rode groep.
await page.evaluate(() => {
  const h = window.__lichtzwerm;
  h.zetAantal(28);
  const v = h.model.wereld.vijanden.find((v) => v.kracht === 6);
  h.teleport(v.x - 430, v.y + 40);
});
await page.waitForTimeout(2600);
await page.keyboard.down('ArrowRight');
await page.waitForTimeout(500);
await page.keyboard.up('ArrowRight');
await page.waitForTimeout(400);
await page.screenshot({ path: `${MAP}/2-zwerm.png` });
console.log('2-zwerm.png');

// Ontmoeting met de Lichtkoning: nog niet sterk genoeg, dus hij kijkt boos.
await page.evaluate(() => {
  const h = window.__lichtzwerm;
  h.zetAantal(44);
  const b = h.model.wereld.baas;
  h.teleport(b.x - 620, b.y + 40);
});
await page.waitForTimeout(1400);
await page.screenshot({ path: `${MAP}/3-lichtkoning.png` });
console.log('3-lichtkoning.png');

// Het gevecht in de arena.
await page.evaluate(() => {
  const h = window.__lichtzwerm;
  h.zetAantal(88);
  const b = h.model.wereld.baas;
  h.teleport(b.thuisX - 620, b.thuisY + 80);
});
await page.waitForFunction(() => window.__lichtzwerm.model.arenaActief, null, { timeout: 20000 });
await page.waitForTimeout(1200);
await page.keyboard.down('Space');
await page.waitForFunction(() => window.__lichtzwerm.model.baasLeven < 50, null, { timeout: 30000 });
await page.waitForTimeout(150);
await page.screenshot({ path: `${MAP}/4-arena.png` });
console.log('4-arena.png');

// Overwinning: jij wordt zelf de goede Lichtkoning.
await page.waitForFunction(() => window.__lichtzwerm.model.stand !== 'spelen', null, { timeout: 40000 });
await page.keyboard.up('Space');
await page.waitForTimeout(4200);
await page.screenshot({ path: `${MAP}/5-goede-lichtkoning.png` });
await page.waitForTimeout(2600);
await page.screenshot({ path: `${MAP}/6-eindscherm.png` });
console.log('5-goede-lichtkoning.png, 6-eindscherm.png');

// ---------------------------------------------------------------- telefoon
const telefoon = await browser.newContext({
  viewport: { width: 844, height: 390 },
  isMobile: true,
  hasTouch: true,
});
const tel = await telefoon.newPage();
await tel.goto(URL);
await tel.waitForFunction(() => !!window.__spel, null, { timeout: 30000 });
await tel.waitForTimeout(1500);
await tel.evaluate(() => window.__spel.scene.getScene('Menu').speel());
await tel.waitForFunction(() => !!window.__lichtzwerm, null, { timeout: 20000 });
await tel.evaluate(() => {
  const h = window.__lichtzwerm;
  h.zetAantal(72);
  const b = h.model.wereld.baas;
  h.teleport(b.thuisX - 430, b.thuisY + 70);
});
await tel.waitForFunction(() => window.__lichtzwerm.model.arenaActief, null, { timeout: 20000 });
await tel.waitForTimeout(3000);
// Even schieten, zodat de knoppen in actie te zien zijn.
const vinger = await tel.context().newCDPSession(tel);
const knop = await tel.evaluate(() => {
  const k = window.__lichtzwerm.scene.aanraak.hoofdknop.container;
  return { x: k.x, y: k.y };
});
await vinger.send('Input.dispatchTouchEvent', {
  type: 'touchStart',
  touchPoints: [{ x: knop.x, y: knop.y, id: 1 }],
});
await tel.waitForTimeout(900);
await tel.screenshot({ path: `${MAP}/7-telefoon.png` });
await vinger.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
console.log('7-telefoon.png');
await telefoon.close();

await browser.close();
