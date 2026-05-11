import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { Paginated, paginate } from '../../common/dto/pagination.dto';

export interface AuditEntryInput {
  universityId: string;
  actorId?: string | null;
  actorRole?: string | null;
  action: string;
  entity?: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Records a single audit entry. Errors are swallowed and logged so that
   * audit failures never break the user-facing operation that triggered them.
   */
  async record(entry: AuditEntryInput): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          universityId: entry.universityId,
          actorId: entry.actorId ?? null,
          actorRole: entry.actorRole ?? null,
          action: entry.action,
          entity: entry.entity ?? null,
          entityId: entry.entityId ?? null,
          before: (entry.before ?? Prisma.DbNull) as Prisma.InputJsonValue,
          after: (entry.after ?? Prisma.DbNull) as Prisma.InputJsonValue,
          ipAddress: entry.ipAddress ?? null,
          userAgent: entry.userAgent ?? null,
        },
      });
    } catch (err) {
      this.logger.warn(`audit.record failed: ${(err as Error).message}`);
    }
  }

  async list(
    universityId: string,
    page: number,
    pageSize: number,
    filters: { actorId?: string; entity?: string; action?: string } = {},
  ): Promise<Paginated<unknown>> {
    const where: Prisma.AuditLogWhereInput = {
      universityId,
      ...(filters.actorId ? { actorId: filters.actorId } : {}),
      ...(filters.entity ? { entity: filters.entity } : {}),
      ...(filters.action ? { action: { contains: filters.action, mode: 'insensitive' } } : {}),
    };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return paginate(rows, total, page, pageSize);
  }
}
