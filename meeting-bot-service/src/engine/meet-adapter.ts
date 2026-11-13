import { BrowserContext, Page } from 'playwright';
import { BrowserPool } from './browser-pool';

export interface MeetAdapterCallbacks {
  onStatusChange: (status: 'WAITING_PERMISSION' | 'JOINED' | 'FAILED' | 'COMPLETED', message?: string) => void;
}

export class GoogleMeetAdapter {
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private isJoined = false;
  private admissionInterval: NodeJS.Timeout | null = null;

  constructor(
    private readonly meetingUrl: string,
    private readonly botDisplayName: string,
    private readonly callbacks: MeetAdapterCallbacks,
  ) {}

  public async start(): Promise<void> {
    try {
      console.log(`[GoogleMeetAdapter] Starting meeting bot session for URL: ${this.meetingUrl}`);
      this.context = await BrowserPool.createContext();
      this.page = this.context.pages().length > 0 ? this.context.pages()[0] : await this.context.newPage();

      // Go to Google Meet URL
      console.log(`[GoogleMeetAdapter] Navigating to ${this.meetingUrl}...`);
      await this.page.goto(this.meetingUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });

      // Wait for Google Meet pre-join screen ("Getting ready..." finishes and join button or name input appears)
      console.log('[GoogleMeetAdapter] Waiting for Google Meet pre-join screen to finish loading...');
      await this.waitForPreJoinReady();

      // Dismiss any initial popups/modals
      await this.dismissInitialDialogs();

      // Turn off mic and camera in pre-join screen if available
      await this.dismissMediaButtons();

      // Enter bot name if name input exists
      await this.enterNameIfPrompted();

      // Click "Join now" or "Ask to join"
      await this.clickJoinButton();

      // Give Meet a moment to transition to lobby or in-call state
      await this.page.waitForTimeout(2000);

      // Monitor admission state in call or lobby
      await this.monitorAdmission();
    } catch (err: any) {
      console.error(`[GoogleMeetAdapter] Startup error: ${err.message}`);
      this.callbacks.onStatusChange('FAILED', `Failed to join Google Meet: ${err.message}`);
      await this.close();
    }
  }

  private async waitForPreJoinReady(): Promise<void> {
    if (!this.page) return;
    try {
      await Promise.race([
        this.page.locator('button:has-text("Ask to join"), button:has-text("Join now"), button:has-text("Ask to enter")').first().waitFor({ state: 'visible', timeout: 25000 }),
        this.page.locator('input[placeholder*="Your name" i], input[aria-label*="Your name" i]').first().waitFor({ state: 'visible', timeout: 25000 }),
        this.page.locator('text=/you can\'t join this video call/i').first().waitFor({ state: 'visible', timeout: 25000 }),
      ]);
      await this.page.waitForTimeout(800);
    } catch {
      console.log('[GoogleMeetAdapter] Pre-join wait timed out, proceeding with available DOM...');
    }
  }

  private async dismissInitialDialogs(): Promise<void> {
    if (!this.page) return;
    try {
      const gotItBtn = this.page.locator('button:has-text("Got it"), button:has-text("Dismiss")').first();
      if (await gotItBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
        console.log('[GoogleMeetAdapter] Dismissing welcome dialog...');
        await gotItBtn.click().catch(() => {});
        await this.page.waitForTimeout(500);
      }
    } catch {}
  }

  private async dismissMediaButtons(): Promise<void> {
    if (!this.page) return;
    try {
      // Find microphone toggle button
      const micBtn = this.page
        .locator('button[aria-label*="microphone" i], button[aria-label*="mic" i], div[role="button"][aria-label*="microphone" i]')
        .first();

      if (await micBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        const label = await micBtn.getAttribute('aria-label').catch(() => '');
        if (!label || label.toLowerCase().includes('turn off') || label.toLowerCase().includes('mute')) {
          console.log('[GoogleMeetAdapter] Muting microphone...');
          await micBtn.click().catch(() => {});
          await this.page.waitForTimeout(300);
        }
      }

      // Find camera toggle button
      const camBtn = this.page
        .locator('button[aria-label*="camera" i], div[role="button"][aria-label*="camera" i]')
        .first();

      if (await camBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        const label = await camBtn.getAttribute('aria-label').catch(() => '');
        if (!label || label.toLowerCase().includes('turn off') || label.toLowerCase().includes('mute')) {
          console.log('[GoogleMeetAdapter] Muting camera...');
          await camBtn.click().catch(() => {});
          await this.page.waitForTimeout(300);
        }
      }
    } catch {}
  }

  private async enterNameIfPrompted(): Promise<void> {
    if (!this.page) return;
    try {
      const nameInput = this.page
        .locator('input[placeholder*="Your name" i], input[aria-label*="Your name" i], input[placeholder*="name" i], input[type="text"]')
        .first();

      if (await nameInput.isVisible({ timeout: 3000 }).catch(() => false)) {
        console.log(`[GoogleMeetAdapter] Entering bot display name: "${this.botDisplayName}"`);
        await nameInput.fill(this.botDisplayName);
        await this.page.waitForTimeout(500);
      }
    } catch {}
  }

  private async clickJoinButton(): Promise<void> {
    if (!this.page) return;
    try {
      const joinBtn = this.page
        .locator('button:has-text("Ask to join"), button:has-text("Join now"), button:has-text("Ask to enter"), button[jsname="Qx7uuf"]')
        .first();

      if (await joinBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
        const text = (await joinBtn.innerText().catch(() => '')).trim();
        console.log(`[GoogleMeetAdapter] Clicking join button: "${text}"`);
        await joinBtn.click().catch(() => {});
      }
    } catch {}
  }

  private async monitorAdmission(): Promise<void> {
    if (!this.page) return;

    if (this.admissionInterval) {
      clearInterval(this.admissionInterval);
    }

    this.admissionInterval = setInterval(async () => {
      if (!this.page || this.page.isClosed()) {
        if (this.admissionInterval) clearInterval(this.admissionInterval);
        return;
      }

      try {
        // 1. Detect in-call indicators
        const inCallIndicators = this.page.locator(
          'button[aria-label*="Leave call" i], button[aria-label*="leave" i], button[jsname="CQylAd"], button[aria-label*="Show everyone" i], button[aria-label*="People" i]',
        ).first();

        if (await inCallIndicators.isVisible().catch(() => false)) {
          if (!this.isJoined) {
            this.isJoined = true;
            console.log('[GoogleMeetAdapter] Bot has entered the Google Meet room successfully!');
            this.callbacks.onStatusChange('JOINED', 'Bot has joined the Google Meet session.');
          }
          return;
        }

        // 2. Detect Waiting for host admission
        const waitingPrompt = this.page
          .locator('text=/asking to join|you\'ll join the call when someone lets you in|waiting to be admitted|someone will let you in|asked to join|you asked to join|waiting for the host/i')
          .first();

        if (await waitingPrompt.isVisible().catch(() => false)) {
          console.log('[GoogleMeetAdapter] Waiting in lobby for host admission...');
          this.callbacks.onStatusChange(
            'WAITING_PERMISSION',
            'Bot is waiting in the lobby. Host, please click "Admit" to let TruMark Attendance Bot into the call.',
          );
          return;
        }

        // 3. Detect Denied, Inactive call, or Removed
        const deniedPrompt = this.page
          .locator('text=/you can\'t join this video call|someone in the call denied your request|you\'ve been removed from the meeting|no one can join a meeting unless invited/i')
          .first();

        if (await deniedPrompt.isVisible().catch(() => false)) {
          console.log('[GoogleMeetAdapter] Host denied entry or meeting host has not joined.');
          if (this.admissionInterval) clearInterval(this.admissionInterval);
          this.callbacks.onStatusChange(
            'FAILED',
            'Unable to enter meeting: The host has not started the call, Quick Access requires admission, or entry was denied.',
          );
          await this.close();
        }
      } catch {}
    }, 3000);
  }

  /**
   * Opens the People drawer and scrapes all visible participant names.
   * Auto-scrolls virtualized list to capture full roster.
   */
  public async scrapeParticipants(): Promise<string[]> {
    if (!this.page || this.page.isClosed() || !this.isJoined) {
      return [];
    }

    try {
      console.log('[GoogleMeetAdapter] Scraping meeting participant list...');

      // 1. Open People panel if not already open
      const peopleBtn = this.page
        .locator('button[aria-label*="People" i], button[aria-label*="Show everyone" i], button[data-panel-id="1"]')
        .first();

      if (await peopleBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        const listVisible = await this.page.locator('div[role="list"]').first().isVisible().catch(() => false);
        if (!listVisible) {
          console.log('[GoogleMeetAdapter] Opening People drawer...');
          await peopleBtn.click().catch(() => {});
          await this.page.waitForTimeout(1200);
        }
      }

      // 2. Locate participant items
      const participantNames: Set<string> = new Set();
      const listContainer = this.page.locator('div[role="list"]').first();

      for (let scroll = 0; scroll < 4; scroll++) {
        // Extract names currently rendered in DOM
        const items = await this.page.locator('div[role="listitem"]').all();
        for (const item of items) {
          // Look for specific participant name span
          const nameSpan = item.locator('span.zWGUib, span[class*="display-name" i]').first();
          let rawName = '';

          if (await nameSpan.isVisible().catch(() => false)) {
            rawName = await nameSpan.innerText().catch(() => '');
          } else {
            const text = await item.innerText().catch(() => '');
            rawName = text ? text.split('\n')[0].trim() : '';
          }

          if (rawName) {
            // Clean common Google Meet labels
            const cleanName = rawName
              .replace(/\(You\)/gi, '')
              .replace(/\(Meeting host\)/gi, '')
              .replace(/\(Presentation\)/gi, '')
              .replace(/\(Contributor\)/gi, '')
              .trim();

            if (cleanName && cleanName !== this.botDisplayName) {
              participantNames.add(cleanName);
            }
          }
        }

        // Scroll down in virtualized container
        if (await listContainer.isVisible().catch(() => false)) {
          await listContainer.evaluate((el) => {
            el.scrollTop += 450;
          }).catch(() => {});
          await this.page.waitForTimeout(600);
        }
      }

      const results = Array.from(participantNames);
      console.log(`[GoogleMeetAdapter] Scraped ${results.length} unique participants:`, results);
      return results;
    } catch (err: any) {
      console.error(`[GoogleMeetAdapter] Scrape error: ${err.message}`);
      return [];
    }
  }

  public async leaveMeeting(): Promise<void> {
    if (this.page && !this.page.isClosed()) {
      try {
        console.log('[GoogleMeetAdapter] Leaving meeting...');
        const leaveBtn = this.page.locator('button[aria-label*="Leave call" i]').first();
        if (await leaveBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
          await leaveBtn.click().catch(() => {});
        }
      } catch {}
    }
    await this.close();
  }

  public async close(): Promise<void> {
    if (this.admissionInterval) {
      clearInterval(this.admissionInterval);
      this.admissionInterval = null;
    }

    try {
      if (this.page && !this.page.isClosed()) {
        await this.page.close().catch(() => {});
      }
      if (this.context) {
        await this.context.close().catch(() => {});
      }
    } finally {
      this.page = null;
      this.context = null;
      this.isJoined = false;
    }
  }
}
