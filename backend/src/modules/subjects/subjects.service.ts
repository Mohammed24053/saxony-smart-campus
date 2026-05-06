import { Injectable } from '@nestjs/common';
import { Prisma, Subject } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AppException } from '../../common/errors/app.exception';
import { ErrorCodes } from '../../common/errors/error-codes';
import { Paginated, paginate } from '../../common/dto/pagination.dto';
import { CreateSubjectDto, UpdateSubjectDto } from './dto/subject.dto';

@Injectable()
export class SubjectsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    universityId: string,
    page: number,
    pageSize: number,
    search?: string,
  ): Promise<Paginated<Subject>> {
    const where: Prisma.SubjectWhereInput = {
      universityId,
      deletedAt: null,
      ...(search
        ? {
            OR: [
              { code: { contains: search, mode: 'insensitive' } },
              { name: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [total, data] = await this.prisma.$transaction([
      this.prisma.subject.count({ where }),
      this.prisma.subject.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return paginate(data, total, page, pageSize);
  }

  async findById(universityId: string, id: string): Promise<Subject> {
    const s = await this.prisma.subject.findFirst({
      where: { id, universityId, deletedAt: null },
    });
    if (!s) throw new AppException(ErrorCodes.NOT_FOUND);
    return s;
  }

  async create(universityId: string, dto: CreateSubjectDto): Promise<Subject> {
    const dup = await this.prisma.subject.findUnique({ where: { code: dto.code } });
    if (dup)
      throw new AppException(ErrorCodes.CONFLICT, { message: 'subject code already exists' });
    return this.prisma.subject.create({
      data: { universityId, ...dto },
    });
  }

  async update(universityId: string, id: string, dto: UpdateSubjectDto): Promise<Subject> {
    await this.findById(universityId, id);
    return this.prisma.subject.update({ where: { id }, data: { ...dto } });
  }

  async softDelete(universityId: string, id: string): Promise<void> {
    await this.findById(universityId, id);
    await this.prisma.subject.update({ where: { id }, data: { deletedAt: new Date() } });
  }
}
