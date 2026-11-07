import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AdminRoleGuard } from '../guards/admin-role.guard';
import { CourseRepsService } from './course-reps.service';
import {
  IsString,
  IsEmail,
  MinLength,
  IsArray,
  IsOptional,
} from 'class-validator';

export class CreateCourseRepDto {
  @IsString()
  @MinLength(1)
  fullName: string;

  @IsString()
  @MinLength(1)
  indexNumber: string;

  @IsString()
  classId: string;

  @IsString()
  @MinLength(3)
  username: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  password: string;
}

export class UpdateCourseRepDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  fullName?: string;

  @IsOptional()
  @IsString()
  @MinLength(3)
  username?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MinLength(6)
  password?: string;

  @IsOptional()
  @IsString()
  classId?: string;
}

export class PromoteStudentDto {
  @IsString()
  studentId: string;

  @IsString()
  @MinLength(3)
  username: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  password: string;
}

export class BulkDeleteDto {
  @IsArray()
  @IsString({ each: true })
  ids: string[];
}

@UseGuards(AuthGuard('jwt'), AdminRoleGuard)
@Controller('course-reps')
export class CourseRepsController {
  constructor(private readonly courseRepsService: CourseRepsService) {}

  @Post()
  create(@Body() dto: CreateCourseRepDto) {
    return this.courseRepsService.create(dto);
  }

  @Post('promote-student')
  promoteStudent(@Body() dto: PromoteStudentDto) {
    return this.courseRepsService.promoteStudent(dto);
  }

  @Get()
  findAll() {
    return this.courseRepsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.courseRepsService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateCourseRepDto) {
    return this.courseRepsService.update(id, dto);
  }

  @Delete('bulk')
  removeMany(@Body() dto: BulkDeleteDto) {
    return this.courseRepsService.removeMany(dto.ids);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.courseRepsService.remove(id);
  }
}
