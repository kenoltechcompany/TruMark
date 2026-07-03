import { Controller, Get, Post, Body, Param, Delete, UseGuards, Query } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CourseRepsService } from './course-reps.service';
import { IsString, IsEmail, MinLength, IsArray } from 'class-validator';

export class CreateCourseRepDto {
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

@UseGuards(AuthGuard('jwt'))
@Controller('course-reps')
export class CourseRepsController {
  constructor(private readonly courseRepsService: CourseRepsService) {}

  @Post()
  create(@Body() dto: CreateCourseRepDto) {
    return this.courseRepsService.create(dto);
  }

  @Get()
  findAll() {
    return this.courseRepsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.courseRepsService.findOne(id);
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
