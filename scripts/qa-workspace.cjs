const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.EDGE_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const output = path.join(process.cwd(), 'artifacts', 'workspace');
  fs.mkdirSync(output, { recursive: true });
  const checkWidth = async width => {
    await page.setViewportSize({ width, height: 900 });
    const dimensions = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth }));
    if (dimensions.document > dimensions.viewport + 1) throw new Error(`${width}px horizontal overflow: ${dimensions.document}`);
  };

  try {
    await page.goto('http://localhost:3000/');
    const legacy = await page.request.post('http://localhost:3000/api/halls', { data: { title: 'San Diego day trip', scenario: 'san-diego' } });
    if (!legacy.ok()) throw new Error('San Diego room creation failed');
    const { token } = await legacy.json();
    await page.goto(`http://localhost:3000/invite/${token}`);
    await page.waitForURL(/\/invite\//);
    await page.getByRole('link', { name: /Enter chat/i }).click();
    await page.getByRole('heading', { name: 'San Diego day trip' }).waitFor();
    const firstUrl = page.url();
    await page.getByRole('textbox', { name: 'Discussion message' }).fill('Morning plans work for me.');
    await page.getByRole('button', { name: 'Send', exact: false }).click();
    await page.getByRole('log', { name: 'Messages and agent negotiation' }).getByText('Morning plans work for me.').waitFor();
    await page.screenshot({ path: path.join(output, 'conversation-empty-desktop.png'), fullPage: true });

    await page.getByRole('button', { name: '+ New' }).click();
    await page.getByRole('textbox', { name: 'Name this room' }).fill('Weekend with friends');
    await page.getByRole('button', { name: 'Create room' }).click();
    await page.getByRole('heading', { name: 'Weekend with friends' }).waitFor();
    const secondUrl = page.url();
    if (secondUrl === firstUrl) throw new Error('New trip did not get a separate hall');
    await page.reload();
    await page.getByRole('heading', { name: 'Weekend with friends' }).waitFor();
    await page.getByRole('navigation', { name: 'Recent rooms' }).getByRole('link').nth(1).waitFor();
    await page.getByRole('navigation', { name: 'Recent rooms' }).getByRole('link', { name: /San Diego day trip/ }).click();
    await page.getByRole('heading', { name: 'San Diego day trip' }).waitFor();
    await page.getByRole('log', { name: 'Messages and agent negotiation' }).getByText('Morning plans work for me.').waitFor();

    await page.getByRole('button', { name: 'Try sample replay' }).click();
    await page.locator('.agent-message').first().waitFor({ timeout: 30000 });
    await page.screenshot({ path: path.join(output, 'conversation-live-desktop.png'), fullPage: true });
    const chronological = await page.evaluate(() => {
      const human = document.querySelector('.human-message');
      const agent = document.querySelector('.agent-message');
      return Boolean(human && agent && human.compareDocumentPosition(agent) & Node.DOCUMENT_POSITION_FOLLOWING);
    });
    if (!chronological) throw new Error('Human and agent messages are out of order');
    await page.getByRole('navigation', { name: 'Recent rooms' }).getByRole('link', { name: /Weekend with friends/ }).click();
    await page.getByRole('heading', { name: 'Weekend with friends' }).waitFor();
    await page.getByRole('navigation', { name: 'Recent rooms' }).getByRole('link', { name: /San Diego day trip/ }).click();
    await page.getByRole('heading', { name: 'San Diego day trip' }).waitFor();
    await page.locator('.phase-badge').getByText('Agreed').waitFor({ timeout: 30000 });
    const mobileDirect = await context.newPage();
    await mobileDirect.setViewportSize({ width: 390, height: 844 });
    await mobileDirect.goto(firstUrl);
    await mobileDirect.locator('.phase-badge').getByText('Agreed').waitFor();
    await mobileDirect.waitForTimeout(300);
    const directScroll = await mobileDirect.locator('.conversation-thread').evaluate(node => ({ top: node.scrollTop, end: node.scrollHeight - node.clientHeight }));
    if (directScroll.end > 0 && directScroll.end - directScroll.top > 100) throw new Error(`Agreed conversation opened above the latest exchange: ${JSON.stringify(directScroll)}`);
    await mobileDirect.screenshot({ path: path.join(output, 'conversation-agreed-mobile-direct.png'), fullPage: true });
    await mobileDirect.close();
    await page.getByRole('button', { name: 'Plan', exact: true }).click();
    await page.getByText('$128').first().waitFor();
    await page.screenshot({ path: path.join(output, 'plan-desktop.png'), fullPage: true });
    await page.getByRole('button', { name: 'Travelers' }).click();
    await page.getByRole('heading', { name: 'Your travelers.' }).waitFor();

    await page.getByRole('button', { name: 'Conversation' }).click();
    await checkWidth(390);
    await page.screenshot({ path: path.join(output, 'conversation-agreed-mobile.png'), fullPage: true });
    await page.getByRole('button', { name: /Show rooms/ }).click();
    await page.screenshot({ path: path.join(output, 'trip-list-mobile.png'), fullPage: true });
    await page.getByRole('navigation', { name: 'Recent rooms' }).getByRole('link', { name: /Weekend with friends/ }).click();
    await page.getByRole('heading', { name: 'Weekend with friends' }).waitFor();
    if (await page.getByRole('log', { name: 'Messages and agent negotiation' }).getByText('Morning plans work for me.').count()) throw new Error('Messages leaked across trips');
    await page.screenshot({ path: path.join(output, 'conversation-mobile.png'), fullPage: true });
    for (const width of [320, 390, 768, 1024, 1440, 1920]) {
      await checkWidth(width);
      if (width === 320) await page.screenshot({ path: path.join(output, 'conversation-320.png'), fullPage: true });
    }
    await page.screenshot({ path: path.join(output, 'conversation-wide.png'), fullPage: true });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.getByRole('navigation', { name: 'Recent rooms' }).getByRole('link', { name: /San Diego day trip/ }).click();
    await page.locator('.chat-message').first().waitFor();
    const motionDuration = await page.locator('.chat-message').first().evaluate(node => getComputedStyle(node).animationDuration);
    if (parseFloat(motionDuration) > 0.001) throw new Error(`Reduced motion ignored: ${motionDuration}`);
    if (errors.length) throw new Error(`Page errors: ${errors.join(' | ')}`);
    console.log(JSON.stringify({ result: 'pass', separateTrips: true, messagesIsolated: true, agentEventsLive: true, widths: [320, 390, 768, 1024, 1440, 1920], errors }));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
