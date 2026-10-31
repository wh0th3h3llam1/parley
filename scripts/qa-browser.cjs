const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.EDGE_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
  });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, permissions: ['clipboard-read', 'clipboard-write'] });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const output = path.join(process.cwd(), 'artifacts');
  fs.mkdirSync(output, { recursive: true });
  try {
    await page.goto('http://localhost:3000/');
    await page.screenshot({ path: path.join(output, 'welcome.png'), fullPage: true });
    const legacy = await page.request.post('http://localhost:3000/api/halls', { data: { title: 'San Diego day trip', scenario: 'san-diego' } });
    if (!legacy.ok()) throw new Error('San Diego room creation failed');
    const { token } = await legacy.json();
    await page.goto(`http://localhost:3000/invite/${token}`);
    await page.waitForURL(/\/invite\//);
    await page.waitForFunction(() => document.querySelector('#hall-url')?.value.length > 40);
    const invite = await page.locator('#hall-url').inputValue();
    await page.locator('#hall-url').evaluate(input => { input.value = 'http://localhost:3000/h/[private demo token]'; });
    await page.screenshot({ path: path.join(output, 'invitation.png'), fullPage: true });
    await page.locator('#hall-url').evaluate((input, value) => { input.value = value; }, invite);
    await page.getByRole('button', { name: /Copy link/i }).click();
    await page.getByRole('button', { name: /Copied/i }).waitFor();
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    if (copied !== invite) throw new Error('Invitation copy did not match displayed URL');
    await page.getByRole('link', { name: /Enter chat/i }).click();
    await page.waitForURL(/\/h\//);
    await page.getByRole('heading', { name: 'San Diego day trip' }).waitFor();
    await page.screenshot({ path: path.join(output, 'hall-desktop.png'), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: path.join(output, 'hall-mobile.png'), fullPage: true });
    await page.setViewportSize({ width: 1440, height: 900 });
    const second = await context.newPage();
    await second.goto('http://localhost:3000/');
    await second.getByRole('button', { name: /Join with a link/i }).click();
    await second.locator('#invite-link').fill(invite);
    await second.getByRole('button', { name: 'Enter', exact: true }).click();
    await second.getByRole('heading', { name: 'San Diego day trip' }).waitFor();
    await second.close();
    await page.getByRole('button', { name: 'Travelers' }).click();
    const leo = page.locator('.traveler-card').filter({ has: page.getByRole('heading', { name: 'Leo' }) });
    await leo.locator('input:not([type])').fill('Quiet beach time');
    await page.waitForTimeout(1800);
    await leo.getByRole('button', { name: /Save preferences/i }).click();
    await page.reload();
    await page.getByRole('heading', { name: 'San Diego day trip' }).waitFor();
    await page.getByRole('button', { name: 'Travelers' }).click();
    if (await page.locator('.traveler-card').filter({ has: page.getByRole('heading', { name: 'Leo' }) }).locator('input:not([type])').inputValue() !== 'Quiet beach time') throw new Error('Traveler preference did not persist');
    await page.getByRole('button', { name: 'Sample replay' }).click();
    await page.getByText('4/4 accept').waitFor({ timeout: 30000 });
    await page.waitForFunction(() => document.querySelector('.phase-badge')?.textContent === 'Agreed');
    await page.getByRole('button', { name: 'Conversation' }).click();
    await page.locator('.agent-message').first().waitFor();
    await page.getByRole('button', { name: 'Plan', exact: true }).click();
    await page.getByText('$128').first().waitFor();
    await page.screenshot({ path: path.join(output, 'plan-before.png'), fullPage: true });
    await page.locator('#leo-budget').fill('90');
    await page.getByRole('button', { name: /Reduce & sample replay/i }).click();
    await page.getByRole('button', { name: /Confirm revised budget/i }).click({ timeout: 30000 });
    await page.getByText('$56').first().waitFor({ timeout: 30000 });
    await page.waitForFunction(() => document.querySelector('.phase-badge')?.textContent === 'Agreed');
    await page.reload();
    await page.getByRole('button', { name: 'Plan', exact: true }).click();
    await page.getByText('$56').first().waitFor();
    await page.screenshot({ path: path.join(output, 'plan-after.png'), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('button', { name: /Negotiation status/i }).click();
    await page.getByText('4/4 accept').first().waitFor();
    await page.screenshot({ path: path.join(output, 'plan-mobile.png'), fullPage: true });
    console.log(JSON.stringify({ result: 'pass', copy: true, secondTab: true, before: 128, after: 56, humanConfirmation: true, errors, screenshots: ['welcome.png', 'invitation.png', 'hall-desktop.png', 'hall-mobile.png', 'plan-before.png', 'plan-after.png', 'plan-mobile.png'] }));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
