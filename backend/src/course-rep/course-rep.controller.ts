import {
  Controller, Get, Patch, Post, Delete, Body, Param,
  UseGuards, UseInterceptors, UploadedFiles, Req,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FilesInterceptor } from '@nestjs/platform-express';
import { CourseRepRoleGuard } from '../guards/course-rep-role.guard';
import { CourseRepService } from './course-rep.service';
import { IsString, IsArray, MinLength } from 'class-validator';

export class CreateStudentDto {
  @IsString()
  @MinLength(1)
  fullName: string;

  @IsString()
  @MinLength(1)
  indexNumber: string;
}

export class BulkDeleteStudentsDto {
  @IsArray()
  @IsString({ each: true })
  studentIds: string[];
}

@UseGuards(AuthGuard('jwt'), CourseRepRoleGuard)
@Controller('course-rep')
export class CourseRepController {
  constructor(private readonly courseRepService: CourseRepService) {}

  @Get('my-class')
  getMyClass(@Req() req: any) {
    return this.courseRepService.getMyClass(req.user.id);
  }

  @Patch('my-class/toggle-registration')
  toggleRegistration(@Req() req: any) {
    return this.courseRepService.toggleRegistration(req.user.id);
  }

  @Post('students')
  @UseInterceptors(FilesInterceptor('images', 3))
  createStudent(
    @Req() req: any,
    @Body() dto: CreateStudentDto,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    if (!files || files.length !== 3) {
      throw new Error('Exactly 3 images are required.');
    }
    const paths = files.map((f) => f.path);
    return this.courseRepService.createStudent(req.user.id, dto, paths);
  }

  @Delete('students/bulk')
  deleteStudents(@Req() req: any, @Body() dto: BulkDeleteStudentsDto) {
    return this.courseRepService.deleteStudents(req.user.id, dto.studentIds);
  }
}
