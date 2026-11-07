import {
  IsString,
  IsOptional,
  IsBoolean,
  IsNumber,
  IsUrl,
  IsArray,
  IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';
import { BotStatus } from '@prisma/client';

export class LaunchOnlineAttendanceDto {
  @IsString()
  @IsUrl({}, { message: 'Must be a valid meeting URL (e.g. Google Meet, Zoom)' })
  meetingUrl: string;

  @IsOptional()
  @IsString()
  platform?: string;

  @IsOptional()
  @IsBoolean()
  isTimeBound?: boolean;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  minStayMinutes?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  durationMinutes?: number;
}

export class UpdateOnlineAttendanceConfigDto {
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  minStayMinutes?: number;
}

export class BotHeartbeatDto {
  @IsString()
  jobId: string;

  @IsString()
  sessionId: string;

  @IsEnum(BotStatus)
  status: BotStatus;

  @IsOptional()
  @IsString()
  statusMessage?: string;

  @IsOptional()
  @IsString()
  directWorkerUrl?: string;

  @IsOptional()
  @IsNumber()
  cycleCount?: number;

  @IsOptional()
  attendeeMinutes?: Record<string, number>;
}

export class BotConcludeDto {
  @IsString()
  jobId: string;

  @IsString()
  sessionId: string;

  @IsString()
  status: string;

  @IsArray()
  @IsString({ each: true })
  qualifiedStudents: string[];

  @IsOptional()
  attendeeMinutes?: Record<string, number>;

  @IsOptional()
  @IsNumber()
  totalCycles?: number;
}
