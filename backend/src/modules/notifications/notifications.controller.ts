import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUniversity } from '../../common/decorators/university.decorator';
import { CurrentUser, AuthPrincipal } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { SendNotificationDto } from './dto/notification.dto';
import { NotificationsService } from './notifications.service';
import { AppException } from '../../common/errors/app.exception';
import { ErrorCodes } from '../../common/errors/error-codes';

@ApiBearerAuth()
@ApiTags('notifications')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(@CurrentUser() user: AuthPrincipal, @Query() q: PaginationQueryDto) {
    return this.notifications.listForUser(user.userId, q.page ?? 1, q.pageSize ?? 20);
  }

  @Post('send')
  @Roles('admin', 'doctor')
  send(
    @CurrentUniversity() uni: string,
    @CurrentUser() user: AuthPrincipal,
    @Body() dto: SendNotificationDto,
  ) {
    if (!uni) throw new AppException(ErrorCodes.UNAUTHORIZED);
    // Broadcast can hit every user in the tenant — restrict to admins.
    if (dto.targetType === 'broadcast' && user.role !== 'admin') {
      throw new AppException(ErrorCodes.FORBIDDEN);
    }
    return this.notifications.sendFromController(uni, user.userId, dto);
  }

  @Put(':id/read')
  @HttpCode(HttpStatus.OK)
  async markRead(@CurrentUser() user: AuthPrincipal, @Param('id', new ParseUUIDPipe()) id: string) {
    await this.notifications.markRead(user.userId, id);
    return { success: true };
  }

  @Put('read-all')
  @HttpCode(HttpStatus.OK)
  async markAll(@CurrentUser() user: AuthPrincipal) {
    await this.notifications.markAllRead(user.userId);
    return { success: true };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async remove(@CurrentUser() user: AuthPrincipal, @Param('id', new ParseUUIDPipe()) id: string) {
    await this.notifications.deleteForUser(user.userId, id);
    return { success: true };
  }
}
