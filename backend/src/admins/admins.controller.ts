import { Controller, Get, Body, Param, Delete, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AdminsService } from './admins.service';
import { IsArray, IsString } from 'class-validator';

export class BulkPurgeStudentsDto {
  @IsArray()
  @IsString({ each: true })
  studentIds: string[];
}

@Controller('admins')
@UseGuards(AuthGuard('jwt'))
export class AdminsController {
  constructor(private readonly adminsService: AdminsService) {}

  @Get()
  findAll() {
    return this.adminsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.adminsService.findOne(id);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.adminsService.remove(id);
  }

  @Get('students/all')
  getAllStudents() {
    return this.adminsService.getAllStudents();
  }

  @Delete('students/purge')
  purgeStudents(@Body() dto: BulkPurgeStudentsDto) {
    return this.adminsService.purgeStudents(dto.studentIds);
  }
}
