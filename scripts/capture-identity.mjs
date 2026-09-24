// Export a cover illustration and icon from the application's original vector assets.
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
const origin = process.env.CAPTURE_ORIGIN ?? 'http://127.0.0.1:4180';
if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(origin)) throw new Error('Identity export requires a local production service.');
mkdirSync('submission/assets', { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, reducedMotion: 'reduce' });
  page.setDefaultTimeout(8000);
  await page.route(/assemblyai\.com|\/voice-token(?:\?|$)/, () => { throw new Error('No provider access is allowed in identity export.'); });
  await page.goto(origin);
  const pip = await page.locator('.title-pip .pip-art').evaluate(node => node.outerHTML);
  await page.setContent(`<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Talk Me Home cover illustration</title><style>
    *{box-sizing:border-box}body{margin:0;background:#172a28;color:#f3ecd9;font-family:Arial,sans-serif;width:1600px;height:900px;overflow:hidden}
    .scene{position:absolute;inset:0;width:1600px;height:900px;object-fit:cover}.frame{position:absolute;inset:25px;border:1px solid #7b886b66}
    .copy{position:absolute;left:100px;top:140px;width:830px}.eyebrow{color:#ccd4b9;font-size:19px;letter-spacing:3px}
    h1{font:400 110px/.96 Georgia,serif;letter-spacing:-4px;margin:35px 0}h1 em{color:#e7c995;font-weight:400}p{font-size:29px;line-height:1.5;color:#e7e5d0}
    .pip{position:absolute;width:430px;right:65px;bottom:45px}.pip svg{width:100%;height:auto;filter:drop-shadow(0 12px 15px #13292366)}
    .chapters{position:absolute;left:100px;bottom:114px;display:flex;gap:35px;font-size:20px;color:#cbd1b7}.chapters b{color:#d9b987;font-weight:400;margin-right:10px}
    .caption{position:absolute;bottom:45px;left:100px;color:#bfc8ad;font-size:16px}.label{position:absolute;bottom:45px;right:70px;font-size:14px;color:#d7d8c4}
  </style></head><body><img class="scene" src="${origin}/art/mission-control.svg" alt=""><div class="frame"></div><div class="copy"><div class="eyebrow">A VOICE CO-OP RESCUE GAME</div><h1>Talk Me<br/><em>Home.</em></h1><p>You have the map.<br/>Pip has eyes and hands.<br/>Neither can get home alone.</p></div><div class="pip">${pip}</div><div class="chapters"><span><b>01</b>Cargo Bay</span><span><b>02</b>Relay Gallery</span><span><b>03</b>Return Dock</span></div><div class="caption">One human. One robot. A shared way home.</div><div class="label">Original cover illustration · not gameplay</div></body></html>`);
  await page.locator('.scene').evaluate(image => image.decode());
  await page.screenshot({ path: 'submission/assets/cover-illustration-1600x900.png', animations: 'disabled' });
  await page.setViewportSize({ width: 512, height: 512 });
  await page.setContent(`<html><body style="margin:0"><img width="512" height="512" src="${origin}/icon.svg" alt="Pip app icon"></body></html>`);
  await page.locator('img').evaluate(image => image.decode());
  await page.screenshot({ path: 'submission/assets/app-icon-512.png' });
} finally { await browser.close(); }
