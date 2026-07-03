import {
  Controller, Get, Patch, Post, Delete, Body, Param, Req, Res,
  UseGuards, UseInterceptors, UploadedFiles,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FilesInterceptor } from '@nestjs/platform-express';
import { CourseRepRoleGuard } from '../guards/course-rep-role.guard';
import { CourseRepService } from './course-rep.service';
import { IsString, IsArray, MinLength, IsDateString } from 'class-validator';

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

export class CreateSessionDto {
  @IsString()
  @MinLength(1)
  name: string;

  @IsDateString()
  startTime: string;

  @IsDateString()
  endTime: string;

  @IsString()
  classroomId: string;
}

export class BulkDeleteSessionsDto {
  @IsArray()
  @IsString({ each: true })
  sessionIds: string[];
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

  // ── Students ──

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

  // ── Sessions ──

  @Post('sessions')
  createSession(@Req() req: any, @Body() dto: CreateSessionDto) {
    return this.courseRepService.createSession(req.user.id, dto);
  }

  @Get('sessions')
  getSessions(@Req() req: any) {
    return this.courseRepService.getSessions(req.user.id);
  }

  @Delete('sessions/bulk')
  deleteSessions(@Req() req: any, @Body() dto: BulkDeleteSessionsDto) {
    return this.courseRepService.deleteSessions(req.user.id, dto.sessionIds);
  }

  @Post('my-class/sync')
  syncToAzure(@Req() req: any) {
    return this.courseRepService.syncToAzure(req.user.id);
  }

  @Get('sessions/:sessionId/attendance')
  getAttendance(@Param('sessionId') sessionId: string) {
    return this.courseRepService.getAttendance(sessionId);
  }

  @Get('sessions/:sessionId/export')
  async exportCsv(@Param('sessionId') sessionId: string, @Req() req: any, @Res() res: any) {
    const csv = await this.courseRepService.exportSessionCsv(req.user.id, sessionId);
    res.header('Content-Type', 'text/csv; charset=utf-8');
    res.header('Content-Disposition', `attachment; filename=attendance_${sessionId}.csv`);
    res.send(csv);
  }
}
