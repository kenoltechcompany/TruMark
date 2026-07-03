import {
  Controller, Get, Post, Param, Body,
  UseInterceptors, UploadedFiles,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { PublicRegistrationService } from './public-registration.service';
import { IsString, MinLength } from 'class-validator';

export class RegisterStudentDto {
  @IsString()
  @MinLength(1)
  fullName: string;

  @IsString()
  @MinLength(1)
  indexNumber: string;
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
}
