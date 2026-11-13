import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  LaunchOnlineAttendanceDto,
  UpdateOnlineAttendanceConfigDto,
  BotHeartbeatDto,
  BotConcludeDto,
} from './online-attendance.dto';
import { BotStatus } from '@prisma/client';

@Injectable()
export class OnlineAttendanceService {
  private readonly logger = new Logger(OnlineAttendanceService.name);

  constructor(private readonly prisma: PrismaService) {}

  private async getRepStudent(repId: string) {
    const student = await this.prisma.student.findUnique({
      where: { id: repId },
      include: { class: true },
    });
    if (!student || !student.isCourseRep) {
      throw new ForbiddenException('Only course representatives can manage meeting attendance.');
    }
    return student;
  }

  private async getSystemSettings() {
    let settings = await this.prisma.systemSetting.findUnique({
      where: { id: 'default' },
    });
    if (!settings) {
      settings = await this.prisma.systemSetting.create({
        data: {
          id: 'default',
          enableLandingPage: true,
          enableBiometricValidation: true,
          enableGeofencing: true,
          idHasNumbers: true,
          idHasAlphabets: false,
          idMinLength: 10,
          idMaxLength: 10,
          idPrefix: '',
          idSuffix: '',
          botServiceUrl: 'http://127.0.0.1:5001',
          botApiKey: 'trumark-bot-secret',
        },
      });
    }
    return settings;
  }

