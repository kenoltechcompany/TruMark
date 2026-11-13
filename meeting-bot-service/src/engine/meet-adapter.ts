/**
 * Adapted from screenappai/meeting-bot (MIT License) - src/bots/GoogleMeetBot.ts
 * Stripped of recording/upload logic; focuses on stealth joining, lobby admission,
 * post-join modal dismissal, and reliable participant roster scraping.
 */
import { Page } from 'patchright';
import { BrowserPool, BrowserSession } from './browser-pool';

const GOOGLE_REQUEST_DENIED = 'Someone in the call denied your request to join';
const GOOGLE_REQUEST_TIMEOUT = 'No one responded to your request to join the call';
const GOOGLE_LOBBY_MODE_HOST_TEXT = 'Please wait until a meeting host brings you';

const RISKY_DISPLAY_NAME_PATTERNS: Array<[RegExp, string]> = [
  [/\b(?:ai[\s-]+)?note[\s-]*taker\b/gi, 'AI Notes'],
  [/\bbot\b/gi, 'Assistant'],
  [/\brobot\b/gi, 'Assistant'],
];

export function sanitizeGoogleMeetDisplayName(name?: string): string {
  let displayName = name?.trim() || 'TruMark Attendance';
  for (const [pattern, replacement] of RISKY_DISPLAY_NAME_PATTERNS) {
    displayName = displayName.replace(pattern, replacement);
  }
  displayName = displayName
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .trim();
  return displayName || 'TruMark Attendance';
}

async function retryActionWithWait<T>(
  actionName: string,
  action: () => Promise<T>,
  attempts = 3,
  waitMs = 5000,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await action();
    } catch (err) {
      lastError = err;
      if (attempt < attempts) {
        console.warn(`[GoogleMeetAdapter] Retry ${attempt}/${attempts} on "${actionName}"`);
        await new Promise((r) => setTimeout(r, waitMs));
      }
    }
  }
  throw lastError;
}

export interface MeetBotCallbacks {
  onStatusChange: (
    status: 'READY' | 'WAITING_PERMISSION' | 'JOINED' | 'FAILED',
    message?: string,
  ) => void;
}

export class GoogleMeetAdapter {
  private session: BrowserSession | null = null;
  private page: Page | null = null;
  private isJoined = false;
  private isClosed = false;
  private readonly botDisplayName: string;

  constructor(
    private readonly jobId: string,
    private readonly meetingUrl: string,
    rawBotDisplayName: string,
    private readonly callbacks: MeetBotCallbacks,
  ) {
    this.botDisplayName = sanitizeGoogleMeetDisplayName(rawBotDisplayName);
  }

  public isAlive(): boolean {
    return (
      !this.isClosed &&
      Boolean(this.session?.browser?.isConnected()) &&
      Boolean(this.page && !this.page.isClosed())
    );
  }

