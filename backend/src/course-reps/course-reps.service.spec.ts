import { ConflictException, NotFoundException } from '@nestjs/common';
import { CourseRepsService } from './course-reps.service';

describe('CourseRepsService', () => {
  let service: CourseRepsService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      student: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        deleteMany: jest.fn(),
      },
      class: {
        findUnique: jest.fn(),
      },
    };

    service = new CourseRepsService(mockPrisma);
  });

  describe('create', () => {
    it('throws ConflictException if username already exists', async () => {
      mockPrisma.student.findFirst.mockResolvedValue({
        id: 'rep-1',
        username: 'alice',
        email: 'other@school.edu',
      });

      await expect(
        service.create({
          fullName: 'Alice Walker',
          indexNumber: '10293847',
          username: 'alice',
          email: 'alice@school.edu',
          password: 'password123',
          classId: 'cls-1',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('creates a new course rep successfully', async () => {
      mockPrisma.student.findFirst.mockResolvedValue(null);
      mockPrisma.student.findUnique.mockResolvedValue(null);
      mockPrisma.class.findUnique.mockResolvedValue({ id: 'cls-1', name: 'CS Level 400' });
      mockPrisma.student.create.mockResolvedValue({
        id: 'rep-new',
        fullName: 'Alice Walker',
        indexNumber: '10293847',
        username: 'alice',
        email: 'alice@school.edu',
        isCourseRep: true,
        class: { id: 'cls-1', name: 'CS Level 400' },
      });

      const rep = await service.create({
        fullName: 'Alice Walker',
        indexNumber: '10293847',
        username: 'alice',
        email: 'alice@school.edu',
        password: 'password123',
        classId: 'cls-1',
      });

      expect(rep.id).toBe('rep-new');
      expect(rep.isCourseRep).toBe(true);
      expect(mockPrisma.student.create).toHaveBeenCalled();
    });
  });

  describe('promoteStudent', () => {
    it('promotes student to course rep', async () => {
      mockPrisma.student.findUnique.mockResolvedValue({
        id: 'st-promote',
        classId: 'cls-eng',
        fullName: 'Charlie Brown',
      });
      mockPrisma.student.findFirst.mockResolvedValue(null);
      mockPrisma.student.update.mockResolvedValue({
        id: 'st-promote',
        username: 'promoted',
        email: 'promoted@school.edu',
        isCourseRep: true,
        class: { id: 'cls-eng', name: 'Engineering' },
      });

      const res = await service.promoteStudent({
        studentId: 'st-promote',
        username: 'promoted',
        email: 'promoted@school.edu',
        password: 'password123',
      });

      expect(res.id).toBe('st-promote');
      expect(res.isCourseRep).toBe(true);
      expect(mockPrisma.student.update).toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('throws NotFoundException when rep does not exist', async () => {
      mockPrisma.student.findFirst.mockResolvedValue(null);
      await expect(service.findOne('invalid-rep')).rejects.toThrow(NotFoundException);
    });
  });
});
