import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { OnlineAttendanceController } from './online-attendance.controller';
import { OnlineAttendanceService } from './online-attendance.service';

@Module({
  imports: [PrismaModule],
  controllers: [OnlineAttendanceController],
  providers: [OnlineAttendanceService],
  exports: [OnlineAttendanceService],
})
export class OnlineAttendanceModule {}
