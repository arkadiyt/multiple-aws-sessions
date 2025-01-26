import { globSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { Builder } from 'selenium-webdriver';
import chrome from 'selenium-webdriver/chrome';
import edge from 'selenium-webdriver/edge';
import firefox from 'selenium-webdriver/firefox';
import http from 'node:http';
import { join } from 'node:path';
import proxy from 'selenium-webdriver/proxy';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';

export const startLoggingServer = () => {
  // Can't open the background page inspector window in chromium in Selenium, so create a server which
  // listens for logs from the background service worker
  const server = http.createServer(async (req, res) => {
    let body = '';
    for await (const chunk of req) {
      body += chunk;
    }
    console.warn('Background page: ', ...JSON.parse(body));
    res.writeHead(200);
    res.end();
  });
  server.listen({ host: 'localhost', port: 8000 });
  return server;
};

export const startBrowser = async () => {
  const proxyOpts = proxy.manual({ http: process.env.PROXY, https: process.env.PROXY });

  // Opera
  if (process.env.SELENIUM_BROWSER === 'opera') {
    const operaService = new chrome.ServiceBuilder(process.env.OPERA_DRIVER_PATH).build();
    await operaService.start();

    const safariOptions = new chrome.Options();
    safariOptions.addExtensions(globSync('build/opera-*.zip'));

    const googOptions = safariOptions.get('goog:chromeOptions');
    googOptions.w3c = true;
    safariOptions.set('goog:chromeOptions', googOptions);

    if (process.env.PROXY) {
      safariOptions.setProxy(proxyOpts);
    }

    return new Builder()
      .disableEnvironmentOverrides()
      .usingServer(await operaService.address())
      .setChromeOptions(safariOptions)
      .build();
  }

  // Chrome/Firefox/Edge
  if (process.env.SELENIUM_BROWSER === 'edge') {
    process.env.SELENIUM_BROWSER = 'MicrosoftEdge';
  }

  const chromeOptions = new chrome.Options().addExtensions(globSync('build/chrome-*.zip'));
  const firefoxOptions = new firefox.Options();
  const edgeOptions = new edge.Options().addExtensions(globSync('build/edge-*.zip'));

  if (process.env.PROXY) {
    chromeOptions.setProxy(proxyOpts);
    firefoxOptions.setProxy(proxyOpts);
    edgeOptions.setProxy(proxyOpts);
  }

  const driver = new Builder()
    .setChromeOptions(chromeOptions)
    .setFirefoxOptions(firefoxOptions)
    .setEdgeOptions(edgeOptions)
    .build();

  if (process.env.SELENIUM_BROWSER === 'firefox') {
    // Firefox doesn't support `new firefox.Options().addExtensions(...)`
    // https://github.com/mozilla/geckodriver/issues/1476
    await driver.installAddon(globSync('build/firefox-*.zip')[0], true);
  }

  return driver;
};

export const fetchCoverage = async (driver) => {
  const { pageCoverage, backgroundCoverage } = await driver.executeScript('return _MAS.fetchCoverage();');

  writeFileSync(
    `coverage/coverage-${process.env.SELENIUM_BROWSER}-background.json`,
    JSON.stringify(backgroundCoverage),
  );
  const tmpDir = mkdtempSync(join(tmpdir(), 'mas-'));
  for (const [key, val] of Object.entries(pageCoverage)) {
    writeFileSync(join(tmpDir, `${key}.json`), JSON.stringify(val));
  }
  spawnSync('npx', ['nyc', 'merge', tmpDir, `coverage/coverage-${process.env.SELENIUM_BROWSER}-pages.json`]);
  rmSync(tmpDir, { recursive: true });
};
