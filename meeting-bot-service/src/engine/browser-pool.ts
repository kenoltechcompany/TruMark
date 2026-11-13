/**
 * Adapted from screenappai/meeting-bot (MIT License) - src/lib/chromium.ts
 * Powered by patchright to eliminate CDP Runtime.enable fingerprinting.
 */
import { Browser, BrowserContext, Page, chromium } from 'patchright';
import { config } from '../config';

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
   * Launches an isolated, patchright stealth browser context for Google Meet.
   * Each job gets its own context so concurrent jobs never collide and crashed
   * or restarted jobs remain 100% idempotent.
   */
  public static async createGoogleMeetSession(jobId: string): Promise<BrowserSession> {
    const windowHeight = DEFAULT_VIEWPORT.height + 80;

    const googleBrowserArgs: string[] = [
      '--disable-blink-features=AutomationControlled',
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
      `[BrowserPool:${jobId}] Launching patchright browser (channel: ${config.browserChannel || 'chromium'}, headless: ${config.headless})`,
    );

    const launchWithChannel = (channel?: string) =>
      launchBrowserWithTimeout(
        () =>
          chromium.launch({
            headless: config.headless,
            ...(channel ? { channel } : {}),
            handleSIGINT: false,
            handleSIGTERM: false,
            handleSIGHUP: false,
            args: googleBrowserArgs,
            ignoreDefaultArgs,
          }),
        60000,
        jobId,
      );

    let browser: Browser;
    try {
      browser = await launchWithChannel(config.browserChannel || undefined);
    } catch (err: any) {
      if (config.browserChannel) {
        console.warn(
          `[BrowserPool:${jobId}] Channel "${config.browserChannel}" failed (${err?.message || err}); falling back to bundled chromium...`,
        );
        browser = await launchWithChannel(undefined);
      } else {
        throw err;
      }
    }

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
