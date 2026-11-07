import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AdminRoleGuard } from '../guards/admin-role.guard';
import { ClassroomsService } from './classrooms.service';
import {
  IsString,
  IsNumber,
  MinLength,
  IsOptional,
  IsArray,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateClassroomDto {
  @IsString()
  @MinLength(1)
  name: string;

  @IsNumber()
  @Type(() => Number)
  gpsLatitude: number;

  @IsNumber()
  @Type(() => Number)
  gpsLongitude: number;

  @IsNumber()
  @Type(() => Number)
  radiusMeters: number;
}

export class UpdateClassroomDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  gpsLatitude?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  gpsLongitude?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  radiusMeters?: number;
}

export class BulkDeleteDto {
  @IsArray()
  @IsString({ each: true })
  ids: string[];
}

@UseGuards(AuthGuard('jwt'))
@Controller('classrooms')
export class ClassroomsController {
  constructor(private readonly classroomsService: ClassroomsService) {}

  @Post()
  @UseGuards(AdminRoleGuard)
  create(@Body() dto: CreateClassroomDto) {
    return this.classroomsService.create(dto);
  }

  @Get()
  findAll() {
    return this.classroomsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.classroomsService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(AdminRoleGuard)
  update(@Param('id') id: string, @Body() dto: UpdateClassroomDto) {
    return this.classroomsService.update(id, dto);
  }

  @Delete('bulk')
  @UseGuards(AdminRoleGuard)
  removeMany(@Body() dto: BulkDeleteDto) {
    return this.classroomsService.removeMany(dto.ids);
  }

  @Delete(':id')
  @UseGuards(AdminRoleGuard)
  remove(@Param('id') id: string) {
    return this.classroomsService.remove(id);
  }
}
