import { NotFoundException } from '@nestjs/common';
import { ClassroomsService } from './classrooms.service';

describe('ClassroomsService', () => {
  let service: ClassroomsService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      classroom: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        deleteMany: jest.fn(),
      },
    };
    service = new ClassroomsService(mockPrisma);
  });

  it('creates a classroom with geofence data', async () => {
    const data = {
      name: 'Lab 2',
      gpsLatitude: 5.6037,
      gpsLongitude: -0.187,
      radiusMeters: 40,
    };
    mockPrisma.classroom.create.mockResolvedValue({ id: 'cr-1', ...data });
    const res = await service.create(data);
    expect(res.id).toBe('cr-1');
    expect(res.radiusMeters).toBe(40);
  });

  it('throws NotFoundException when classroom does not exist', async () => {
    mockPrisma.classroom.findUnique.mockResolvedValue(null);
    await expect(service.findOne('invalid-id')).rejects.toThrow(NotFoundException);
  });
});
