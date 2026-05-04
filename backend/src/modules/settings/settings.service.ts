import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AppException } from '../../common/errors/app.exception';
import { ErrorCodes } from '../../common/errors/error-codes';
import { AuditService } from '../audit/audit.service';

export interface UniversitySettings {
  schoolYear?: string;
  weekStartsOn?: number; // 0=Sun, 1=Mon … 6=Sat
  defaultLateAfterMinutes?: number;
  brandLogoUrl?: string;
  arabicName?: string;
}

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  async get(universityId: string) {
    const u = await this.prisma.university.findUnique({ where: { id: universityId } });
    if (!u) throw new AppException(ErrorCodes.NOT_FOUND);
    const s = (u.settings ?? {}) as Record<string, unknown>;
    return {
      universityId: u.id,
      name: u.name,
      slug: u.slug,
      settings: {
        schoolYear: s.schoolYear ?? null,
        weekStartsOn: typeof s.weekStartsOn === 'number' ? s.weekStartsOn : 6,
        defaultLateAfterMinutes:
          typeof s.defaultLateAfterMinutes === 'number' ? s.defaultLateAfterMinutes : 15,
        brandLogoUrl: s.brandLogoUrl ?? null,
        arabicName: s.arabicName ?? null,
      },
    };
  }

  async update(universityId: string, actorId: string, patch: Partial<UniversitySettings> & { name?: string }) {
    const before = await this.prisma.university.findUnique({ where: { id: universityId } });
    if (!before) throw new AppException(ErrorCodes.NOT_FOUND);
    const merged = { ...((before.settings ?? {}) as object), ...patch };
    delete (merged as Record<string, unknown>).name;
    const after = await this.prisma.university.update({
      where: { id: universityId },
      data: {
        ...(typeof patch.name === 'string' && patch.name.trim() ? { name: patch.name.trim() } : {}),
        settings: merged as Prisma.InputJsonValue,
      },
    });
    await this.audit.record({
      universityId,
      actorId,
      action: 'settings.update',
      entity: 'University',
      entityId: universityId,
      before: { name: before.name, settings: before.settings },
      after: { name: after.name, settings: after.settings },
    });
    return this.get(universityId);
  }
}
