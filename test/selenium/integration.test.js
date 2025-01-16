import 'dotenv/config';
import { Builder, By, Key, until } from 'selenium-webdriver';
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { TOTP } from 'totp-generator';
import chrome from 'selenium-webdriver/chrome';
import edge from 'selenium-webdriver/edge';
import firefox from 'selenium-webdriver/firefox';
import { globSync } from 'node:fs';

// TODO get coverage working with jest+selenium
// Merge coverage like https://stackoverflow.com/questions/62560224/jest-how-to-merge-coverage-reports-from-different-jest-test-runs

/**
 * Test cases:
 * - maybe setup new AWS accounts for this?
 * - assumerolewithsaml
 * - login profile
 * - however it is that aws-vault signs in
 *
 * - billing page
 * - opening new tabs by cmd-clicking
 * - opening new tabs by regular clicking (e.g. on links that open in a new tab, like in IAM/EC2)
 * - clearing storage works
 * -
 */

describe('selenium', () => {
  let driver = null;

  beforeAll(async () => {
    if (process.env.SELENIUM_BROWSER === 'opera') {
      const operaService = new chrome.ServiceBuilder(process.env.OPERA_DRIVER_PATH).build();
      await operaService.start();

      const safariOptions = new chrome.Options();
      safariOptions.addExtensions(globSync('build/opera-*.zip'));

      const googOptions = safariOptions.get('goog:chromeOptions');
      googOptions.w3c = true;
      safariOptions.set('goog:chromeOptions', googOptions);

      driver = new Builder()
        .disableEnvironmentOverrides()
        .usingServer(await operaService.address())
        .setChromeOptions(safariOptions)
        .build();
    } else {
      driver = new Builder()
        .setChromeOptions(new chrome.Options().addExtensions(globSync('build/chrome-*.zip')))
        .setFirefoxOptions(new firefox.Options().addExtensions(globSync('build/firefox-*.zip')))
        .setEdgeOptions(new edge.Options().addExtensions(globSync('build/edge-*.zip')))
        .build();
    }
  });

  afterAll(async () => {
    if (driver !== null) {
      await driver.quit();
    }
  });

  const sleep = (milliseconds) =>
    new Promise((resolve) => {
      setTimeout(resolve, milliseconds);
    });

  const loginAsRoot = async (email, password, totp) => {
    // Navigate to sign in page and click the "root sign in button"
    await driver.get('https://console.aws.amazon.com/console/home');
    const rootSignInButton = await driver.findElement(By.id('root_account_signin'));
    await driver.wait(until.elementIsVisible(rootSignInButton));
    await rootSignInButton.click();

    // Enter email address
    const emailInput = driver.findElement(By.id('resolving_input'));
    await driver.wait(until.elementIsVisible(emailInput));
    await emailInput.sendKeys(email, Key.RETURN);

    // Enter password
    const passwordInput = await driver.findElement(By.id('password'));
    await driver.wait(until.elementIsVisible(passwordInput));
    await passwordInput.sendKeys(password, Key.RETURN);

    // Enter 2fa and submit
    const mfaInput = await driver.findElement(By.id('mfaCode'));
    await driver.wait(until.elementIsVisible(mfaInput));
    await mfaInput.sendKeys(totp, Key.RETURN);
    await driver.findElement(By.id('mfa_submit_button')).click();
  };

  const sessionData = async () => {
    const data = await driver.findElement(By.name('awsc-session-data'))
    const content = await data.getProperty('content')
    return JSON.parse(content);
  }

  it('works end-to-end', async () => {
    expect.hasAssertions();

    await loginAsRoot(
      process.env.AWS_ROOT_EMAIL,
      process.env.AWS_ROOT_PASSWORD,
      TOTP.generate(process.env.AWS_ROOT_TOTP).otp,
    );

    await sleep(3000);
    // After clearing all cookies and refreshing we should still be logged in
    await driver.manage().deleteAllCookies();
    await driver.navigate().refresh();
    
    const session = await sessionData();

    expect(session.accountId).toBe(process.env.AWS_ACCOUNT_ID)
  });
});
