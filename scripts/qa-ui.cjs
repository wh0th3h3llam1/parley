const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.EDGE_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
  });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const output = path.join(process.cwd(), 'artifacts', 'ui-review');
  fs.mkdirSync(output, { recursive: true });

  async function check(width, room) {
    await page.setViewportSize({ width, height: 900 });
    const size = await page.evaluate(() => ({
      viewport: window.innerWidth,
      document: document.documentElement.scrollWidth
    }));
    if (size.document > size.viewport + 1) {
      throw new Error(`${room} at ${width}px overflows horizontally: ${size.document}px`);
    }
    await page.screenshot({ path: path.join(output, `${room}-${width}.png`), fullPage: true });
  }

  try {
    const response = await page.request.post('http://localhost:3000/api/halls', { data: { title: 'San Diego day trip', scenario: 'san-diego' } });
    if (!response.ok()) throw new Error(`Hall creation failed: ${response.status()}`);
    const { token } = await response.json();
    await page.goto(`http://localhost:3000/h/${token}`);
    await page.getByRole('heading', { name: 'San Diego day trip' }).waitFor();
    await page.getByRole('button', { name: 'Travelers' }).click();

    for (const width of [320, 390, 768, 1024, 1440]) await check(width, 'agent');

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.getByRole('button', { name: 'Sample replay' }).click();
    await page.locator('.phase-badge').getByText('Agreed').waitFor({ timeout: 30000 });
    await page.getByRole('button', { name: 'Plan', exact: true }).click();
    for (const width of [320, 390, 768, 1024, 1440]) await check(width, 'board');

    if (errors.length) throw new Error(`Browser errors: ${errors.join(' | ')}`);
    console.log(JSON.stringify({ result: 'pass', widths: [320, 390, 768, 1024, 1440], rooms: ['agent', 'board'], errors }));
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
