import { GoogleMeetAdapter } from '../engine/meet-adapter';
import { IdParser, IdRules } from '../engine/id-parser';
import { config } from '../config';

export interface StartJobDto {
  jobId: string;
  sessionId: string;
  meetingUrl: string;
  platform?: 'GOOGLE_MEET' | 'ZOOM' | 'TEAMS';
  isTimeBound?: boolean;
  minStayMinutes?: number;
  durationMinutes?: number;
  callbackUrl: string;
  callbackSecret?: string;
  idRules?: IdRules;
  existingAttendeeMinutes?: Record<string, number>; // for idempotency/auto-recovery
}

interface ActiveJob {
  id: string;
  dto: StartJobDto;
  parser: IdParser;
  adapter: GoogleMeetAdapter;
  status: 'IDLE' | 'DISPATCHED' | 'READY' | 'WAITING_PERMISSION' | 'JOINED' | 'MONITORING' | 'CONCLUDING' | 'COMPLETED' | 'FAILED';
  statusMessage: string;
  attendeeMinutes: Record<string, number>;
  cycleCount: number;
  intervalTimer: NodeJS.Timeout | null;
  startedAt: Date;
}

export class JobManager {
  private static jobs = new Map<string, ActiveJob>();

  public static getActiveJobsCount(): number {
    return this.jobs.size;
  }

  public static getJob(jobId: string): ActiveJob | undefined {
    return this.jobs.get(jobId);
  }

  public static async startJob(dto: StartJobDto): Promise<{ success: boolean; jobId: string }> {
    console.log(`[JobManager] Starting job ${dto.jobId} for meeting: ${dto.meetingUrl} (TimeBound: ${Boolean(dto.isTimeBound)})`);
    if (this.jobs.has(dto.jobId)) {
      // Idempotency: if job already running, return existing
      console.log(`[JobManager] Job ${dto.jobId} is already running.`);
      return { success: true, jobId: dto.jobId };
    }

    const parser = new IdParser(dto.idRules);
    let job: ActiveJob;

    const adapter = new GoogleMeetAdapter(dto.meetingUrl, config.botDisplayName, {
      onStatusChange: (status, message) => {
        if (job) {
          console.log(`[JobManager] Job ${job.id} status changed to ${status}: ${message || ''}`);
          job.status = status as any;
          job.statusMessage = message || '';
          this.sendHeartbeat(job).catch(() => {});

          if (status === 'FAILED') {
            if (job.intervalTimer) {
              clearInterval(job.intervalTimer);
              job.intervalTimer = null;
            }
            this.jobs.delete(job.id);
          } else if (status === 'JOINED' && !dto.isTimeBound) {
            // Snapshot Mode: run single pass once joined
            console.log(`[JobManager] Starting Snapshot pass for job ${job.id}...`);
            this.runSnapshotPass(job).catch(() => {});
          } else if (status === 'JOINED' && dto.isTimeBound) {
            // Time-Bound Mode: start 5-minute sampling engine
            console.log(`[JobManager] Starting Time-Bound engine for job ${job.id}...`);
            this.startTimeBoundEngine(job).catch(() => {});
          }
        }
      },
    });

    job = {
      id: dto.jobId,
      dto,
      parser,
      adapter,
      status: 'READY',
      statusMessage: 'Worker initialized and preparing to join call.',
      attendeeMinutes: { ...(dto.existingAttendeeMinutes || {}) },
      cycleCount: 0,
      intervalTimer: null,
      startedAt: new Date(),
    };

    this.jobs.set(dto.jobId, job);

    // Initial Handshake: Report direct address back to TruMark
    await this.sendHeartbeat(job);

    // Launch meeting adapter
    adapter.start().catch((err) => {
      job.status = 'FAILED';
      job.statusMessage = `Adapter startup failed: ${err.message}`;
      this.sendHeartbeat(job);
      this.jobs.delete(job.id);
    });

    return { success: true, jobId: dto.jobId };
  }

  public static async updateConfig(jobId: string, updates: { minStayMinutes?: number }): Promise<boolean> {
    const job = this.jobs.get(jobId);
    if (!job) return false;

    if (typeof updates.minStayMinutes === 'number') {
      job.dto.minStayMinutes = updates.minStayMinutes;
    }

    await this.sendHeartbeat(job);
    return true;
  }

  public static async concludeJob(jobId: string): Promise<boolean> {
    const job = this.jobs.get(jobId);
    if (!job) return false;

    job.status = 'CONCLUDING';
    job.statusMessage = 'Course Representative initiated manual conclusion. Finalizing attendance...';
    await this.sendHeartbeat(job);

    if (job.intervalTimer) {
      clearInterval(job.intervalTimer);
      job.intervalTimer = null;
    }

    // Finalize and submit results
    await this.finalizeAttendance(job);
    await job.adapter.leaveMeeting();
    this.jobs.delete(jobId);
    return true;
  }

