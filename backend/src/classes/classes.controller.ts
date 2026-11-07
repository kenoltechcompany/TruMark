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
import { ClassesService } from './classes.service';
import { IsString, MinLength, IsOptional, IsArray } from 'class-validator';

export class CreateClassDto {
  @IsString()
  @MinLength(1)
  name: string;
}

export class UpdateClassDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;
}

export class BulkDeleteDto {
  @IsArray()
  @IsString({ each: true })
  ids: string[];
}

@UseGuards(AuthGuard('jwt'))
@Controller('classes')
export class ClassesController {
  constructor(private readonly classesService: ClassesService) {}

  @Post()
  @UseGuards(AdminRoleGuard)
  create(@Body() dto: CreateClassDto) {
    return this.classesService.create(dto);
  }

  @Get()
  findAll() {
    return this.classesService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.classesService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(AdminRoleGuard)
  update(@Param('id') id: string, @Body() dto: UpdateClassDto) {
    return this.classesService.update(id, dto);
  }

  @Delete('bulk')
  @UseGuards(AdminRoleGuard)
  removeMany(@Body() dto: BulkDeleteDto) {
    return this.classesService.removeMany(dto.ids);
  }

  @Delete(':id')
  @UseGuards(AdminRoleGuard)
  remove(@Param('id') id: string) {
    return this.classesService.remove(id);
  }
}
