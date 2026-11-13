import { NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PublicRegistrationService } from './public-registration.service';

describe('PublicRegistrationService', () => {
  let service: PublicRegistrationService;
  let mockPrisma: any;
  let mockFaceRecognition: any;

  beforeEach(() => {
    mockPrisma = {
      class: {
        findUnique: jest.fn(),
      },
      student: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
      },
      session: {
        findUnique: jest.fn(),
      },
      attendanceRecord: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
      systemSetting: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'default',
          enableLandingPage: true,
          enableBiometricValidation: true,
          enableGeofencing: true,
        }),
        create: jest.fn(),
      },
    };

    mockFaceRecognition = {
      providerName: 'azure',
      identifyFace: jest.fn(),
      extractEmbedding: jest.fn(),
    };

    service = new PublicRegistrationService(mockPrisma, mockFaceRecognition as any);
  });

  describe('checkRegistrationStatus', () => {
    it('throws NotFoundException if class does not exist', async () => {
      mockPrisma.class.findUnique.mockResolvedValue(null);
      await expect(service.checkRegistrationStatus('invalid-id')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('returns registration active status and class name', async () => {
      mockPrisma.class.findUnique.mockResolvedValue({
        id: 'cls-1',
        name: 'CS 101',
        registrationLinkActive: true,
      });

      const res = await service.checkRegistrationStatus('cls-1');
      expect(res).toEqual({ active: true, className: 'CS 101' });
    });
  });

  describe('registerStudent', () => {
    it('throws ForbiddenException if registration is closed', async () => {
      mockPrisma.class.findUnique.mockResolvedValue({
        id: 'cls-1',
        name: 'CS 101',
        registrationLinkActive: false,
      });

      await expect(
        service.registerStudent('cls-1', { fullName: 'Alice', indexNumber: 'IND100' }, []),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws BadRequestException if student index number already exists', async () => {
      mockPrisma.class.findUnique.mockResolvedValue({
        id: 'cls-1',
        name: 'CS 101',
        registrationLinkActive: true,
      });
      mockPrisma.student.findUnique.mockResolvedValue({ id: 'existing-id' });

      await expect(
        service.registerStudent('cls-1', { fullName: 'Alice', indexNumber: 'IND100' }, []),
      ).rejects.toThrow(BadRequestException);
    });

    it('creates student record successfully and saves faceEmbedding', async () => {
      mockPrisma.class.findUnique.mockResolvedValue({
        id: 'cls-1',
        name: 'CS 101',
        registrationLinkActive: true,
      });
      mockPrisma.student.findUnique.mockResolvedValue(null);
      mockPrisma.student.create.mockResolvedValue({
        id: 'new-id',
        fullName: 'Alice',
        indexNumber: 'IND100',
        createdAt: new Date(),
      });

      const res = await service.registerStudent(
        'cls-1',
        { fullName: 'Alice', indexNumber: 'IND100' },
        ['/path/to/img1.jpg'],
      );
      expect(res.fullName).toBe('Alice');
      expect(mockPrisma.student.create).toHaveBeenCalledWith({
        data: {
          fullName: 'Alice',
          indexNumber: 'IND100',
          classId: 'cls-1',
          imagePaths: [],
          faceEmbedding: [],
        },
        select: {
          id: true,
          fullName: true,
          indexNumber: true,
          createdAt: true,
        },
      });
    });
  });

  describe('checkIn', () => {
    const validSession = {
      id: 'sess-1',
      name: 'Morning Lecture',
      startTime: new Date(Date.now() - 1000 * 60 * 10), // started 10 mins ago
      endTime: new Date(Date.now() + 1000 * 60 * 50), // ends in 50 mins
      classId: 'class-1',
      classroom: {
        id: 'room-1',
        name: 'Lab 1',
        gpsLatitude: 5.6037,
        gpsLongitude: -0.187,
        radiusMeters: 50,
      },
    };

    it('throws NotFoundException if session does not exist', async () => {
      mockPrisma.session.findUnique.mockResolvedValue(null);
      await expect(
        service.checkIn('non-existent', 5.6037, -0.187, Buffer.from('photo')),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException if session is not active (expired)', async () => {
      mockPrisma.session.findUnique.mockResolvedValue({
        ...validSession,
        startTime: new Date(Date.now() - 1000 * 60 * 120),
        endTime: new Date(Date.now() - 1000 * 60 * 60), // ended 1 hour ago
      });

      await expect(
        service.checkIn('sess-1', 5.6037, -0.187, Buffer.from('photo')),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException if session is an Online/Virtual classroom session', async () => {
      mockPrisma.session.findUnique.mockResolvedValue({
        ...validSession,
        classroom: {
          ...validSession.classroom,
          name: 'Online / Virtual Classroom',
          isVirtual: true,
        },
      });

      await expect(
        service.checkIn('sess-1', 5.6037, -0.187, Buffer.from('photo')),
      ).rejects.toThrow(/Physical biometric check-in is disabled for Online\/Virtual sessions/);
    });

    it('throws BadRequestException if student is outside classroom geofence boundary', async () => {
      mockPrisma.session.findUnique.mockResolvedValue(validSession);

      // Coordinates 2km away
      await expect(
        service.checkIn('sess-1', 5.62, -0.187, Buffer.from('photo')),
      ).rejects.toThrow(/Outside classroom boundary/);
    });

    it('throws BadRequestException if face is not recognized', async () => {
      mockPrisma.session.findUnique.mockResolvedValue(validSession);
      mockFaceRecognition.identifyFace.mockResolvedValue(null);

      await expect(
        service.checkIn('sess-1', 5.6037, -0.187, Buffer.from('photo')),
      ).rejects.toThrow('Face not recognized or confidence too low.');
    });

    it('throws BadRequestException if recognized face does not match enrolled student in class (Azure)', async () => {
      mockPrisma.session.findUnique.mockResolvedValue(validSession);
      mockFaceRecognition.identifyFace.mockResolvedValue({ personId: 'azure-p-1', confidence: 0.92 });
      mockPrisma.student.findFirst.mockResolvedValue(null);

      await expect(
        service.checkIn('sess-1', 5.6037, -0.187, Buffer.from('photo')),
      ).rejects.toThrow('Identified face does not match any enrolled student.');
    });

    it('identifies student via InsightFace embeddings and records attendance successfully', async () => {
      mockFaceRecognition.providerName = 'insightface';
      mockPrisma.session.findUnique.mockResolvedValue(validSession);

      mockPrisma.student.findMany.mockResolvedValue([
        { id: 'st-1', faceEmbedding: [0.1, 0.2, 0.3] },
      ]);

      mockFaceRecognition.identifyFace.mockResolvedValue({
        studentId: 'st-1',
        confidence: 0.96,
      });

      mockPrisma.student.findUnique.mockResolvedValue({
        id: 'st-1',
        fullName: 'Alice Bob',
        indexNumber: 'IND300',
      });

      mockPrisma.attendanceRecord.findUnique.mockResolvedValue(null);
      mockPrisma.attendanceRecord.create.mockResolvedValue({
        id: 'rec-1',
        studentId: 'st-1',
        sessionId: 'sess-1',
        confidence: 0.96,
      });

      const res = await service.checkIn('sess-1', 5.6037, -0.187, Buffer.from('photo'));
      expect(res.success).toBe(true);
      expect(res.student.fullName).toBe('Alice Bob');
      expect(res.confidence).toBe(0.96);
      expect(mockPrisma.attendanceRecord.create).toHaveBeenCalled();
    });

    it('throws BadRequestException on duplicate check-in', async () => {
      mockFaceRecognition.providerName = 'insightface';
      mockPrisma.session.findUnique.mockResolvedValue(validSession);
      mockPrisma.student.findMany.mockResolvedValue([
        { id: 'st-1', faceEmbedding: [0.1, 0.2, 0.3] },
      ]);
      mockFaceRecognition.identifyFace.mockResolvedValue({ studentId: 'st-1', confidence: 0.95 });
      mockPrisma.student.findUnique.mockResolvedValue({
        id: 'st-1',
        fullName: 'Bob',
        indexNumber: 'IND200',
      });
      mockPrisma.attendanceRecord.findUnique.mockResolvedValue({ id: 'rec-existing' });

      await expect(
        service.checkIn('sess-1', 5.6037, -0.187, Buffer.from('photo')),
      ).rejects.toThrow('You have already checked in to this session.');
    });

    it('bypasses facial verification when enableBiometricValidation is false', async () => {
      mockPrisma.systemSetting.findUnique.mockResolvedValue({
        id: 'default',
        enableLandingPage: true,
        enableBiometricValidation: false,
        enableGeofencing: false,
      });

      mockPrisma.session.findUnique.mockResolvedValue(validSession);
      mockPrisma.student.findFirst.mockResolvedValue({
        id: 'st-99',
        fullName: 'Kofi Mensah',
        indexNumber: '10998877',
      });
      mockPrisma.attendanceRecord.findUnique.mockResolvedValue(null);
      mockPrisma.attendanceRecord.create.mockResolvedValue({ id: 'rec-new' });

      // Student provides indexNumber only, no photo, geofencing disabled
      const res = await service.checkIn('sess-1', {
        latitude: 9.999,
        longitude: 0.123,
        indexNumber: '10998877',
      });

      expect(res.success).toBe(true);
      expect(res.student.fullName).toBe('Kofi Mensah');
      expect(res.confidence).toBe(1.0);
      expect(mockFaceRecognition.identifyFace).not.toHaveBeenCalled();
    });

    it('bypasses geofencing when enableGeofencing is false but still validates facial biometrics', async () => {
      mockPrisma.systemSetting.findUnique.mockResolvedValue({
        id: 'default',
        enableLandingPage: true,
        enableBiometricValidation: true,
        enableGeofencing: false,
      });

      mockFaceRecognition.providerName = 'insightface';
      mockPrisma.session.findUnique.mockResolvedValue(validSession);
      mockPrisma.student.findMany.mockResolvedValue([
        { id: 'st-101', faceEmbedding: [0.1, 0.2, 0.3] },
      ]);
      mockFaceRecognition.identifyFace.mockResolvedValue({ studentId: 'st-101', confidence: 0.98 });
      mockPrisma.student.findUnique.mockResolvedValue({
        id: 'st-101',
        fullName: 'Ama Serwaa',
        indexNumber: '10293847',
      });
      mockPrisma.attendanceRecord.findUnique.mockResolvedValue(null);
      mockPrisma.attendanceRecord.create.mockResolvedValue({ id: 'rec-new-2' });

      // Location coordinates are far away (50km away), but geofencing is false
      const res = await service.checkIn('sess-1', {
        latitude: 5.999,
        longitude: -0.999,
        imageBuffer: Buffer.from('selfie'),
      });

      expect(res.success).toBe(true);
      expect(res.student.fullName).toBe('Ama Serwaa');
      expect(mockFaceRecognition.identifyFace).toHaveBeenCalled();
    });
  });
});