  public async start(): Promise<void> {
    if (this.isClosed) return;

    console.log(
      `[GoogleMeetAdapter:${this.jobId}] Starting session for ${this.meetingUrl} as "${this.botDisplayName}"`,
    );

    try {
      this.session = await BrowserPool.createGoogleMeetSession(this.jobId);
      this.page = this.session.page;

      const maxJoinRequestAttempts = 2;
      let joinedMeeting = false;
      let lastBodyText = '';

      for (let attempt = 1; attempt <= maxJoinRequestAttempts; attempt++) {
        if (this.isClosed) return;

        console.log(
          `[GoogleMeetAdapter:${this.jobId}] Navigating to ${this.meetingUrl} (attempt ${attempt}/${maxJoinRequestAttempts})...`,
        );
        await this.page.goto(this.meetingUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

        await this.waitForPreJoinReady();

        const pageUrl = this.page.url();
        if (pageUrl.startsWith('https://accounts.google.com/')) {
          throw new Error('Meeting requires Google sign-in and blocks anonymous participants.');
        }

        const rawBodyText = await this.page.evaluate(() => document.body?.innerText || '').catch(() => '');
        const normalizedBodyText = rawBodyText.replace(/[\u2018\u2019]/g, "'");
        if (
          normalizedBodyText.includes("You can't join this video call") ||
          normalizedBodyText.includes('No one can join a meeting unless invited')
        ) {
          throw new Error("Google Meet blocked anonymous join: \"You can't join this video call\".");
        }

        // Fill display name if guest input is shown
        const nameInput = this.page.locator('input[type="text"]').first();
        await retryActionWithWait(
          'Wait for name input',
          async () => {
            await this.clickContinueWithoutDevicesIfPresent(1500);
            await nameInput.waitFor({ state: 'visible', timeout: 5000 });
          },
          1,
          1000,
        ).catch(() => {});

        if (await nameInput.isVisible().catch(() => false)) {
          await this.clickContinueWithoutDevicesIfPresent(1500);
          console.log(`[GoogleMeetAdapter:${this.jobId}] Entering display name: "${this.botDisplayName}"`);
          await nameInput.click({ timeout: 5000 });
          await nameInput.fill(this.botDisplayName);
          await this.page.waitForTimeout(300);
        }

        // Click Join / Ask to join using trusted Playwright pointer click first
        await retryActionWithWait(
          'Click Join / Ask to join',
          () => this.clickJoinButton(),
          3,
          3000,
        );

        await this.clickContinueWithoutDevicesIfPresent(2000);

        this.callbacks.onStatusChange(
          'WAITING_PERMISSION',
          'Requested entry to Google Meet. Waiting for host admission...',
        );

        const lobbyResult = await this.waitAtLobby(4 * 60 * 1000);
        if (lobbyResult.joined) {
          joinedMeeting = true;
          break;
        }

        lastBodyText = lobbyResult.bodyText || '';
        const deniedByHost =
          lastBodyText.includes(GOOGLE_REQUEST_DENIED) ||
          lastBodyText.includes("You can't join this video call") ||
          lastBodyText.includes('No one can join a meeting unless invited');

        if (deniedByHost || !lobbyResult.shouldRetry) {
          throw new Error(
            lobbyResult.reason ||
              'Unable to enter meeting: Host has not started the call, denied entry, or Quick Access requires admission.',
          );
        }
      }

      if (!joinedMeeting) {
        throw new Error('Google Meet bot could not enter the meeting after retries.');
      }

      this.isJoined = true;
      await this.postJoinCleanup();
      this.callbacks.onStatusChange('JOINED', 'Bot has joined the Google Meet session.');
    } catch (err: any) {
      if (!this.isClosed) {
        console.error(`[GoogleMeetAdapter:${this.jobId}] Join failed: ${err?.message || err}`);
        this.callbacks.onStatusChange('FAILED', err?.message || 'Unknown error joining meeting.');
      }
      await this.close();
    }
  }

  private async clickContinueWithoutDevicesIfPresent(timeout = 12000): Promise<boolean> {
    if (!this.page || this.page.isClosed()) return false;
    const btn = this.page
      .locator('button')
      .filter({
        hasText: /Continue without microphone and camera|Continue without microphone|Ohne Mikrofon und Kamera fortfahren/i,
      })
      .first();

    try {
      await btn.waitFor({ state: 'visible', timeout });
      console.log(`[GoogleMeetAdapter:${this.jobId}] Clicking "Continue without microphone and camera"...`);
      await btn.click({ timeout: 5000 });
      await this.page.waitForTimeout(800);
      return true;
    } catch {
      return false;
    }
  }

  private async waitForPreJoinReady(): Promise<void> {
    if (!this.page) return;

    const continueBtn = this.page
      .locator('button')
      .filter({
        hasText: /Continue without microphone and camera|Continue without microphone|Ohne Mikrofon und Kamera fortfahren/i,
      })
      .first();
    const nameInput = this.page.locator('input[type="text"]').first();
    const joinBtn = this.page
      .locator('button')
      .filter({ hasText: /^Ask to join$|^Join now$|^Join anyway$/i })
      .first();

    await Promise.race([
      continueBtn.waitFor({ state: 'visible', timeout: 15000 }).catch(() => {}),
      nameInput.waitFor({ state: 'visible', timeout: 15000 }).catch(() => {}),
      joinBtn.waitFor({ state: 'visible', timeout: 15000 }).catch(() => {}),
    ]);

    await this.clickContinueWithoutDevicesIfPresent(3000);

    await Promise.race([
      nameInput.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {}),
      joinBtn.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {}),
    ]);

