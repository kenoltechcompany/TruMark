import { PrismaThrottlerStorageService } from './prisma-throttler-storage.service';

describe('PrismaThrottlerStorageService', () => {
  let service: PrismaThrottlerStorageService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      rateLimit: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
        update: jest.fn(),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    };
    service = new PrismaThrottlerStorageService(mockPrisma);
  });

  it('initializes a new rate limit window when key does not exist', async () => {
    mockPrisma.rateLimit.findUnique.mockResolvedValue(null);
    mockPrisma.rateLimit.upsert.mockResolvedValue({
      key: 'test-ip',
      totalHits: 1,
      expiresAt: new Date(Date.now() + 60000),
    });

    const res = await service.increment('test-ip', 60000, 10, 0, 'default');
    expect(res.totalHits).toBe(1);
    expect(res.isBlocked).toBe(false);
    expect(mockPrisma.rateLimit.upsert).toHaveBeenCalled();
  });

  it('increments hits within an active window and blocks when limit exceeded', async () => {
    const future = new Date(Date.now() + 30000);
    mockPrisma.rateLimit.findUnique.mockResolvedValue({
      key: 'test-ip',
      totalHits: 10,
      expiresAt: future,
    });
    mockPrisma.rateLimit.update.mockResolvedValue({
      key: 'test-ip',
      totalHits: 11,
      expiresAt: future,
    });

    const res = await service.increment('test-ip', 60000, 10, 0, 'default');
    expect(res.totalHits).toBe(11);
    expect(res.isBlocked).toBe(true);
    expect(res.timeToExpire).toBeGreaterThan(0);
  });

  it('resets counter when previous window has expired', async () => {
    const past = new Date(Date.now() - 5000);
    mockPrisma.rateLimit.findUnique.mockResolvedValue({
      key: 'test-ip',
      totalHits: 25,
      expiresAt: past,
    });
    mockPrisma.rateLimit.upsert.mockResolvedValue({
      key: 'test-ip',
      totalHits: 1,
      expiresAt: new Date(Date.now() + 60000),
    });

    const res = await service.increment('test-ip', 60000, 10, 0, 'default');
    expect(res.totalHits).toBe(1);
    expect(res.isBlocked).toBe(false);
  });

  it('fails open when database throws an error', async () => {
    mockPrisma.rateLimit.findUnique.mockRejectedValue(new Error('DB connection drop'));

    const res = await service.increment('test-ip', 60000, 10, 0, 'default');
    expect(res.totalHits).toBe(1);
    expect(res.isBlocked).toBe(false);
  });
});
