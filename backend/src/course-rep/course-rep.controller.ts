import {
  Controller,
  Get,
  Patch,
  Post,
  Delete,
  Body,
  Param,
  Req,
  Res,
  UseGuards,
  UseInterceptors,
  UploadedFiles,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FilesInterceptor, FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Throttle } from '@nestjs/throttler';
import { CourseRepRoleGuard } from '../guards/course-rep-role.guard';
import { CourseRepService } from './course-rep.service';
import {
  IsString,
  IsArray,
  MinLength,
  IsDateString,
  IsOptional,
} from 'class-validator';

export class CreateStudentDto {
  @IsString()
  @MinLength(1)
  fullName: string;

  @IsString()
  @MinLength(1)
  indexNumber: string;
}

export class UpdateStudentDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  fullName?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  indexNumber?: string;
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

export class UpdateSessionDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsDateString()
  startTime?: string;

  @IsOptional()
  @IsDateString()
  endTime?: string;

  @IsOptional()
  @IsString()
  classroomId?: string;
}

export class BulkDeleteSessionsDto {
  @IsArray()
  @IsString({ each: true })
  sessionIds: string[];
}

export class ManualAttendanceDto {
  @IsString()
  studentId: string;
}

const imageFileFilter = (
  _req: any,
  file: Express.Multer.File,
  callback: (error: Error | null, acceptFile: boolean) => void,
) => {
  if (!file.mimetype.match(/^image\/(jpeg|png|webp|jpg)$/i)) {
    return callback(
      new BadRequestException('Only image files (jpeg, png, webp) are allowed.'),
      false,
    );
  }
  callback(null, true);
};

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
  @UseInterceptors(
    FilesInterceptor('images', 3, {
      storage: memoryStorage(),
      fileFilter: imageFileFilter,
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  createStudent(
    @Req() req: any,
    @Body() dto: CreateStudentDto,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    if (!files || files.length !== 3) {
      throw new BadRequestException('Exactly 3 reference images are required.');
    }
    const buffers = files.map((f) => f.buffer);
    return this.courseRepService.createStudent(req.user.id, dto, buffers);
  }

  @Post('my-class/students/import-csv')
  @UseInterceptors(FileInterceptor('file'))
  importStudentsCsv(
    @Req() req: any,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('A CSV file is required.');
    const csvContent = file.buffer.toString('utf-8');
    return this.courseRepService.importStudentsCsv(req.user.id, csvContent);
  }

  @Get('students/:studentId')
  getStudent(@Req() req: any, @Param('studentId') studentId: string) {
    return this.courseRepService.getStudent(req.user.id, studentId);
  }

  @Patch('students/:studentId')
  updateStudent(
    @Req() req: any,
    @Param('studentId') studentId: string,
    @Body() dto: UpdateStudentDto,
  ) {
    return this.courseRepService.updateStudent(req.user.id, studentId, dto);
  }

  @Delete('students/:studentId')
  deleteStudent(@Req() req: any, @Param('studentId') studentId: string) {
    return this.courseRepService.deleteStudent(req.user.id, studentId);
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

  @Get('sessions/:sessionId')
  getSession(@Req() req: any, @Param('sessionId') sessionId: string) {
    return this.courseRepService.getSession(req.user.id, sessionId);
  }

  @Patch('sessions/:sessionId')
  updateSession(
    @Req() req: any,
    @Param('sessionId') sessionId: string,
    @Body() dto: UpdateSessionDto,
  ) {
    return this.courseRepService.updateSession(req.user.id, sessionId, dto);
  }

  @Delete('sessions/:sessionId')
  deleteSession(@Req() req: any, @Param('sessionId') sessionId: string) {
    return this.courseRepService.deleteSession(req.user.id, sessionId);
  }

  @Delete('sessions/bulk')
  deleteSessions(@Req() req: any, @Body() dto: BulkDeleteSessionsDto) {
    return this.courseRepService.deleteSessions(req.user.id, dto.sessionIds);
  }

  @Patch('sessions/:sessionId/toggle-lock')
  toggleSessionLock(
    @Req() req: any,
    @Param('sessionId') sessionId: string,
  ) {
    return this.courseRepService.toggleSessionLock(req.user.id, sessionId);
  }

  @Post('my-class/sync')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  syncToAzure(@Req() req: any) {
    return this.courseRepService.syncToAzure(req.user.id);
  }

  // ── Attendance ──

  @Get('sessions/:sessionId/attendance')
  getAttendance(@Param('sessionId') sessionId: string) {
    return this.courseRepService.getAttendance(sessionId);
  }

  @Post('sessions/:sessionId/attendance/manual')
  manualAttendance(
    @Req() req: any,
    @Param('sessionId') sessionId: string,
    @Body() dto: ManualAttendanceDto,
  ) {
    return this.courseRepService.manualAttendance(req.user.id, sessionId, dto.studentId);
  }

  @Delete('sessions/:sessionId/attendance/:attendanceId')
  deleteAttendanceRecord(
    @Req() req: any,
    @Param('sessionId') sessionId: string,
    @Param('attendanceId') attendanceId: string,
  ) {
    return this.courseRepService.deleteAttendanceRecord(
      req.user.id,
      sessionId,
      attendanceId,
    );
  }

  @Get('sessions/:sessionId/export')
  async exportCsv(
    @Param('sessionId') sessionId: string,
    @Req() req: any,
    @Res() res: any,
  ) {
    const csv = await this.courseRepService.exportSessionCsv(
      req.user.id,
      sessionId,
    );
    res.header('Content-Type', 'text/csv; charset=utf-8');
    res.header(
      'Content-Disposition',
      `attachment; filename=attendance_${sessionId}.csv`,
    );
    res.send(csv);
  }
}
