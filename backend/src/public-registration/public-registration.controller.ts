import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseInterceptors,
  UploadedFiles,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Throttle } from '@nestjs/throttler';
import { PublicRegistrationService } from './public-registration.service';
import { IsString, MinLength, IsNumber, IsOptional } from 'class-validator';
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
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  latitude?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  longitude?: number;

  @IsOptional()
  @IsString()
  indexNumber?: string;
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

@Controller('public')
export class PublicRegistrationController {
  constructor(private readonly service: PublicRegistrationService) {}

  @Get('settings')
  getPublicSettings() {
    return this.service.getPublicSettings();
  }

  @Get('classes/:id/registration-status')
  checkStatus(@Param('id') id: string) {
    return this.service.checkRegistrationStatus(id);
  }

  @Get('students/:indexNumber/attendance')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  getStudentAttendance(@Param('indexNumber') indexNumber: string) {
    return this.service.getStudentAttendanceHistory(indexNumber);
  }

  @Post('classes/:id/register-student')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @UseInterceptors(
    FilesInterceptor('images', 3, {
      storage: memoryStorage(),
      fileFilter: imageFileFilter,
      limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB per photo
    }),
  )
  registerStudent(
    @Param('id') id: string,
    @Body() dto: RegisterStudentDto,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    if (!files || files.length !== 3) {
      throw new BadRequestException('Exactly 3 reference images are required for registration.');
    }
    const buffers = files.map((f) => f.buffer);
    return this.service.registerStudent(id, dto, buffers);
  }

  @Get('sessions/:id')
  getSession(@Param('id') id: string) {
    return this.service.getSession(id);
  }

  @Post('sessions/:id/check-in')
  @Throttle({ default: { limit: 15, ttl: 60000 } }) // 15 attempts per minute max per IP
  @UseInterceptors(
    FileInterceptor('image', {
      storage: memoryStorage(),
      fileFilter: imageFileFilter,
      limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB max
    }),
  )
  async checkIn(
    @Param('id') id: string,
    @Body() dto: CheckInDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.service.checkIn(id, {
      latitude: dto.latitude,
      longitude: dto.longitude,
      imageBuffer: file?.buffer,
      indexNumber: dto.indexNumber,
    });
  }
}
