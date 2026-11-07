import { BrowserContext, Page } from 'playwright';
import { BrowserPool } from './browser-pool';

export interface MeetAdapterCallbacks {
  onStatusChange: (status: 'WAITING_PERMISSION' | 'JOINED' | 'FAILED' | 'COMPLETED', message?: string) => void;
}

export class GoogleMeetAdapter {
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private isJoined = false;

  constructor(
    private readonly meetingUrl: string,
    private readonly botDisplayName: string,
    private readonly callbacks: MeetAdapterCallbacks,
  ) {}

  public async start(): Promise<void> {
    try {
      this.context = await BrowserPool.createContext();
      this.page = await this.context.newPage();

      // Go to Google Meet URL
      await this.page.goto(this.meetingUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });

      // Turn off mic and camera in pre-join screen if available
      await this.dismissMediaButtons();

      // Enter bot name if name input exists
      await this.enterNameIfPrompted();

      // Click "Join now" or "Ask to join"
      await this.clickJoinButton();

      // Wait for either admission or direct entry
      await this.monitorAdmission();
    } catch (err: any) {
      this.callbacks.onStatusChange('FAILED', `Failed to join Google Meet: ${err.message}`);
      await this.close();
    }
  }

  private async dismissMediaButtons(): Promise<void> {
    if (!this.page) return;
    try {
      // Find mic/camera mute buttons
      const micBtn = this.page.locator('button[aria-label*="microphone" i], button[aria-label*="mic" i]').first();
      if (await micBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await micBtn.click().catch(() => {});
      }

      const camBtn = this.page.locator('button[aria-label*="camera" i]').first();
      if (await camBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await camBtn.click().catch(() => {});
      }
    } catch {}
  }

  private async enterNameIfPrompted(): Promise<void> {
    if (!this.page) return;
    try {
      const nameInput = this.page.locator('input[aria-label*="name" i], input[type="text"]').first();
      if (await nameInput.isVisible({ timeout: 3000 }).catch(() => false)) {
        await nameInput.fill(this.botDisplayName);
      }
    } catch {}
  }

  private async clickJoinButton(): Promise<void> {
    if (!this.page) return;
    try {
      const joinBtn = this.page.locator(
        'button:has-text("Ask to join"), button:has-text("Join now"), button:has-text("Join")',
      ).first();

      if (await joinBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
        await joinBtn.click();
      }
    } catch {}
  }

  private async monitorAdmission(): Promise<void> {
    if (!this.page) return;

    // Check periodically for admission
    const checkInterval = setInterval(async () => {
      if (!this.page || this.page.isClosed()) {
        clearInterval(checkInterval);
        return;
      }

      try {
        // Detect in-call indicators (e.g. Leave Call button)
        const leaveBtn = this.page.locator('button[aria-label*="Leave call" i], button[aria-label*="leave" i]').first();
        if (await leaveBtn.isVisible().catch(() => false)) {
          if (!this.isJoined) {
            this.isJoined = true;
            this.callbacks.onStatusChange('JOINED', 'Bot has joined the Google Meet session.');
          }
          return;
        }

        // Detect Waiting for admission
        const waitingPrompt = this.page.locator('text=/waiting to be admitted|someone will let you in|asked to join/i').first();
        if (await waitingPrompt.isVisible().catch(() => false)) {
          this.callbacks.onStatusChange(
            'WAITING_PERMISSION',
            'Bot is waiting for the meeting host or lecturer to grant entry.',
          );
          return;
        }

        // Detect Denied / Ended
        const deniedPrompt = this.page.locator('text=/denied|removed from the meeting|can\'t join/i').first();
        if (await deniedPrompt.isVisible().catch(() => false)) {
          clearInterval(checkInterval);
          this.callbacks.onStatusChange('FAILED', 'Host denied entry or bot was removed.');
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
      // 1. Open People panel if not already open
      const peopleBtn = this.page.locator(
        'button[aria-label*="People" i], button[aria-label*="Show everyone" i], button[data-panel-id="1"]',
      ).first();

      if (await peopleBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        // Check if drawer already open by searching for list container
        const listVisible = await this.page.locator('div[role="list"]').first().isVisible().catch(() => false);
        if (!listVisible) {
          await peopleBtn.click().catch(() => {});
          await this.page.waitForTimeout(1000);
        }
      }

      // 2. Locate participant items
      const participantNames: Set<string> = new Set();

      // Scroll container to load virtualized elements
      const listContainer = this.page.locator('div[role="list"]').first();
      for (let scroll = 0; scroll < 4; scroll++) {
        // Extract names currently rendered in DOM
        const items = await this.page.locator('div[role="listitem"]').all();
        for (const item of items) {
          const text = await item.innerText().catch(() => '');
          if (text) {
            // First line is usually participant display name
            const firstLine = text.split('\n')[0].trim();
            if (firstLine && firstLine !== this.botDisplayName) {
              participantNames.add(firstLine);
            }
          }
        }

        // Scroll down
        if (await listContainer.isVisible().catch(() => false)) {
          await listContainer.evaluate((el) => {
            el.scrollTop += 500;
          }).catch(() => {});
          await this.page.waitForTimeout(600);
        }
      }

      return Array.from(participantNames);
    } catch (err: any) {
      return [];
    }
  }

  public async leaveMeeting(): Promise<void> {
    if (this.page && !this.page.isClosed()) {
      try {
        const leaveBtn = this.page.locator('button[aria-label*="Leave call" i]').first();
        if (await leaveBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
          await leaveBtn.click().catch(() => {});
        }
      } catch {}
    }
    await this.close();
  }

  public async close(): Promise<void> {
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