  /**
   * Dispatches an online attendance job to meeting-bot-service.
   * Can be routed through an external load balancer or local service.
   */
  async launchJob(sessionId: string, dto: LaunchOnlineAttendanceDto, repUserId: string) {
    const rep = await this.getRepStudent(repUserId);

    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
      include: { onlineJob: true },
    });

    if (!session) throw new NotFoundException('Session not found.');
    if (session.classId !== rep.classId) {
      throw new ForbiddenException('Cannot manage attendance for another class.');
    }
    if (session.isLocked) {
      throw new BadRequestException('Session is locked. Unlock it before launching the attendance bot.');
    }

    const settings = await this.getSystemSettings();
    const botUrl = settings.botServiceUrl || 'http://127.0.0.1:5001';

    // Check if an active job is genuinely still alive on the worker
    if (
      session.onlineJob &&
      session.onlineJob.status !== BotStatus.FAILED &&
      session.onlineJob.status !== BotStatus.COMPLETED
    ) {
      let workerAlive = false;
      const checkUrl = session.onlineJob.directWorkerUrl || botUrl;
      try {
        const probe = await fetch(`${checkUrl}/jobs/${session.onlineJob.id}/status`, {
          headers: { 'x-bot-api-key': settings.botApiKey || 'trumark-bot-secret' },
          signal: AbortSignal.timeout(3000),
        });
        if (probe.ok) {
          const workerJob = (await probe.json()) as { status?: string };
          if (workerJob.status !== 'FAILED' && workerJob.status !== 'COMPLETED') {
            workerAlive = true;
          }
        }
      } catch {
        workerAlive = false;
      }

      if (workerAlive) {
        return session.onlineJob;
      }
      this.logger.warn(`Existing job ${session.onlineJob.id} is stale or worker restarted. Re-dispatching...`);
    }

    // Upsert OnlineAttendanceJob record
    const job = await this.prisma.onlineAttendanceJob.upsert({
      where: { sessionId },
      create: {
        sessionId,
        meetingUrl: dto.meetingUrl,
        platform: dto.platform || 'GOOGLE_MEET',
        isTimeBound: Boolean(dto.isTimeBound),
        minStayMinutes: dto.minStayMinutes ?? 0,
        status: BotStatus.DISPATCHED,
        statusMessage: 'Dispatching bot to meeting URL...',
        attendeeMinutes: session.onlineJob?.attendeeMinutes ?? {},
      },
      update: {
        meetingUrl: dto.meetingUrl,
        platform: dto.platform || 'GOOGLE_MEET',
        isTimeBound: Boolean(dto.isTimeBound),
        minStayMinutes: dto.minStayMinutes ?? 0,
        status: BotStatus.DISPATCHED,
        statusMessage: 'Dispatching bot to meeting URL...',
        directWorkerUrl: null, // Reset until first handshake
      },
    });

    // Callback URL for worker heartbeats and results
    const backendPort = process.env.PORT || 4000;
    const callbackUrl =
      process.env.INTERNAL_CALLBACK_URL || `http://127.0.0.1:${backendPort}/api/online-attendance/bot`;

    try {
      const response = await fetch(`${botUrl}/jobs/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-bot-api-key': settings.botApiKey || 'trumark-bot-secret',
        },
        body: JSON.stringify({
          jobId: job.id,
          sessionId: session.id,
          meetingUrl: dto.meetingUrl,
          platform: dto.platform || 'GOOGLE_MEET',
          isTimeBound: dto.isTimeBound,
          minStayMinutes: dto.minStayMinutes,
          callbackUrl,
          callbackSecret: settings.botApiKey || 'trumark-bot-secret',
          idRules: {
            idHasNumbers: settings.idHasNumbers,
            idHasAlphabets: settings.idHasAlphabets,
            idMinLength: settings.idMinLength,
            idMaxLength: settings.idMaxLength,
            idPrefix: settings.idPrefix,
            idSuffix: settings.idSuffix,
          },
          existingAttendeeMinutes: (job.attendeeMinutes as Record<string, number>) || {},
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new BadRequestException(`Meeting bot service rejected job: ${text}`);
      }

      const resJson = await response.json().catch(() => ({}));
      if (resJson.directWorkerUrl) {
        // Save direct worker address if provided in response
        await this.prisma.onlineAttendanceJob.update({
          where: { id: job.id },
          data: { directWorkerUrl: resJson.directWorkerUrl },
        });
      }

      return job;
    } catch (err: any) {
      this.logger.error(`Failed to dispatch job to bot service at ${botUrl}: ${err.message}`);
      await this.prisma.onlineAttendanceJob.update({
        where: { id: job.id },
        data: {
          status: BotStatus.FAILED,
          statusMessage: `Could not reach meeting bot service at ${botUrl}.`,
        },
      });
      throw new ServiceUnavailableException(
        `Meeting bot service unreachable at ${botUrl}. Please verify bot service is running.`,
      );
    }
  }

  /**
   * Updates minimum stay time on the fly.
   * Calls the direct worker URL to bypass the load balancer!
   */
  async updateJobConfig(sessionId: string, dto: UpdateOnlineAttendanceConfigDto, repUserId: string) {
    const rep = await this.getRepStudent(repUserId);
    const job = await this.prisma.onlineAttendanceJob.findUnique({
      where: { sessionId },
      include: { session: true },
    });

    if (!job) throw new NotFoundException('No active online attendance job found for this session.');
    if (job.session.classId !== rep.classId) {
      throw new ForbiddenException('Cannot modify job for another class.');
    }

    const settings = await this.getSystemSettings();

    // Call direct worker URL if available, fallback to global bot service
    const targetUrl = job.directWorkerUrl || settings.botServiceUrl || 'http://127.0.0.1:5001';

    try {
      await fetch(`${targetUrl}/jobs/${job.id}/config`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-bot-api-key': settings.botApiKey || 'trumark-bot-secret',
        },
        body: JSON.stringify(dto),
      });
    } catch (err: any) {
      this.logger.warn(`Could not reach worker directly at ${targetUrl}: ${err.message}`);
    }

    return this.prisma.onlineAttendanceJob.update({
      where: { id: job.id },
      data: {
        ...(typeof dto.minStayMinutes === 'number' ? { minStayMinutes: dto.minStayMinutes } : {}),
      },
    });
  }

  /**
   * Hard end: instructs the bot to conclude attendance immediately, leave, and submit results.
   * Calls the direct worker URL to bypass the load balancer!
   */
  async concludeJob(sessionId: string, repUserId: string) {
    const rep = await this.getRepStudent(repUserId);
    const job = await this.prisma.onlineAttendanceJob.findUnique({
      where: { sessionId },
      include: { session: true },
    });

    if (!job) throw new NotFoundException('No active online attendance job found for this session.');
    if (job.session.classId !== rep.classId) {
      throw new ForbiddenException('Cannot conclude job for another class.');
    }

    const settings = await this.getSystemSettings();
    const targetUrl = job.directWorkerUrl || settings.botServiceUrl || 'http://127.0.0.1:5001';

    await this.prisma.onlineAttendanceJob.update({
      where: { id: job.id },
      data: {
        status: BotStatus.CONCLUDING,
        statusMessage: 'Conclude requested by Course Representative.',
      },
    });

    try {
      await fetch(`${targetUrl}/jobs/${job.id}/conclude`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-bot-api-key': settings.botApiKey || 'trumark-bot-secret',
        },
      });
    } catch (err: any) {
      this.logger.warn(`Could not reach worker to conclude job at ${targetUrl}: ${err.message}`);
    }

    return this.prisma.onlineAttendanceJob.findUnique({
      where: { id: job.id },
    });
  }

  /**
   * Internal webhook: receives live heartbeat and direct worker address.
   */
  async handleHeartbeat(dto: BotHeartbeatDto) {
    const job = await this.prisma.onlineAttendanceJob.findUnique({
      where: { id: dto.jobId },
    });
    if (!job) return { received: false, error: 'Job not found' };

    await this.prisma.onlineAttendanceJob.update({
      where: { id: dto.jobId },
      data: {
        status: dto.status,
        statusMessage: dto.statusMessage ?? job.statusMessage,
        ...(dto.directWorkerUrl ? { directWorkerUrl: dto.directWorkerUrl } : {}),
        ...(typeof dto.cycleCount === 'number' ? { cycleCount: dto.cycleCount } : {}),
        ...(dto.attendeeMinutes ? { attendeeMinutes: dto.attendeeMinutes } : {}),
        lastHeartbeat: new Date(),
      },
    });

    return { received: true };
  }

  /**
   * Internal webhook: receives finalized qualified attendee index numbers.
   * Atomically records attendance records in the database.
   */
  async handleConclude(dto: BotConcludeDto) {
    const job = await this.prisma.onlineAttendanceJob.findUnique({
      where: { id: dto.jobId },
      include: { session: true },
    });
    if (!job) return { received: false, error: 'Job not found' };

    // Update job status
    await this.prisma.onlineAttendanceJob.update({
      where: { id: dto.jobId },
      data: {
        status: BotStatus.COMPLETED,
        statusMessage: `Attendance finalized. ${dto.qualifiedStudents.length} students qualified.`,
        attendeeMinutes: (dto.attendeeMinutes ?? (job.attendeeMinutes as any)) as any,
        ...(typeof dto.totalCycles === 'number' ? { cycleCount: dto.totalCycles } : {}),
        lastHeartbeat: new Date(),
      },
    });

    // Bulk resolve student IDs by index number in this class
    const students = await this.prisma.student.findMany({
      where: {
        classId: job.session.classId,
        indexNumber: { in: dto.qualifiedStudents },
      },
      select: { id: true, indexNumber: true },
    });

    let recordedCount = 0;
    for (const student of students) {
      try {
        await this.prisma.attendanceRecord.upsert({
          where: {
            studentId_sessionId: {
              studentId: student.id,
              sessionId: job.sessionId,
            },
          },
          create: {
            studentId: student.id,
            sessionId: job.sessionId,
            confidence: 1.0, // verified via meeting presence
          },
          update: {
            confidence: 1.0,
          },
        });
        recordedCount++;
      } catch {}
    }

    this.logger.log(
      `Online Attendance completed for session ${job.sessionId}: recorded ${recordedCount} attendance records.`,
    );

    return { received: true, recordedCount };
  }

  /**
   * Queries job status along with student details for live UI rendering.
   */
  async getJobStatus(sessionId: string) {
    const job = await this.prisma.onlineAttendanceJob.findUnique({
      where: { sessionId },
      include: { session: { select: { classId: true, name: true, isLocked: true } } },
    });

    if (!job) return null;

    // Check for missed heartbeats (worker crash detection: >90s)
    const isStale =
      job.status !== BotStatus.COMPLETED &&
      job.status !== BotStatus.FAILED &&
      Date.now() - new Date(job.lastHeartbeat).getTime() > 90000;

    const effectiveStatus = isStale ? BotStatus.FAILED : job.status;
    const effectiveMessage = isStale
      ? 'Worker timed out (no heartbeat received for >90s). Click launch to auto-recover.'
      : job.statusMessage;

    // Map attendeeMinutes to student full names for UI
    const minutesMap = (job.attendeeMinutes as Record<string, number>) || {};
    const indexNumbers = Object.keys(minutesMap);

    let attendeeList: { indexNumber: string; fullName: string; minutes: number }[] = [];
    if (indexNumbers.length > 0) {
      const students = await this.prisma.student.findMany({
        where: {
          classId: job.session.classId,
          indexNumber: { in: indexNumbers },
        },
        select: { indexNumber: true, fullName: true },
      });

      const studentNameMap = new Map(students.map((s) => [s.indexNumber, s.fullName]));

      attendeeList = indexNumbers.map((index) => ({
        indexNumber: index,
        fullName: studentNameMap.get(index) || 'Unknown Student',
        minutes: minutesMap[index] || 0,
      }));
    }

    return {
      id: job.id,
      sessionId: job.sessionId,
      sessionName: job.session.name,
      meetingUrl: job.meetingUrl,
      platform: job.platform,
      isTimeBound: job.isTimeBound,
      minStayMinutes: job.minStayMinutes,
      status: effectiveStatus,
      statusMessage: effectiveMessage,
      cycleCount: job.cycleCount,
      lastHeartbeat: job.lastHeartbeat,
      attendees: attendeeList,
    };
  }
}
