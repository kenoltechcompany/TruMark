import { Module } from '@nestjs/common';
import { CourseRepsService } from './course-reps.service';
import { CourseRepsController } from './course-reps.controller';

@Module({
  controllers: [CourseRepsController],
  providers: [CourseRepsService],
})
export class CourseRepsModule {}
