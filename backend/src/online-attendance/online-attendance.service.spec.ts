import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { OnlineAttendanceService } from './online-attendance.service';
import { BotStatus } from '@prisma/client';

describe('OnlineAttendanceService', () => {
  let service: OnlineAttendanceService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      student: {
        findUnique: mock(),
        findMany: mock(),
      },
      session: {
        findUnique: mock(),
      },
      systemSetting: {
        findUnique: mock(),
        create: mock(),
      },
      onlineAttendanceJob: {
        findUnique: mock(),
        upsert: mock(),
        update: mock(),
      },
      attendanceRecord: {
        upsert: mock(),
      },
    };

    service = new OnlineAttendanceService(mockPrisma as any);
  });

  it('handleHeartbeat updates job status and stores direct worker address', async () => {
    mockPrisma.onlineAttendanceJob.findUnique.mockResolvedValue({
      id: 'job-1',
      status: BotStatus.DISPATCHED,
      statusMessage: 'Connecting',
    });

    mockPrisma.onlineAttendanceJob.update.mockResolvedValue({
      id: 'job-1',
      status: BotStatus.JOINED,
    });

    const result = await service.handleHeartbeat({
      jobId: 'job-1',
      sessionId: 'sess-1',
      status: BotStatus.JOINED,
      statusMessage: 'Joined meeting successfully',
      directWorkerUrl: 'http://192.168.1.50:5001',
      cycleCount: 1,
      attendeeMinutes: { '10928374': 5 },
    });

    expect(result.received).toBe(true);
    expect(mockPrisma.onlineAttendanceJob.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'job-1' },
        data: expect.objectContaining({
          status: BotStatus.JOINED,
          directWorkerUrl: 'http://192.168.1.50:5001',
          cycleCount: 1,
        }),
      }),
    );
  });

  it('handleConclude records attendance for qualified students atomically', async () => {
    mockPrisma.onlineAttendanceJob.findUnique.mockResolvedValue({
      id: 'job-1',
      sessionId: 'sess-1',
      session: { classId: 'cls-1' },
    });

    mockPrisma.onlineAttendanceJob.update.mockResolvedValue({});
    mockPrisma.student.findMany.mockResolvedValue([
      { id: 'stud-1', indexNumber: '10928374' },
      { id: 'stud-2', indexNumber: '10928375' },
    ]);

    mockPrisma.attendanceRecord.upsert.mockResolvedValue({});

    const result = await service.handleConclude({
      jobId: 'job-1',
      sessionId: 'sess-1',
      status: 'COMPLETED',
      qualifiedStudents: ['10928374', '10928375'],
      attendeeMinutes: { '10928374': 45, '10928375': 50 },
      totalCycles: 10,
    });

    expect(result.received).toBe(true);
    expect(result.recordedCount).toBe(2);
    expect(mockPrisma.attendanceRecord.upsert).toHaveBeenCalledTimes(2);
  });
});
