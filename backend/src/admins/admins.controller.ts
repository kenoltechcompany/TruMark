import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Delete,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import { AdminRoleGuard } from '../guards/admin-role.guard';
import { AdminsService } from './admins.service';
import { IsArray, IsBoolean, IsNumber, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateAdminDto {
  @IsString()
  @MinLength(3)
  username: string;

  @IsString()
  @MinLength(6)
  password: string;
}

export class UpdateAdminDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  username?: string;

  @IsOptional()
  @IsString()
  @MinLength(6)
  password?: string;
}

export class CreateStudentAdminDto {
  @IsString()
  @MinLength(1)
  fullName: string;

  @IsString()
  @MinLength(1)
  indexNumber: string;
}

export class BulkPurgeStudentsDto {
  @IsArray()
  @IsString({ each: true })
  studentIds: string[];
}

export class UpdateStudentAdminDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  fullName?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  indexNumber?: string;

  @IsOptional()
  @IsString()
  classId?: string;
}

export class UpdateSystemSettingsDto {
  @IsOptional()
  @IsBoolean()
  enableLandingPage?: boolean;

  @IsOptional()
  @IsBoolean()
  enableBiometricValidation?: boolean;

  @IsOptional()
  @IsBoolean()
  enableGeofencing?: boolean;

  @IsOptional()
  @IsBoolean()
  idHasNumbers?: boolean;

  @IsOptional()
  @IsBoolean()
  idHasAlphabets?: boolean;

  @IsOptional()
  @IsNumber()
  idMinLength?: number;

  @IsOptional()
  @IsNumber()
  idMaxLength?: number;

  @IsOptional()
  @IsString()
  idPrefix?: string;

  @IsOptional()
  @IsString()
  idSuffix?: string;

  @IsOptional()
  @IsString()
  botServiceUrl?: string;

  @IsOptional()
  @IsString()
  botApiKey?: string;
}

@Controller('admins')
@UseGuards(AuthGuard('jwt'), AdminRoleGuard)
export class AdminsController {
  constructor(private readonly adminsService: AdminsService) {}

  // ── Admin Accounts Management ──

  @Post()
  create(@Body() dto: CreateAdminDto) {
    return this.adminsService.create(dto);
  }

  @Get()
  findAll() {
    return this.adminsService.findAll();
  }

  // ── Global Student Roster & Management ──

  @Get('students/all')
  getAllStudents() {
    return this.adminsService.getAllStudents();
  }

  @Post('classes/:classId/students')
  createStudent(
    @Param('classId') classId: string,
    @Body() dto: CreateStudentAdminDto,
  ) {
    return this.adminsService.createStudent(classId, dto);
  }

  @Post('classes/:classId/students/import-csv')
  @UseInterceptors(FileInterceptor('file'))
  importStudentsCsv(
    @Param('classId') classId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('A CSV file is required.');
    }
    const csvContent = file.buffer.toString('utf-8');
    return this.adminsService.importStudentsCsv(classId, csvContent);
  }

  @Patch('students/:studentId')
  updateStudent(
    @Param('studentId') studentId: string,
    @Body() dto: UpdateStudentAdminDto,
  ) {
    return this.adminsService.updateStudent(studentId, dto);
  }

  @Delete('students/purge')
  purgeStudents(@Body() dto: BulkPurgeStudentsDto) {
    return this.adminsService.purgeStudents(dto.studentIds);
  }

  @Delete('students/:studentId')
  deleteStudent(@Param('studentId') studentId: string) {
    return this.adminsService.deleteStudent(studentId);
  }

  // ── Class Sessions & Attendance Audit ──

  @Get('classes/:classId/sessions')
  getClassSessions(@Param('classId') classId: string) {
    return this.adminsService.getClassSessions(classId);
  }

  @Get('sessions/:sessionId/attendance')
  getSessionAttendance(@Param('sessionId') sessionId: string) {
    return this.adminsService.getSessionAttendance(sessionId);
  }

  // ── Global System Settings ──

  @Get('settings')
  getSettings() {
    return this.adminsService.getSettings();
  }

  @Patch('settings')
  updateSettings(@Body() dto: UpdateSystemSettingsDto) {
    return this.adminsService.updateSettings(dto);
  }

  // ── Parameterized Admin routes (Placed last to prevent path shadowing) ──

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.adminsService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateAdminDto) {
    return this.adminsService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.adminsService.remove(id);
  }
}