    // Also dismiss any "Got it" dialog on pre-join if shown
    const gotIt = this.page.locator('button:has-text("Got it"), button:has-text("Dismiss")').first();
    if (await gotIt.isVisible().catch(() => false)) {
      await gotIt.click({ timeout: 3000 }).catch(() => {});
    }
  }

  private async muteMediaIfVisible(): Promise<void> {
    if (!this.page) return;
    const micBtn = this.page.locator('button[aria-label*="Turn off microphone" i]').first();
    if (await micBtn.isVisible().catch(() => false)) {
      await micBtn.click({ timeout: 2000 }).catch(() => {});
    }
    const camBtn = this.page.locator('button[aria-label*="Turn off camera" i]').first();
    if (await camBtn.isVisible().catch(() => false)) {
      await camBtn.click({ timeout: 2000 }).catch(() => {});
    }
  }

  private async clickJoinButton(): Promise<void> {
    if (!this.page || this.page.isClosed()) {
      throw new Error('Page closed before clicking join.');
    }

    // Use trusted Playwright pointer click first on exact join button labels
    const exactJoinBtn = this.page
      .locator('button')
      .filter({ hasText: /^Ask to join$|^Join now$|^Join anyway$/i })
      .first();
    try {
      await exactJoinBtn.waitFor({ state: 'visible', timeout: 5000 });
      if (await exactJoinBtn.isEnabled().catch(() => false)) {
        const label = (await exactJoinBtn.innerText().catch(() => 'Join')).trim();
        await exactJoinBtn.click({ timeout: 5000 });
        console.log(`[GoogleMeetAdapter:${this.jobId}] Clicked "${label}" via trusted locator click.`);
        return;
      }
    } catch {
      // Fall through to localized / regex patterns
    }

    const possibleTexts = [
      'Ask to join',
      'Join now',
      'Join anyway',
      'Teilnahme erbitten',
      'Jetzt teilnehmen',
    ];

    for (const text of possibleTexts) {
      const btn = this.page.locator('button', { hasText: new RegExp(text, 'i') }).first();
      if (
        (await btn.isVisible().catch(() => false)) &&
        (await btn.isEnabled().catch(() => false))
      ) {
        try {
          await btn.click({ timeout: 5000 });
          console.log(`[GoogleMeetAdapter:${this.jobId}] Clicked "${text}" via trusted locator click.`);
          return;
        } catch {
          // Fallback to DOM click if locator pointer click was intercepted
        }
      }

      const clickedByDom = await this.page
        .evaluate((buttonText) => {
          const buttons = Array.from(document.querySelectorAll('button'));
          const target = buttons.find((el) => {
            const rect = el.getBoundingClientRect();
            const visible = rect.width > 0 && rect.height > 0;
            return (
              visible &&
              !el.disabled &&
              (el.innerText || '').toLowerCase().includes(buttonText.toLowerCase())
            );
          });
          if (!target) return false;
          target.click();
          return true;
        }, text)
        .catch(() => false);

      if (clickedByDom) {
        console.log(`[GoogleMeetAdapter:${this.jobId}] Clicked "${text}" button via DOM fallback.`);
        return;
      }
    }

    throw new Error('Could not find visible "Ask to join" or "Join now" button.');
  }

  private async waitAtLobby(
    timeoutMs: number,
  ): Promise<{ joined: boolean; shouldRetry: boolean; reason?: string; bodyText?: string }> {
    if (!this.page) return { joined: false, shouldRetry: false, reason: 'No page instance' };

    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (this.isClosed || this.page.isClosed()) {
        return { joined: false, shouldRetry: false, reason: 'Bot session closed.' };
      }

      const currentUrl = this.page.url();
      if (currentUrl.startsWith('https://accounts.google.com/')) {
        const bodyText = await this.page.evaluate(() => document.body?.innerText || '').catch(() => '');
        return {
          joined: false,
          shouldRetry: false,
          reason: 'Redirected to Google Sign-In while waiting for admission.',
          bodyText,
        };
      }

      const state = await this.page
        .evaluate(
          ({ deniedConst, timeoutConst, lobbyConst }) => {
            const rawBodyText = document.body?.innerText || '';
            const bodyText = rawBodyText.replace(/\u2019/g, "'");

            if (
              bodyText.includes(deniedConst) ||
              bodyText.includes("You can't join this video call") ||
              bodyText.includes('No one can join a meeting unless invited') ||
              bodyText.includes('Asking to join was denied')
            ) {
              return { status: 'DENIED', bodyText };
            }

            if (bodyText.includes(timeoutConst)) {
              return { status: 'TIMEOUT', bodyText };
            }

            if (bodyText.includes(lobbyConst) || bodyText.includes('Asking to join')) {
              return { status: 'WAITING', bodyText: '' };
            }

            // Multi-signal in-call detection from screenappai/meeting-bot
            const peopleBtn = document.querySelector(
              'button[aria-label^="People"], button[aria-label*="Show everyone" i], button[aria-label*="People"]',
            );
            if (peopleBtn) {
              const label = peopleBtn.getAttribute('aria-label') || '';
              if (/People.*?\d+/i.test(label) || /Show everyone/i.test(label)) {
                return { status: 'JOINED', bodyText: '' };
              }
            }

            if (
              bodyText.includes('You have joined the call') ||
              bodyText.includes('other person in the call') ||
              bodyText.includes('people in the call')
            ) {
              return { status: 'JOINED', bodyText: '' };
            }

            const leaveBtn = document.querySelector(
              'button[aria-label*="Leave call" i], button[aria-label="Anruf verlassen"]',
            );
            if (
              leaveBtn &&
              !bodyText.includes('Asking to join') &&
              !bodyText.includes("You're the only one here")
            ) {
              return { status: 'JOINED', bodyText: '' };
            }

            return { status: 'WAITING', bodyText: '' };
          },
          {
            deniedConst: GOOGLE_REQUEST_DENIED,
            timeoutConst: GOOGLE_REQUEST_TIMEOUT,
            lobbyConst: GOOGLE_LOBBY_MODE_HOST_TEXT,
          },
        )
        .catch(() => ({ status: 'WAITING', bodyText: '' }));

      if (state.status === 'JOINED') {
        return { joined: true, shouldRetry: false };
      }

      if (state.status === 'DENIED') {
        return {
          joined: false,
          shouldRetry: false,
          reason:
            'Unable to enter meeting: The host has not started the call, Quick Access requires admission, or entry was denied.',
          bodyText: state.bodyText,
        };
      }

      if (state.status === 'TIMEOUT') {
        return {
          joined: false,
          shouldRetry: true,
          reason: 'No one responded to the join request.',
          bodyText: state.bodyText,
        };
      }

      await new Promise((r) => setTimeout(r, 2000));
    }

    return {
      joined: false,
      shouldRetry: true,
      reason: 'Timed out waiting for host admission.',
    };
  }

  private async postJoinCleanup(): Promise<void> {
    if (!this.page || this.page.isClosed()) return;
    try {
      // Click any visible "Got it" modals
      const gotItBtns = await this.page.locator('button:visible', { hasText: 'Got it' }).all();
      for (const btn of gotItBtns) {
        await btn.click({ timeout: 2000 }).catch(() => {});
        await this.page.waitForTimeout(300);
      }

      // Dismiss device notification banners if any
      await this.page
        .evaluate(() => {
          const text = document.body?.innerText || '';
          if (
            text.includes('Microphone not found') ||
            text.includes('Camera not found') ||
            text.includes('Make sure your microphone is plugged in')
          ) {
            const buttons = Array.from(document.querySelectorAll('button'));
            for (const btn of buttons) {
              const aria = (btn.getAttribute('aria-label') || '').toLowerCase();
              if (aria.includes('close') || aria.includes('dismiss')) {
                (btn as HTMLElement).click();
              }
            }
          }
        })
        .catch(() => {});
    } catch {
      // non-fatal
    }
  }

  /**
   * Opens the People drawer (using screenappai's resilient findPeopleButton strategies)
   * and scrapes all participant display names from the DOM list.
   */
  public async scrapeParticipants(): Promise<string[]> {
    if (!this.page || this.page.isClosed() || !this.isJoined) {
      return [];
    }

    try {
      console.log(`[GoogleMeetAdapter:${this.jobId}] Scraping participant list...`);

      // Open People panel if list isn't visible yet
      const listVisible = await this.page
        .locator('div[role="list"], div[aria-label="Participants"]')
        .first()
        .isVisible()
        .catch(() => false);

      if (!listVisible) {
        let clickedPeople = false;
        const primaryPeopleBtn = this.page
          .locator(
            'button[aria-label^="People"], button[aria-label*="People" i], button[aria-label*="Show everyone" i], button[data-panel-id="1"]',
          )
          .first();

        if (await primaryPeopleBtn.isVisible().catch(() => false)) {
          try {
            await primaryPeopleBtn.click({ timeout: 3000 });
            clickedPeople = true;
          } catch {
            clickedPeople = false;
          }
        }

        if (!clickedPeople) {
          clickedPeople = await this.page
            .evaluate(() => {
              const candidates: Array<Element | null> = [
                document.querySelector('button[aria-label^="People"]'),
                document.querySelector('button[aria-label*="People" i]'),
                document.querySelector('button[aria-label*="Show everyone" i]'),
                document.querySelector('button[data-panel-id="1"]'),
              ];

              // Strategy: aria-labelledby pointing to "People"
              const allBtns = Array.from(document.querySelectorAll('button'));
              for (const btn of allBtns) {
                const labelledBy = btn.getAttribute('aria-labelledby');
                if (labelledBy) {
                  const lbl = document.getElementById(labelledBy);
                  if (lbl && ['People', 'Personen'].includes(lbl.textContent?.trim() || '')) {
                    candidates.push(btn);
                  }
                }
                // Strategy: material icon child with text === 'people'
                const icon = btn.querySelector('i, span');
                if (icon && icon.textContent?.trim() === 'people') {
                  candidates.push(btn);
                }
              }

              for (const btn of candidates) {
                if (btn && (btn as HTMLElement).offsetParent !== null) {
                  (btn as HTMLElement).click();
                  return true;
                }
              }
              return false;
            })
            .catch(() => false);
        }

        if (clickedPeople) {
          await this.page.waitForTimeout(1200);
        }
      }

      const participantNames = new Set<string>();
      const listContainer = this.page.locator('div[role="list"], div[aria-label="Participants"]').first();

      for (let scroll = 0; scroll < 4; scroll++) {
        const items = await this.page.locator('div[role="listitem"]').all();
        for (const item of items) {
          const nameSpan = item.locator('span.zWGUib, span[class*="display-name" i]').first();
          let rawName = '';

          if (await nameSpan.isVisible().catch(() => false)) {
            rawName = await nameSpan.innerText().catch(() => '');
          } else {
            const text = await item.innerText().catch(() => '');
            rawName = text ? text.split('\n')[0].trim() : '';
          }

          if (rawName) {
            const cleanName = rawName
              .replace(/\(You\)/gi, '')
              .replace(/\(Meeting host\)/gi, '')
              .replace(/\(Presentation\)/gi, '')
              .replace(/\(Contributor\)/gi, '')
              .trim();

            if (cleanName && cleanName.toLowerCase() !== this.botDisplayName.toLowerCase()) {
              participantNames.add(cleanName);
            }
          }
        }

        if (await listContainer.isVisible().catch(() => false)) {
          await listContainer
            .evaluate((el) => {
              el.scrollTop += 450;
            })
            .catch(() => {});
          await this.page.waitForTimeout(500);
        } else {
          break;
        }
      }

      const results = Array.from(participantNames);
      console.log(`[GoogleMeetAdapter:${this.jobId}] Scraped ${results.length} participants:`, results);
      return results;
    } catch (err: any) {
      console.error(`[GoogleMeetAdapter:${this.jobId}] Scrape error: ${err?.message || err}`);
      return [];
    }
  }

  public async leaveMeeting(): Promise<void> {
    if (this.page && !this.page.isClosed()) {
      try {
        console.log(`[GoogleMeetAdapter:${this.jobId}] Leaving meeting...`);
        const leaveBtn = this.page.locator('button[aria-label*="Leave call" i]').first();
        if (await leaveBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
          await leaveBtn.click().catch(() => {});
        }
      } catch {
        // ignore
      }
    }
    await this.close();
  }

  public async close(): Promise<void> {
    this.isClosed = true;
    this.isJoined = false;
    await BrowserPool.closeSession(this.session, this.jobId);
    this.session = null;
    this.page = null;
  }
}
