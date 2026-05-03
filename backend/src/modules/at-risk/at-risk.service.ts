import { InjectQueue } from '@nestjs/bull';
import { Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bull';
import { AtRiskRecord, AtRiskSetting, NotificationType, WarningLevel } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AppException } from '../../common/errors/app.exception';
import { ErrorCodes } from '../../common/errors/error-codes';
import { Paginated, paginate } from '../../common/dto/pagination.dto';
import { FcmService } from '../notifications/fcm.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  CreateAtRiskSettingDto,
  NotifyAtRiskDto,
  UpdateAtRiskSettingDto,
} from './dto/at-risk.dto';

@Injectable()
export class AtRiskService {
  private readonly logger = new Logger(AtRiskService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly fcm: FcmService,
    private readonly notifications: NotificationsService,
    @InjectQueue('at-risk') private readonly queue: Queue,
  ) {}

  /** Enqueue a check after an attendance session ends. */
  async scheduleSessionCheck(sessionId: string): Promise<void> {
    await this.queue.add('check-absences', { sessionId }, { removeOnComplete: true });
  }

  async list(
    universityId: string,
    page: number,
    pageSize: number,
  ): Promise<Paginated<AtRiskRecord>> {
    const where = {
      isResolved: false,
      student: { user: { is: { universityId } } },
    } as const;
    const [total, data] = await this.prisma.$transaction([
      this.prisma.atRiskRecord.count({ where }),
      this.prisma.atRiskRecord.findMany({
        where,
        include: {
          student: { include: { user: true } },
          subject: true,
        },
        orderBy: { triggeredAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return paginate(data, total, page, pageSize);
  }

  async findStudentRecords(universityId: string, studentUserId: string): Promise<AtRiskRecord[]> {
    const u = await this.prisma.user.findFirst({
      where: { id: studentUserId, universityId, role: 'student' },
    });
    if (!u) throw new AppException(ErrorCodes.NOT_FOUND);
    return this.prisma.atRiskRecord.findMany({
      where: { studentId: studentUserId },
      include: { subject: true },
      orderBy: { triggeredAt: 'desc' },
    });
  }

  async sendCustomNotification(
    universityId: string,
    senderId: string,
    studentUserId: string,
    dto: NotifyAtRiskDto,
  ): Promise<void> {
    const u = await this.prisma.user.findFirst({
      where: { id: studentUserId, universityId, role: 'student' },
    });
    if (!u) throw new AppException(ErrorCodes.NOT_FOUND);
    await this.notifications.send(universityId, senderId, {
      type: NotificationType.academic_warning,
      title: dto.title,
      body: dto.body,
      targetType: 'user',
      targetId: studentUserId,
      recipientUserIds: [studentUserId],
    });
  }

  async resolve(recordId: string): Promise<AtRiskRecord> {
    const r = await this.prisma.atRiskRecord.findUnique({ where: { id: recordId } });
    if (!r) throw new AppException(ErrorCodes.NOT_FOUND);
    return this.prisma.atRiskRecord.update({
      where: { id: recordId },
      data: { isResolved: true, resolvedAt: new Date() },
    });
  }

  async listSettings(universityId: string): Promise<AtRiskSetting[]> {
    return this.prisma.atRiskSetting.findMany({ where: { universityId } });
  }

  async createSetting(universityId: string, dto: CreateAtRiskSettingDto): Promise<AtRiskSetting> {
    return this.prisma.atRiskSetting.create({
      data: {
        universityId,
        subjectId: dto.subjectId,
        warning1Absences: dto.warning1Absences ?? 3,
        warning2Absences: dto.warning2Absences ?? 5,
        deprivationAbsences: dto.deprivationAbsences ?? 7,
        notifyStudent: dto.notifyStudent ?? true,
        notifyDoctor: dto.notifyDoctor ?? false,
        notifyAdmin: dto.notifyAdmin ?? true,
      },
    });
  }

  async updateSetting(
    universityId: string,
    id: string,
    dto: UpdateAtRiskSettingDto,
  ): Promise<AtRiskSetting> {
    const existing = await this.prisma.atRiskSetting.findFirst({ where: { id, universityId } });
    if (!existing) throw new AppException(ErrorCodes.NOT_FOUND);
    return this.prisma.atRiskSetting.update({ where: { id }, data: { ...dto } });
  }

  /**
   * Heart of the early-detection system. Called from the Bull processor.
   *
   *  1. Load the session's section and subject.
   *  2. For every student in that section count their absence records in this
   *     subject this semester.
   *  3. Compare to the configured thresholds; pick the highest matching level.
   *  4. Upsert the AtRiskRecord (one per student/subject/level).
   *  5. Notify whoever is configured (student / doctor / admins) via FCM +
   *     a Notification row.
   */
  async runCheck(sessionId: string): Promise<{ created: number; notified: number }> {
    const session = await this.prisma.attendanceSession.findUnique({
      where: { id: sessionId },
      include: { scheduleSlot: { include: { subject: true, doctor: true } } },
    });
    if (!session) {
      this.logger.warn(`runCheck: session ${sessionId} not found`);
      return { created: 0, notified: 0 };
    }
    const subject = session.scheduleSlot.subject;
    const universityId = session.scheduleSlot.universityId;

    const setting = await this.prisma.atRiskSetting.findUnique({
      where: { universityId_subjectId: { universityId, subjectId: subject.id } },
    });
    if (!setting) {
      this.logger.debug(`No at-risk setting for subject ${subject.id}`);
      return { created: 0, notified: 0 };
    }

    const students = await this.prisma.student.findMany({
      where: { sectionId: session.scheduleSlot.sectionId },
      include: { user: true },
    });

    let created = 0;
    let notified = 0;

    for (const student of students) {
      // Count absences this student has in this subject across all sessions.
      // eslint-disable-next-line no-await-in-loop
      const absenceCount = await this.prisma.attendanceRecord.count({
        where: {
          studentId: student.id,
          status: 'absent',
          session: { scheduleSlot: { subjectId: subject.id } },
        },
      });

      const level = pickWarningLevel(absenceCount, setting);
      if (!level) continue;

      // Idempotency: only create a record at this level if none exists yet.
      // eslint-disable-next-line no-await-in-loop
      const exists = await this.prisma.atRiskRecord.findFirst({
        where: {
          studentId: student.id,
          subjectId: subject.id,
          warningLevel: level,
          isResolved: false,
        },
      });
      if (exists) continue;

      // eslint-disable-next-line no-await-in-loop
      await this.prisma.atRiskRecord.create({
        data: {
          studentId: student.id,
          subjectId: subject.id,
          absenceCount,
          warningLevel: level,
          notifiedAt: new Date(),
        },
      });
      created += 1;

      const title = humanLevel(level);
      const body = `You have ${absenceCount} absences in ${subject.name}.`;

      const recipients: string[] = [];
      if (setting.notifyStudent) recipients.push(student.id);
      if (setting.notifyDoctor && session.scheduleSlot.doctorId) recipients.push(session.scheduleSlot.doctorId);
      if (setting.notifyAdmin) {
        // eslint-disable-next-line no-await-in-loop
        const admins = await this.prisma.user.findMany({
          where: { universityId, role: 'admin', deletedAt: null, isActive: true },
          select: { id: true },
        });
        recipients.push(...admins.map((a) => a.id));
      }
      if (recipients.length === 0) continue;

      // eslint-disable-next-line no-await-in-loop
      await this.notifications.send(universityId, student.id, {
        type:
          level === WarningLevel.deprivation
            ? NotificationType.at_risk_alert
            : NotificationType.academic_warning,
        title,
        body,
        targetType: 'user',
        targetId: student.id,
        recipientUserIds: recipients,
      });

      // FCM direct push to the student.
      if (setting.notifyStudent && student.user.fcmToken) {
        // eslint-disable-next-line no-await-in-loop
        await this.fcm.send(student.user.fcmToken, { title, body });
      }
      notified += 1;
    }

    return { created, notified };
  }
}

function pickWarningLevel(
  absenceCount: number,
  setting: AtRiskSetting,
): WarningLevel | null {
  if (absenceCount >= setting.deprivationAbsences) return WarningLevel.deprivation;
  if (absenceCount >= setting.warning2Absences) return WarningLevel.warning_2;
  if (absenceCount >= setting.warning1Absences) return WarningLevel.warning_1;
  return null;
}

function humanLevel(level: WarningLevel): string {
  switch (level) {
    case WarningLevel.warning_1:
      return 'First Absence Warning';
    case WarningLevel.warning_2:
      return 'Second Absence Warning';
    case WarningLevel.deprivation:
      return 'Course Deprivation Notice';
  }
}
