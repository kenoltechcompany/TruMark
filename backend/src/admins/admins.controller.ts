import { Controller, Get, Post, Body, Param, Delete, UseGuards, Query } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AdminsService } from './admins.service';
import { IsString, MinLength, IsArray } from 'class-validator';

export class CreateAdminDto {
  @IsString()
  @MinLength(3)
  username: string;

  @IsString()
  @MinLength(6)
  password: string;
}

export class BulkPurgeStudentsDto {
  @IsArray()
  @IsString({ each: true })
  studentIds: string[];
}

@Controller('admins')
export class AdminsController {
  constructor(private readonly adminsService: AdminsService) {}

  @Post()
  create(@Body() dto: CreateAdminDto) {
    return this.adminsService.create(dto);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get()
  findAll() {
    return this.adminsService.findAll();
  }

  @UseGuards(AuthGuard('jwt'))
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.adminsService.findOne(id);
  }

  @UseGuards(AuthGuard('jwt'))
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.adminsService.remove(id);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('students/all')
  getAllStudents() {
    return this.adminsService.getAllStudents();
  }

  @UseGuards(AuthGuard('jwt'))
  @Delete('students/purge')
  purgeStudents(@Body() dto: BulkPurgeStudentsDto) {
    return this.adminsService.purgeStudents(dto.studentIds);
  }
}
