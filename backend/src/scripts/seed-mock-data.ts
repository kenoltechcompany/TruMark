import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcryptjs';

async function main() {
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL!,
  });
  const prisma = new PrismaClient({ adapter });

  console.log('Seeding mock data for TruMark dev trial...');

  // 1. Clean existing records if any
  await prisma.attendanceRecord.deleteMany();
  await prisma.session.deleteMany();
  await prisma.student.deleteMany();
  await prisma.classroom.deleteMany();
  await prisma.class.deleteMany();
  await prisma.admin.deleteMany();

  const passwordHash = await bcrypt.hash('password123', 10);

  // 2. Seed Admin
  const admin = await prisma.admin.create({
    data: {
      username: 'admin',
      passwordHash,
    },
  });
  console.log('Created Admin user: admin / password123');

  // 3. Seed Classrooms
  const hallA = await prisma.classroom.create({
    data: {
      name: 'Science Lecture Hall A',
      gpsLatitude: 5.6037,
      gpsLongitude: -0.187,
      radiusMeters: 100,
    },
  });

  const lab3 = await prisma.classroom.create({
    data: {
      name: 'Computer Lab 3 (Turing Block)',
      gpsLatitude: 5.604,
      gpsLongitude: -0.1865,
      radiusMeters: 50,
    },
  });

  const auditoriumB = await prisma.classroom.create({
    data: {
      name: 'Engineering Auditorium B',
      gpsLatitude: 5.6025,
      gpsLongitude: -0.188,
      radiusMeters: 80,
    },
  });
  console.log('Created 3 Classrooms with geofencing');

  // 4. Seed Classes
  const cs400 = await prisma.class.create({
    data: {
      name: 'BSc Computer Science - Level 400',
      registrationLinkActive: true,
    },
  });

  const ee300 = await prisma.class.create({
    data: {
      name: 'BSc Electrical Engineering - Level 300',
      registrationLinkActive: true,
    },
  });

  const it200 = await prisma.class.create({
    data: {
      name: 'BSc Information Technology - Level 200',
      registrationLinkActive: false,
    },
  });
  console.log('Created 3 Classes');

  // 5. Seed Students & Elevated Course Reps (CS 400)
  const kwameRep = await prisma.student.create({
    data: {
      fullName: 'Kwame Mensah',
      indexNumber: '10293847',
      classId: cs400.id,
      isCourseRep: true,
      username: 'kwame_rep',
      email: 'kwame.mensah@school.edu',
      passwordHash,
      imagePaths: [],
    },
  });

  const kofi = await prisma.student.create({
    data: {
      fullName: 'Kofi Boateng',
      indexNumber: '10293849',
      classId: cs400.id,
      imagePaths: [],
    },
  });

  const ama = await prisma.student.create({
    data: {
      fullName: 'Ama Serwaa',
      indexNumber: '10293850',
      classId: cs400.id,
      imagePaths: [],
    },
  });

  const yaw = await prisma.student.create({
    data: {
      fullName: 'Yaw Appiah',
      indexNumber: '10293851',
      classId: cs400.id,
      imagePaths: [],
    },
  });

  const akua = await prisma.student.create({
    data: {
      fullName: 'Akua Dankwa',
      indexNumber: '10293852',
      classId: cs400.id,
      imagePaths: [],
    },
  });

  // Seed Students (EE 300)
  const abenaRep = await prisma.student.create({
    data: {
      fullName: 'Abena Osei',
      indexNumber: '10293848',
      classId: ee300.id,
      isCourseRep: true,
      username: 'abena_rep',
      email: 'abena.osei@school.edu',
      passwordHash,
      imagePaths: [],
    },
  });

  const esi = await prisma.student.create({
    data: {
      fullName: 'Esi Arthur',
      indexNumber: '10293853',
      classId: ee300.id,
      imagePaths: [],
    },
  });

  const kwaku = await prisma.student.create({
    data: {
      fullName: 'Kwaku Frimpong',
      indexNumber: '10293854',
      classId: ee300.id,
      imagePaths: [],
    },
  });
  console.log('Created Students & Course Reps: kwame_rep & abena_rep / password123');

  // 6. Seed Sessions
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 30 * 60 * 1000);
  const inNinetyMins = new Date(now.getTime() + 90 * 60 * 1000);
  const yesterdayStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const yesterdayEnd = new Date(yesterdayStart.getTime() + 2 * 60 * 60 * 1000);

  // Active Session happening now
  const activeSession = await prisma.session.create({
    data: {
      name: 'CS401: Distributed Systems & Cloud',
      startTime: oneHourAgo,
      endTime: inNinetyMins,
      classId: cs400.id,
      classroomId: hallA.id,
    },
  });

  // Past Session (yesterday)
  const pastSession = await prisma.session.create({
    data: {
      name: 'CS403: Mobile App Architectures Lab',
      startTime: yesterdayStart,
      endTime: yesterdayEnd,
      classId: cs400.id,
      classroomId: lab3.id,
    },
  });

  // EE past session
  const eeSession = await prisma.session.create({
    data: {
      name: 'EE301: Power Systems Engineering',
      startTime: new Date(now.getTime() - 48 * 60 * 60 * 1000),
      endTime: new Date(now.getTime() - 46 * 60 * 60 * 1000),
      classId: ee300.id,
      classroomId: auditoriumB.id,
    },
  });
  console.log(`Created Active Session: ${activeSession.name} (Live now!)`);
  console.log(`Created Past Sessions: ${pastSession.name}, ${eeSession.name}`);

  // 7. Seed Past Attendance Records
  await prisma.attendanceRecord.createMany({
    data: [
      {
        studentId: kwameRep.id,
        sessionId: pastSession.id,
        confidence: 0.985,
        createdAt: new Date(yesterdayStart.getTime() + 10 * 60 * 1000),
      },
      {
        studentId: kofi.id,
        sessionId: pastSession.id,
        confidence: 0.942,
        createdAt: new Date(yesterdayStart.getTime() + 12 * 60 * 1000),
      },
      {
        studentId: ama.id,
        sessionId: pastSession.id,
        confidence: 0.961,
        createdAt: new Date(yesterdayStart.getTime() + 15 * 60 * 1000),
      },
      {
        studentId: yaw.id,
        sessionId: pastSession.id,
        confidence: 0.893,
        createdAt: new Date(yesterdayStart.getTime() + 20 * 60 * 1000),
      },
      {
        studentId: abenaRep.id,
        sessionId: eeSession.id,
        confidence: 0.978,
      },
      {
        studentId: esi.id,
        sessionId: eeSession.id,
        confidence: 0.915,
      },
    ],
  });

  // Also seed 1 attendance record for the active session (Kwame checked in)
  await prisma.attendanceRecord.create({
    data: {
      studentId: kwameRep.id,
      sessionId: activeSession.id,
      confidence: 0.992,
      createdAt: new Date(oneHourAgo.getTime() + 5 * 60 * 1000),
    },
  });

  console.log('Seeded attendance records with realistic verification scores');
  console.log('\n--- Mock Data Setup Completed Successfully! ---');
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
