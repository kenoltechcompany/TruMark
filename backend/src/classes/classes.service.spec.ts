import { NotFoundException } from '@nestjs/common';
import { ClassesService } from './classes.service';

describe('ClassesService', () => {
  let service: ClassesService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      class: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      student: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    service = new ClassesService(mockPrisma);
  });

  it('creates a class', async () => {
    mockPrisma.class.create.mockResolvedValue({ id: 'cls-1', name: 'CS 101' });
    const res = await service.create({ name: 'CS 101' });
    expect(res.id).toBe('cls-1');
  });

  it('throws NotFoundException when updating non-existent class', async () => {
    mockPrisma.class.findUnique.mockResolvedValue(null);
    await expect(service.update('invalid-cls', { name: 'New' })).rejects.toThrow(
      NotFoundException,
    );
  });

  it('safely cascades deletion and cleans up student media', async () => {
    mockPrisma.class.findUnique.mockResolvedValue({
      id: 'cls-1',
      name: 'CS 101',
      students: [],
      sessions: [],
    });
    mockPrisma.student.findMany.mockResolvedValue([
      { imagePaths: ['uploads/img1.jpg'] },
    ]);
    mockPrisma.class.delete.mockResolvedValue({ id: 'cls-1' });

    const res = await service.remove('cls-1');
    expect(res.id).toBe('cls-1');
    expect(mockPrisma.student.findMany).toHaveBeenCalledWith({
      where: { classId: 'cls-1' },
      select: { imagePaths: true },
    });
    expect(mockPrisma.class.delete).toHaveBeenCalledWith({ where: { id: 'cls-1' } });
  });
});
