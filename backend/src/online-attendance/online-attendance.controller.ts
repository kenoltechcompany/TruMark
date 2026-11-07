import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Req,
  UseGuards,
  Headers,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CourseRepRoleGuard } from '../guards/course-rep-role.guard';
import { OnlineAttendanceService } from './online-attendance.service';
import {
  LaunchOnlineAttendanceDto,
  UpdateOnlineAttendanceConfigDto,
  BotHeartbeatDto,
  BotConcludeDto,
} from './online-attendance.dto';

@Controller()
export class OnlineAttendanceController {
  constructor(private readonly service: OnlineAttendanceService) {}

  // ── Course Representative Endpoints ──

  @UseGuards(AuthGuard('jwt'), CourseRepRoleGuard)
  @Post('course-rep/sessions/:sessionId/online-attendance')
  launchJob(
    @Param('sessionId') sessionId: string,
    @Body() dto: LaunchOnlineAttendanceDto,
    @Req() req: any,
  ) {
    return this.service.launchJob(sessionId, dto, req.user.id);
  }

  @UseGuards(AuthGuard('jwt'), CourseRepRoleGuard)
  @Patch('course-rep/sessions/:sessionId/online-attendance/config')
  updateConfig(
    @Param('sessionId') sessionId: string,
    @Body() dto: UpdateOnlineAttendanceConfigDto,
    @Req() req: any,
  ) {
    return this.service.updateJobConfig(sessionId, dto, req.user.id);
  }

  @UseGuards(AuthGuard('jwt'), CourseRepRoleGuard)
  @Post('course-rep/sessions/:sessionId/online-attendance/conclude')
  concludeJob(@Param('sessionId') sessionId: string, @Req() req: any) {
    return this.service.concludeJob(sessionId, req.user.id);
  }

  @UseGuards(AuthGuard('jwt'), CourseRepRoleGuard)
  @Get('course-rep/sessions/:sessionId/online-attendance')
  getJobStatus(@Param('sessionId') sessionId: string) {
    return this.service.getJobStatus(sessionId);
  }

  // ── Internal Meeting Bot Webhook Endpoints ──

  @Post('online-attendance/bot/heartbeat')
  handleHeartbeat(
    @Body() dto: BotHeartbeatDto,
    @Headers('x-bot-api-key') apiKey?: string,
  ) {
    const expectedKey = process.env.BOT_API_KEY || 'trumark-bot-secret';
    if (apiKey && apiKey !== expectedKey) {
      throw new UnauthorizedException('Invalid x-bot-api-key signature.');
    }
    return this.service.handleHeartbeat(dto);
  }

  @Post('online-attendance/bot/conclude')
  handleConclude(
    @Body() dto: BotConcludeDto,
    @Headers('x-bot-api-key') apiKey?: string,
  ) {
    const expectedKey = process.env.BOT_API_KEY || 'trumark-bot-secret';
    if (apiKey && apiKey !== expectedKey) {
      throw new UnauthorizedException('Invalid x-bot-api-key signature.');
    }
    return this.service.handleConclude(dto);
  }
}
