import { Injectable } from '@nestjs/common';
import { LeaveRequestStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AppException } from '../../common/errors/app.exception';
import { ErrorCodes } from '../../common/errors/error-codes';
import { Paginated, paginate } from '../../common/dto/pagination.dto';
import { AuditService } from '../audit/audit.service';

export interface CreateLeaveRequestInput {
  studentId: string;
  startsAt: Date;
  endsAt: Date;
  reason: string;
  attachmentKey?: string;
  sessionId?: string;
}

@Injectable()
export class LeaveRequestsService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  async createForStudent(universityId: string, studentUserId: string, input: CreateLeaveRequestInput) {
    if (input.endsAt < input.startsAt)
      throw new AppException(ErrorCodes.VALIDATION_ERROR, { message: 'endsAt must be after startsAt' });
    const lr = await this.prisma.leaveRequest.create({
      data: {
        universityId,
        studentId: studentUserId,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        reason: input.reason,
        attachmentKey: input.attachmentKey ?? null,
        sessionId: input.sessionId ?? null,
      },
    });
    await this.audit.record({
      universityId,
      actorId: studentUserId,
      actorRole: 'student',
      action: 'leave_request.create',
      entity: 'LeaveRequest',
      entityId: lr.id,
      after: lr,
    });
    return lr;
  }

  async list(
    universityId: string,
    page: number,
    pageSize: number,
    filters: { studentId?: string; status?: LeaveRequestStatus } = {},
  ): Promise<Paginated<unknown>> {
    const where: Prisma.LeaveRequestWhereInput = {
      universityId,
      ...(filters.studentId ? { studentId: filters.studentId } : {}),
      ...(filters.status ? { status: filters.status } : {}),
    };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.leaveRequest.count({ where }),
      this.prisma.leaveRequest.findMany({
        where,
        include: { student: { include: { user: { select: { name: true } } } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return paginate(rows, total, page, pageSize);
  }

  async listForStudent(studentUserId: string, page: number, pageSize: number): Promise<Paginated<unknown>> {
    const where: Prisma.LeaveRequestWhereInput = { studentId: studentUserId };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.leaveRequest.count({ where }),
      this.prisma.leaveRequest.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return paginate(rows, total, page, pageSize);
  }

  async review(
    universityId: string,
    actorId: string,
    id: string,
    decision: 'approved' | 'rejected',
    note?: string,
  ) {
    const lr = await this.prisma.leaveRequest.findFirst({ where: { id, universityId } });
    if (!lr) throw new AppException(ErrorCodes.NOT_FOUND);
    if (lr.status !== 'pending')
      throw new AppException(ErrorCodes.VALIDATION_ERROR, { message: 'Already reviewed' });
    const after = await this.prisma.leaveRequest.update({
      where: { id },
      data: {
        status: decision,
        reviewerId: actorId,
        reviewedAt: new Date(),
        reviewerNote: note ?? null,
      },
    });
    await this.audit.record({
      universityId,
      actorId,
      action: `leave_request.${decision}`,
      entity: 'LeaveRequest',
      entityId: id,
      before: { status: lr.status },
      after: { status: after.status, note: after.reviewerNote },
    });
    return after;
  }
}
