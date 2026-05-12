import { Injectable } from '@nestjs/common';
import { Prisma, Room } from '@prisma/client';
import * as crypto from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { AppException } from '../../common/errors/app.exception';
import { ErrorCodes } from '../../common/errors/error-codes';
import { Paginated, paginate } from '../../common/dto/pagination.dto';
import { CreateRoomDto, UpdateRoomDto } from './dto/room.dto';

/**
 * Normalises a BSSID to lowercase, colon-separated form so the scan-time
 * comparison is exact regardless of how the admin typed it in.
 */
function normalizeBssid(b: string): string {
  return b.trim().replace(/-/g, ':').toLowerCase();
}

@Injectable()
export class RoomsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    universityId: string,
    page: number,
    pageSize: number,
    search?: string,
  ): Promise<Paginated<Room>> {
    const where: Prisma.RoomWhereInput = {
      universityId,
      deletedAt: null,
      ...(search ? { name: { contains: search, mode: 'insensitive' } } : {}),
    };
    const [total, data] = await this.prisma.$transaction([
      this.prisma.room.count({ where }),
      this.prisma.room.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return paginate(data, total, page, pageSize);
  }

  async findById(universityId: string, id: string): Promise<Room> {
    const r = await this.prisma.room.findFirst({
      where: { id, universityId, deletedAt: null },
    });
    if (!r) throw new AppException(ErrorCodes.NOT_FOUND);
    return r;
  }

  create(universityId: string, dto: CreateRoomDto): Promise<Room> {
    return this.prisma.room.create({
      data: {
        universityId,
        name: dto.name,
        type: dto.type,
        capacity: dto.capacity,
        latitude: dto.latitude,
        longitude: dto.longitude,
        gpsRadius: dto.gpsRadius ?? 50,
        gpsEnabled: dto.gpsEnabled ?? true,
        building: dto.building,
        floor: dto.floor,
        wifiBssids: dto.wifiBssids?.map(normalizeBssid) ?? [],
        bleBeaconId: dto.bleBeaconId?.trim() || null,
        qrCodeStatic: crypto.randomBytes(16).toString('hex'),
      },
    });
  }

  async update(universityId: string, id: string, dto: UpdateRoomDto): Promise<Room> {
    await this.findById(universityId, id);
    const data: Prisma.RoomUpdateInput = { ...dto };
    if (dto.wifiBssids !== undefined) {
      data.wifiBssids = { set: dto.wifiBssids.map(normalizeBssid) };
    }
    if (dto.bleBeaconId !== undefined) {
      data.bleBeaconId = dto.bleBeaconId?.trim() || null;
    }
    return this.prisma.room.update({ where: { id }, data });
  }

  async softDelete(universityId: string, id: string): Promise<void> {
    await this.findById(universityId, id);
    await this.prisma.room.update({ where: { id }, data: { deletedAt: new Date() } });
  }
}
