import { Injectable } from '@nestjs/common';
import { Notification, NotificationType, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AppException } from '../../common/errors/app.exception';
import { ErrorCodes } from '../../common/errors/error-codes';
import { Paginated, paginate } from '../../common/dto/pagination.dto';
import { FcmService } from './fcm.service';
import { NotificationsGateway } from './notifications.gateway';
import { SendNotificationDto } from './dto/notification.dto';

export interface SendArgs {
  type: NotificationType;
  title: string;
  body: string;
  targetType: 'user' | 'section' | 'subject' | 'broadcast';
  targetId?: string;
  recipientUserIds?: string[];
}

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fcm: FcmService,
    private readonly gateway: NotificationsGateway,
  ) {}

  async send(universityId: string, senderId: string, args: SendArgs): Promise<Notification> {
    const recipients = await this.resolveRecipients(universityId, args);

    const notification = await this.prisma.notification.create({
      data: {
        universityId,
        senderId,
        type: args.type,
        title: args.title,
        body: args.body,
        targetType: args.targetType,
        targetId: args.targetId,
        recipients: {
          createMany: {
            data: recipients.map((userId) => ({ userId })),
            skipDuplicates: true,
          },
        },
      },
    });

    // Realtime fan-out
    for (const userId of recipients) {
      this.gateway.emitNew(userId, {
        id: notification.id,
        type: notification.type,
        title: notification.title,
        body: notification.body,
        sentAt: notification.sentAt.toISOString(),
      });
    }

    // FCM push: read all push tokens (multi-device) for the recipient users.
    const tokens = await this.prisma.pushToken.findMany({
      where: { userId: { in: recipients } },
      select: { token: true },
    });
    if (tokens.length > 0) {
      await this.fcm.sendToMany(
        tokens.map((t) => t.token),
        { title: notification.title, body: notification.body, data: { type: notification.type } },
      );
    } else {
      // Backwards-compat fallback: legacy single-token field.
      const legacy = await this.prisma.user.findMany({
        where: { id: { in: recipients }, fcmToken: { not: null } },
        select: { fcmToken: true },
      });
      if (legacy.length > 0) {
        await this.fcm.sendToMany(
          legacy.map((t) => t.fcmToken),
          { title: notification.title, body: notification.body, data: { type: notification.type } },
        );
      }
    }

    return notification;
  }

  async sendFromController(
    universityId: string,
    senderId: string,
    dto: SendNotificationDto,
  ): Promise<Notification> {
    return this.send(universityId, senderId, {
      type: dto.type,
      title: dto.title,
      body: dto.body,
      targetType: dto.targetType,
      targetId: dto.targetId,
      recipientUserIds: dto.recipientUserIds,
    });
  }

  async listForUser(
    userId: string,
    page: number,
    pageSize: number,
  ): Promise<Paginated<Notification & { isRead: boolean }>> {
    const where: Prisma.NotificationRecipientWhereInput = { userId };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.notificationRecipient.count({ where }),
      this.prisma.notificationRecipient.findMany({
        where,
        include: { notification: true },
        orderBy: { notification: { sentAt: 'desc' } },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    const data = rows.map((r) => ({ ...r.notification, isRead: r.isRead }));
    return paginate(data, total, page, pageSize);
  }

  async markRead(userId: string, notificationId: string): Promise<void> {
    const r = await this.prisma.notificationRecipient.findUnique({
      where: { notificationId_userId: { notificationId, userId } },
    });
    if (!r) throw new AppException(ErrorCodes.NOT_FOUND);
    await this.prisma.notificationRecipient.update({
      where: { notificationId_userId: { notificationId, userId } },
      data: { isRead: true, readAt: new Date() },
    });
  }

  async markAllRead(userId: string): Promise<void> {
    await this.prisma.notificationRecipient.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
  }

  async deleteForUser(userId: string, notificationId: string): Promise<void> {
    await this.prisma.notificationRecipient.deleteMany({
      where: { userId, notificationId },
    });
  }

  // ────────────────────── helpers ──────────────────────

  private async resolveRecipients(universityId: string, args: SendArgs): Promise<string[]> {
    if (args.recipientUserIds && args.recipientUserIds.length > 0) {
      // Cross-tenant guard: ignore anything outside the caller's university.
      const unique = [...new Set(args.recipientUserIds)];
      const allowed = await this.prisma.user.findMany({
        where: { id: { in: unique }, universityId, deletedAt: null, isActive: true },
        select: { id: true },
      });
      return allowed.map((u) => u.id);
    }
    switch (args.targetType) {
      case 'broadcast': {
        const users = await this.prisma.user.findMany({
          where: { universityId, deletedAt: null, isActive: true },
          select: { id: true },
        });
        return users.map((u) => u.id);
      }
      case 'user': {
        if (!args.targetId) return [];
        // Cross-tenant guard: only return the user if they belong to this university.
        const u = await this.prisma.user.findFirst({
          where: { id: args.targetId, universityId, deletedAt: null },
          select: { id: true },
        });
        return u ? [u.id] : [];
      }
      case 'section': {
        if (!args.targetId) return [];
        // Cross-tenant guard: ensure the section belongs to this university.
        const sec = await this.prisma.section.findFirst({
          where: { id: args.targetId, universityId, deletedAt: null },
          select: { id: true },
        });
        if (!sec) return [];
        const students = await this.prisma.student.findMany({
          where: { sectionId: sec.id },
          select: { id: true },
        });
        return students.map((s) => s.id);
      }
      case 'subject': {
        if (!args.targetId) return [];
        const subj = await this.prisma.subject.findFirst({
          where: { id: args.targetId, universityId, deletedAt: null },
          select: { id: true },
        });
        if (!subj) return [];
        const sections = await this.prisma.sectionSubject.findMany({
          where: { subjectId: subj.id },
          select: { sectionId: true },
        });
        const sids = sections.map((s) => s.sectionId);
        const students = await this.prisma.student.findMany({
          where: { sectionId: { in: sids } },
          select: { id: true },
        });
        return students.map((s) => s.id);
      }
    }
  }
}
