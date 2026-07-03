import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { AdminsModule } from './admins/admins.module';
import { CourseRepsModule } from './course-reps/course-reps.module';
import { ClassesModule } from './classes/classes.module';
import { ClassroomsModule } from './classrooms/classrooms.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    AdminsModule,
    CourseRepsModule,
    ClassesModule,
    ClassroomsModule,
  ],
})
export class AppModule {}
