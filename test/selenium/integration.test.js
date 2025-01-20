/**
 * @jest-environment steps
 */

import 'dotenv/config';
import { AssumeRoleCommand, STSClient } from '@aws-sdk/client-sts';
import { Builder, By, Key, until } from 'selenium-webdriver';
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { globSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { TOTP } from 'totp-generator';
import chrome from 'selenium-webdriver/chrome';
import edge from 'selenium-webdriver/edge';
import firefox from 'selenium-webdriver/firefox';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';

/**
 * Login methods:
 * - maybe setup new AWS accounts for this? add instructions for aws account setup (can do local saml signing, no need for okta)
 *   - add terraform bootstrap for minimum resources, and it outputs the .env file you need
 * - assumerolewithsaml
 * - login profile
 *
 * Done-ish:
 * root user
 * aws-vault (federation)
 *
 * Tests:
 * - billing page
 */

const IAM_USER_NAME = 'read-only';

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
    if (driver === null) {
      return;
    }

    // TODO not getting content script coverage for some reason?

    // Fetch the test coverage data before we quit
    try {
      const { pageCoverage, backgroundCoverage } = await driver.executeScript('return fetchCoverage();');

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
    } finally {
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
    const rootSignInButton = await $('#root_account_signin');
    await rootSignInButton.click();

    // Enter email address
    const emailInput = await $('#resolving_input');
    await emailInput.sendKeys(email, Key.RETURN);

    // Enter password
    const passwordInput = await $('#password');
    await passwordInput.sendKeys(password, Key.RETURN);

    // Enter 2fa and submit
    const mfaInput = await $('#mfaCode');
    await mfaInput.sendKeys(totp, Key.RETURN);
    const submit = await $('#mfa_submit_button');
    await submit.click();
  };

  // TODO Only works like 1 in 10 times :(
  const loginAsIAMUser = async (accessKeyId, secretAccessKey, targetRoleArn, mfaSerial, totp) => {
    const client = new STSClient({
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });

    const assumeRole = await client.send(
      new AssumeRoleCommand({
        RoleArn: targetRoleArn,
        RoleSessionName: 'selenium',
        SerialNumber: mfaSerial,
        TokenCode: totp,
      }),
    );

    const payload = JSON.stringify({
      sessionId: assumeRole.Credentials.AccessKeyId,
      sessionKey: assumeRole.Credentials.SecretAccessKey,
      sessionToken: assumeRole.Credentials.SessionToken,
    });

    const url = new URL('https://signin.aws.amazon.com/federation');
    url.searchParams.set('Action', 'getSigninToken');
    url.searchParams.set('Session', payload);

    const result = await fetch(url, { method: 'POST' });
    const signInToken = JSON.parse(await result.text()).SigninToken;

    url.searchParams.set('Action', 'login');
    url.searchParams.set('SigninToken', signInToken);
    url.searchParams.set('Destination', 'https://us-east-1.console.aws.amazon.com/console/home');
    await driver.get(url.href);
  };

  const $ = async (selector, tree) => {
    if (typeof tree === 'undefined') {
      tree = driver;
    }
    const search = typeof selector === 'string' ? By.css(selector) : selector;
    // Can only wait on top level but that might return the wrong element
    // Could switch this to a javascript implementation
    await driver.wait(until.elementLocated(search), 5000);
    return tree.findElement(search);
  };

  const sessionData = async () => {
    try {
      const data = await $(By.name('awsc-session-data'));
      const content = await data.getProperty('content');
      return JSON.parse(content);
    } catch {
      return {};
    }
  };

  const cmdClickLink = (link) => driver.executeScript('cmdClickLink(arguments[0])', link);

  const newHandle = (existingHandles, newHandles) =>
    new Set(newHandles).difference(new Set(existingHandles)).values().next().value;

  it('signs in using login federation', async () => {
    /**
     * Regular IAM federation sign in as per:
     * https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles_providers_enable-console-custom-url.html
     * After signing in successfully, clear all cookies and refresh the page, and we should still be
     * signed in
     */
    expect.hasAssertions();

    loginAsIAMUser(
      process.env.AWS_USER_ACCESS_KEY_ID,
      process.env.AWS_USER_SECRET_ACCESS_KEY,
      process.env.AWS_USER_TARGET_ROLE_ARN,
      process.env.AWS_USER_MFA_SERIAL,
      TOTP.generate(process.env.AWS_USER_TOTP).otp,
    );

    await sleep(5000);

    // Clear cookies and refresh, should still be logged in
    await driver.manage().deleteAllCookies();
    await driver.navigate().refresh();
    await sleep(5000);
    const session = await sessionData();

    expect(session.accountId).toBe(process.env.AWS_ACCOUNT_ID);
  });

  it('does not have a session on a new tab', async () => {
    /**
     * Opening a new tab manually (not by clicking a link that opens a tab) should _not_
     * carry over any cookies. If you navigate to AWS you should be signed out
     */
    expect.hasAssertions();

    const originalTab = await driver.getWindowHandle();
    await driver.switchTo().newWindow('tab');
    await driver.get('https://us-east-1.console.aws.amazon.com/console/home');
    const session = await sessionData();

    expect(session).toStrictEqual({});

    await driver.close();
    await driver.switchTo().window(originalTab);
  });

  it('can open new tabs from the existing tab with cmd clicks', async () => {
    /**
     * On the IAM user list page: https://us-east-1.console.aws.amazon.com/iam/home#/users
     * Do a cmd+click on the IAM user and ensure that we open in a new tab and the new tab gets the same cookies
     * as the existing one
     */
    expect.hasAssertions();

    await driver.get('https://us-east-1.console.aws.amazon.com/iam/home#/users');

    const link = await $(`a[href="#/users/details/${IAM_USER_NAME}"]`);
    const handles = await driver.getAllWindowHandles();
    await cmdClickLink(link);
    await driver.wait(async () => (await driver.getAllWindowHandles()).length === handles.length + 1, 5000);
    const session = await sessionData();

    expect(session.accountId).toBe(process.env.AWS_ACCOUNT_ID);

    // Need to explicitly switch even though the new tab became active
    await driver.switchTo().window(newHandle(handles, await driver.getAllWindowHandles()));
    const div = await $('div[data-analytics="userDetailsHeader"]');
    const userName = await $(By.tagName('h1'), div);

    await expect(userName.getText()).resolves.toBe(IAM_USER_NAME);
  });

  it('can open new tabs from the existing tab with regular clicks', async () => {
    /**
     * On the IAM user detail page, the policy permission links have target="_blank" / will open in a new tab
     * Check that this form of new tab open gets the same cookies as the original tab
     */
    expect.hasAssertions();

    const span = await $('span[data-testid="policy-name-column"]');
    const link = await $(By.tagName('a'), span);
    const handles = await driver.getAllWindowHandles();
    await link.click();
    await driver.wait(async () => (await driver.getAllWindowHandles()).length === handles.length + 1, 5000);

    // Need to explicitly switch even though the new tab became active
    await driver.switchTo().window(newHandle(handles, await driver.getAllWindowHandles()));

    const div = await $('div[data-analytics="PolicyDetailsHeader"]');
    const header = await $(By.tagName('h1'), div);

    await expect(header.getText()).resolves.toBe('ReadOnlyAccess');

    await driver.close();
    await driver.switchTo().window(handles[0]);
  });

  // it.todo('signs in using AssumeRoleWithSAML')
  // it.todo('signs in using the root user', async () => {
  //   await loginAsRoot(
  //     process.env.AWS_ROOT_EMAIL,
  //     process.env.AWS_ROOT_PASSWORD,
  //     TOTP.generate(process.env.AWS_ROOT_TOTP).otp,
  //   );

  //   // After clearing all cookies and refreshing we should still be logged in
  //   await driver.manage().deleteAllCookies();
  //   await driver.navigate().refresh();

  //   const session = await sessionData();

  //   // TODO make more specific / check against root
  //   console.log(session);
  //   expect(session.accountId).toBe(process.env.AWS_ACCOUNT_ID);
  // });
  // it.todo('signs in using an IAM Login Profile');
});