  private static async runSnapshotPass(job: ActiveJob): Promise<void> {
    job.status = 'MONITORING';
    job.statusMessage = 'Scanning participant roster...';
    await this.sendHeartbeat(job);

    // Allow 3 seconds for initial DOM rendering of people
    await new Promise((r) => setTimeout(r, 3000));

    const rawParticipants = await job.adapter.scrapeParticipants();
    const { uniqueIndexNumbers } = job.parser.parseParticipantList(rawParticipants);

    // In snapshot mode, anyone present gets credit
    for (const indexNum of uniqueIndexNumbers) {
      job.attendeeMinutes[indexNum] = (job.attendeeMinutes[indexNum] || 0) + 1;
    }

    await this.finalizeAttendance(job);
    await job.adapter.leaveMeeting();
    this.jobs.delete(job.id);
  }

  private static async startTimeBoundEngine(job: ActiveJob): Promise<void> {
    job.status = 'MONITORING';
    job.statusMessage = 'Active in meeting. 5-minute sampling accumulator running.';
    await this.sendHeartbeat(job);

    // Run cycle 1 immediately
    await this.executeSamplingCycle(job);

    // Setup 5-minute recurring timer
    job.intervalTimer = setInterval(async () => {
      await this.executeSamplingCycle(job);
    }, 5 * 60 * 1000);
  }

  private static async executeSamplingCycle(job: ActiveJob): Promise<void> {
    try {
      job.cycleCount += 1;
      const rawParticipants = await job.adapter.scrapeParticipants();

      // If call is completely empty (only bot remaining), don't crash
      const { uniqueIndexNumbers } = job.parser.parseParticipantList(rawParticipants);

      // Add +5 minutes per student detected in this 5-minute interval
      for (const indexNum of uniqueIndexNumbers) {
        job.attendeeMinutes[indexNum] = (job.attendeeMinutes[indexNum] || 0) + 5;
      }

      job.statusMessage = `Monitoring active (Cycle ${job.cycleCount}): ${uniqueIndexNumbers.length} participants identified.`;
      await this.sendHeartbeat(job);
    } catch (err: any) {
      job.statusMessage = `Sampling error in cycle ${job.cycleCount}: ${err.message}`;
      await this.sendHeartbeat(job);
    }
  }

  private static async sendHeartbeat(job: ActiveJob): Promise<void> {
    try {
      console.log(`[JobManager] Sending heartbeat for job ${job.id}: status=${job.status}, cycle=${job.cycleCount}`);
      const res = await fetch(`${job.dto.callbackUrl}/heartbeat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-bot-api-key': job.dto.callbackSecret || config.apiKey,
        },
        body: JSON.stringify({
          jobId: job.id,
          sessionId: job.dto.sessionId,
          status: job.status,
          statusMessage: job.statusMessage,
          directWorkerUrl: config.directWorkerUrl,
          cycleCount: job.cycleCount,
          attendeeMinutes: job.attendeeMinutes,
        }),
      });
      if (!res.ok) {
        console.warn(`[JobManager] Heartbeat returned non-OK status: ${res.status}`);
      }
    } catch (err: any) {
      console.error(`[JobManager] Failed to send heartbeat: ${err.message}`);
    }
  }

  private static async finalizeAttendance(job: ActiveJob): Promise<void> {
    job.status = 'COMPLETED';
    job.statusMessage = 'Attendance compilation complete.';

    const minStay = job.dto.isTimeBound ? (job.dto.minStayMinutes || 0) : 1;
    const qualifiedStudents: string[] = [];

    for (const [indexNum, minutes] of Object.entries(job.attendeeMinutes)) {
      if (minutes >= minStay) {
        qualifiedStudents.push(indexNum);
      }
    }

    console.log(`[JobManager] Finalizing attendance for job ${job.id}: ${qualifiedStudents.length} qualified students.`);

    try {
      const res = await fetch(`${job.dto.callbackUrl}/conclude`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-bot-api-key': job.dto.callbackSecret || config.apiKey,
        },
        body: JSON.stringify({
          jobId: job.id,
          sessionId: job.dto.sessionId,
          status: 'COMPLETED',
          qualifiedStudents,
          attendeeMinutes: job.attendeeMinutes,
          totalCycles: job.cycleCount,
        }),
      });
      console.log(`[JobManager] Conclusion callback dispatched, status: ${res.status}`);
    } catch (err: any) {
      console.error(`[JobManager] Failed to dispatch conclude callback: ${err.message}`);
    }
  }
}
