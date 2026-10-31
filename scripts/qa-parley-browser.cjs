const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.EDGE_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const output = path.join(process.cwd(), 'artifacts', 'parley');
  fs.mkdirSync(output, { recursive: true });
  const checkWidth = async width => {
    await page.setViewportSize({ width, height: 900 });
    const dimensions = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth }));
    if (dimensions.document > dimensions.viewport + 1) throw new Error(`${width}px horizontal overflow: ${dimensions.document}`);
  };

  try {
    await page.goto('http://localhost:3000/');
    await page.getByRole('button', { name: /Create Yosemite room/ }).click();
    await page.waitForURL(/\/invite\//);
    await page.getByRole('link', { name: /Enter chat/ }).click();
    await page.getByRole('heading', { name: 'Yosemite weekend' }).waitFor();
    const yosemiteUrl = page.url();
    await page.getByRole('button', { name: 'Travelers' }).click();
    for (const name of ['Alice', 'Parth', 'Aarsh', 'Maya']) await page.getByRole('heading', { name }).waitFor();
    await page.getByText('Private room required').waitFor();
    await page.getByRole('button', { name: 'Conversation' }).click();
    await page.screenshot({ path: path.join(output, 'yosemite-ready.png'), fullPage: true });
    await page.getByRole('button', { name: 'Try sample replay' }).click();
    await page.getByRole('log', { name: 'Messages and agent negotiation' }).getByText("$500 doesn't work. My hard cap is $420.").waitFor({ timeout: 30000 });
    await page.screenshot({ path: path.join(output, 'yosemite-negotiating.png'), fullPage: true });
    await page.locator('.phase-badge').getByText('Agreed').waitFor({ timeout: 60000 });
    await page.getByRole('button', { name: 'Plan', exact: true }).click();
    const history = page.locator('.plan-history li');
    if (await history.count() !== 3) throw new Error('Initial negotiation did not create three plan versions.');
    for (const cost of ['$500', '$430', '$410']) await history.getByText(cost).waitFor();
    await page.screenshot({ path: path.join(output, 'yosemite-v3.png'), fullPage: true });
    await page.getByRole('button', { name: /Draft Alice’s \$400 message/ }).click();
    if (await page.getByRole('textbox', { name: 'Discussion message' }).inputValue() !== 'Actually, I can only do $400.') throw new Error('The budget-change draft was not prepared.');
    await page.getByRole('button', { name: /Send/ }).click();
    await page.getByRole('button', { name: /Confirm private stay/ }).waitFor({ timeout: 30000 });
    await page.getByText('My hard cap is now $400.').waitFor();
    await page.getByRole('button', { name: 'Plan', exact: true }).click();
    if (await page.locator('.plan-history li').count() !== 4) throw new Error('Alice’s message did not create plan v4.');
    await page.locator('.plan-history').getByText('$390').waitFor();
    await page.screenshot({ path: path.join(output, 'yosemite-v4-confirm.png'), fullPage: true });
    await page.getByRole('button', { name: /Confirm private stay/ }).click();
    await page.locator('.phase-badge').getByText('Agreed').waitFor({ timeout: 30000 });
    await page.getByText('4/4 accept').first().waitFor();
    await page.getByRole('button', { name: 'Conversation' }).click();
    await page.getByText('Plan v4 accepted by everyone.').waitFor();
    await page.screenshot({ path: path.join(output, 'yosemite-agreed.png'), fullPage: true });

    await page.getByRole('button', { name: '+ New' }).click();
    await page.locator('#new-trip-scenario').selectOption('san-diego');
    await page.getByRole('textbox', { name: 'Name this room' }).fill('San Diego day trip');
    await page.getByRole('button', { name: 'Create room' }).click();
    await page.getByRole('heading', { name: 'San Diego day trip' }).waitFor();
    if (page.url() === yosemiteUrl) throw new Error('Second room did not get its own URL.');
    await page.getByRole('button', { name: 'Travelers' }).click();
    await page.getByRole('heading', { name: 'Leo' }).waitFor();
    await page.getByRole('button', { name: 'Conversation' }).click();
    if (await page.getByText('Plan v4 accepted by everyone.').count()) throw new Error('Negotiation leaked into the second room.');
    for (const width of [1024, 1280, 1440]) await checkWidth(width);
    await page.goto(yosemiteUrl);
    await page.getByRole('heading', { name: 'Yosemite weekend' }).waitFor();
    await checkWidth(1440);
    await page.getByText('Plan v4 accepted by everyone.').waitFor();
    if (errors.length) throw new Error(`Page errors: ${errors.join(' | ')}`);
    console.log(JSON.stringify({ result: 'pass', versions: [500, 430, 410, 390], humanReplan: true, separateRooms: true, desktopWidths: [1024, 1280, 1440], errors }));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
