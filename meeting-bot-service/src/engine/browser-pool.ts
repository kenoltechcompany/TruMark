import { chromium, BrowserContext } from 'playwright';
import { existsSync, mkdirSync } from 'node:fs';
import { config } from '../config';

export class BrowserPool {
  public static async createContext(): Promise<BrowserContext> {
    const profilePath = config.profileDir;
    if (!existsSync(profilePath)) {
      mkdirSync(profilePath, { recursive: true });
    }

    console.log(`[BrowserPool] Launching persistent context using channel: ${config.browserChannel}, headless: ${config.headless}, profile: ${profilePath}`);

    const context = await chromium.launchPersistentContext(profilePath, {
      channel: config.browserChannel as any,
      headless: config.headless,
      args: [
        '--disable-blink-features=AutomationControlled',
        '--use-fake-ui-for-media-stream',
        '--use-fake-device-for-media-stream',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--window-size=1280,720',
        '--autoplay-policy=no-user-gesture-required',
      ],
      viewport: { width: 1280, height: 720 },
      permissions: ['camera', 'microphone'],
    });

    // Mask webdriver property
    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
      });
    });

    return context;
  }

  public static async closeAll(): Promise<void> {
    // Persistent contexts are closed per adapter
  }
}
