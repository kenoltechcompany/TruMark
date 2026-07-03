import {
  Controller, Get, Post, Param, Body,
  UseInterceptors, UploadedFiles, UploadedFile,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { PublicRegistrationService } from './public-registration.service';
import { IsString, MinLength, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

export class RegisterStudentDto {
  @IsString()
  @MinLength(1)
  fullName: string;

  @IsString()
  @MinLength(1)
  indexNumber: string;
}

export class CheckInDto {
  @IsNumber()
  @Type(() => Number)
  latitude: number;

  @IsNumber()
  @Type(() => Number)
  longitude: number;
}

@Controller('public')
export class PublicRegistrationController {
  constructor(private readonly service: PublicRegistrationService) {}

  @Get('classes/:id/registration-status')
  checkStatus(@Param('id') id: string) {
    return this.service.checkRegistrationStatus(id);
  }

  @Post('classes/:id/register-student')
  @UseInterceptors(FilesInterceptor('images', 3))
  registerStudent(
    @Param('id') id: string,
    @Body() dto: RegisterStudentDto,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    if (!files || files.length !== 3) {
      throw new Error('Exactly 3 images are required.');
    }
    const paths = files.map((f) => f.path);
    return this.service.registerStudent(id, dto, paths);
  }

  @Get('sessions/:id')
  getSession(@Param('id') id: string) {
    return this.service.getSession(id);
  }

  @Post('sessions/:id/check-in')
  @UseInterceptors(FileInterceptor('image', { storage: memoryStorage() }))
  async checkIn(
    @Param('id') id: string,
    @Body() dto: CheckInDto,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new Error('Image file is required.');
    }
    return this.service.checkIn(id, dto.latitude, dto.longitude, file.buffer);
  }
}
