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
await page.waitForTimeout(2200);
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

// Overwinning.
await page.evaluate(() => {
  const h = window.__lichtzwerm;
  h.zetAantal(68);
});
await page.waitForTimeout(500);
await page.keyboard.down('ArrowRight');
await page.waitForFunction(() => window.__lichtzwerm.model.stand !== 'spelen', null, { timeout: 20000 });
await page.keyboard.up('ArrowRight');
await page.waitForTimeout(700);
await page.screenshot({ path: `${MAP}/4-overwinning.png` });
await page.waitForTimeout(3600);
await page.screenshot({ path: `${MAP}/5-eindscherm.png` });
console.log('4-overwinning.png, 5-eindscherm.png');

await browser.close();
