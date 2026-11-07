import { Module } from '@nestjs/common';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { AdminsModule } from './admins/admins.module';
import { CourseRepsModule } from './course-reps/course-reps.module';
import { ClassesModule } from './classes/classes.module';
import { ClassroomsModule } from './classrooms/classrooms.module';
import { CourseRepModule } from './course-rep/course-rep.module';
import { PublicRegistrationModule } from './public-registration/public-registration.module';
import { AzureFaceModule } from './azure-face/azure-face.module';
import { FaceRecognitionModule } from './face-recognition/face-recognition.module';
import { AppThrottlerModule } from './throttler/throttler.module';
import { OnlineAttendanceModule } from './online-attendance/online-attendance.module';

@Module({
  imports: [
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), 'uploads'),
      serveRoot: '/uploads',
    }),
    PrismaModule,
    AppThrottlerModule,
    AuthModule,
    AdminsModule,
    CourseRepsModule,
    ClassesModule,
    ClassroomsModule,
    CourseRepModule,
    PublicRegistrationModule,
    AzureFaceModule,
    FaceRecognitionModule,
    OnlineAttendanceModule,
  ],
})
export class AppModule {}
