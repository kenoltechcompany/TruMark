/**
 * Adapted from screenappai/meeting-bot (MIT License) - src/lib/chromium.ts
 * Stripped of recording/ffmpeg flags and tuned for Google Meet anti-detection & idempotency.
 */
import { Browser, BrowserContext, Page } from 'playwright';
import { chromium } from 'playwright-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { config } from '../config';

const stealthPlugin = StealthPlugin();
stealthPlugin.enabledEvasions.delete('iframe.contentWindow');
stealthPlugin.enabledEvasions.delete('media.codecs');
chromium.use(stealthPlugin);

export interface BrowserSession {
  browser: Browser;
  context: BrowserContext;
  page: Page;
}

const DEFAULT_VIEWPORT = { width: 1280, height: 720 };

async function launchBrowserWithTimeout(
  launchFn: () => Promise<Browser>,
  timeoutMs: number,
  jobId: string,
): Promise<Browser> {
  let timeoutId: NodeJS.Timeout;
  let finished = false;

  return new Promise((resolve, reject) => {
    timeoutId = setTimeout(() => {
      if (!finished) {
        finished = true;
        reject(new Error(`[BrowserPool:${jobId}] Browser launch timed out after ${timeoutMs}ms`));
      }
    }, timeoutMs);

    launchFn()
      .then((result) => {
        if (!finished) {
          finished = true;
          clearTimeout(timeoutId);
          resolve(result);
        }
      })
      .catch((err) => {
        if (!finished) {
          finished = true;
          clearTimeout(timeoutId);
          reject(err);
        }
      });
  });
}

export class BrowserPool {
  /**
   * Launches an isolated, stealth-hardened browser context for Google Meet.
   * Each job gets its own incognito-like context so concurrent jobs never collide
   * and crashed/restarted jobs remain 100% idempotent.
   */
  public static async createGoogleMeetSession(jobId: string): Promise<BrowserSession> {
    const windowHeight = DEFAULT_VIEWPORT.height + 80;

    // Google Meet is sensitive to browser fingerprinting before admission.
    // Keep launch close to normal Chrome/Edge without fake media devices.
    const googleBrowserArgs: string[] = [
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-first-run-ui',
      '--disable-default-browser-promo',
      '--disable-default-apps',
      '--no-sandbox',
      '--disable-setuid-sandbox',
      `--window-size=${DEFAULT_VIEWPORT.width},${windowHeight}`,
      '--auto-accept-this-tab-capture',
      '--autoplay-policy=no-user-gesture-required',
    ];

    const ignoreDefaultArgs = ['--mute-audio', '--enable-automation'];

    console.log(
      `[BrowserPool:${jobId}] Launching stealth browser (channel: ${config.browserChannel || 'chromium'}, headless: ${config.headless})`,
    );

    const browser = await launchBrowserWithTimeout(
      () =>
        chromium.launch({
          headless: config.headless,
          ...(config.browserChannel ? { channel: config.browserChannel } : {}),
          handleSIGINT: false,
          handleSIGTERM: false,
          handleSIGHUP: false,
          args: googleBrowserArgs,
          ignoreDefaultArgs,
        }),
      60000,
      jobId,
    );

    const context = await browser.newContext({
      viewport: DEFAULT_VIEWPORT,
      ignoreHTTPSErrors: true,
    });

    const page = await context.newPage();

    browser.on('disconnected', () => {
      console.log(`[BrowserPool:${jobId}] Browser disconnected.`);
    });
    page.on('crash', () => {
      console.error(`[BrowserPool:${jobId}] Page crashed: ${page.url()}`);
    });

    return { browser, context, page };
  }

  public static async closeSession(session: Partial<BrowserSession> | null, jobId: string): Promise<void> {
    if (!session) return;
    try {
      if (session.page && !session.page.isClosed()) {
        await session.page.close().catch(() => {});
      }
      if (session.context) {
        await session.context.close().catch(() => {});
      }
      if (session.browser?.isConnected()) {
        await session.browser.close().catch(() => {});
      }
    } catch (err: any) {
      console.warn(`[BrowserPool:${jobId}] Non-fatal cleanup error: ${err?.message || err}`);
    }
  }
}
