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
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import * as QRCode from 'qrcode';
import { CurrentUniversity } from '../../common/decorators/university.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { CreateRoomDto, UpdateRoomDto } from './dto/room.dto';
import { RoomsService } from './rooms.service';
import { AppException } from '../../common/errors/app.exception';
import { ErrorCodes } from '../../common/errors/error-codes';

@ApiBearerAuth()
@ApiTags('rooms')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('rooms')
export class RoomsController {
  constructor(private readonly rooms: RoomsService) {}

  @Get()
  @Roles('admin', 'doctor')
  list(@CurrentUniversity() uni: string, @Query() q: PaginationQueryDto) {
    if (!uni) throw new AppException(ErrorCodes.UNAUTHORIZED);
    return this.rooms.list(uni, q.page ?? 1, q.pageSize ?? 20, q.search);
  }

  @Post()
  @Roles('admin')
  create(@CurrentUniversity() uni: string, @Body() dto: CreateRoomDto) {
    if (!uni) throw new AppException(ErrorCodes.UNAUTHORIZED);
    return this.rooms.create(uni, dto);
  }

  @Get(':id')
  @Roles('admin', 'doctor')
  findOne(@CurrentUniversity() uni: string, @Param('id', new ParseUUIDPipe()) id: string) {
    if (!uni) throw new AppException(ErrorCodes.UNAUTHORIZED);
    return this.rooms.findById(uni, id);
  }

  @Put(':id')
  @Roles('admin')
  update(
    @CurrentUniversity() uni: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateRoomDto,
  ) {
    if (!uni) throw new AppException(ErrorCodes.UNAUTHORIZED);
    return this.rooms.update(uni, id, dto);
  }

  @Delete(':id')
  @Roles('admin')
  @HttpCode(HttpStatus.OK)
  async remove(@CurrentUniversity() uni: string, @Param('id', new ParseUUIDPipe()) id: string) {
    if (!uni) throw new AppException(ErrorCodes.UNAUTHORIZED);
    await this.rooms.softDelete(uni, id);
    return { success: true };
  }

  @Get(':id/qr')
  @Roles('admin')
  @ApiOperation({ summary: 'Download a static room QR (PNG).' })
  async qr(
    @CurrentUniversity() uni: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Res() res: Response,
  ) {
    if (!uni) throw new AppException(ErrorCodes.UNAUTHORIZED);
    const room = await this.rooms.findById(uni, id);
    const png = await QRCode.toBuffer(`room:${room.id}:${room.qrCodeStatic ?? ''}`, {
      errorCorrectionLevel: 'H',
      width: 512,
    });
    res
      .setHeader('Content-Type', 'image/png')
      .setHeader('Content-Disposition', `inline; filename="room-${room.id}.png"`)
      .send(png);
  }
}
