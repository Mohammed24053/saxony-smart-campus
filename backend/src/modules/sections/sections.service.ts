import { Injectable } from '@nestjs/common';
import { Prisma, Section } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AppException } from '../../common/errors/app.exception';
import { ErrorCodes } from '../../common/errors/error-codes';
import { Paginated, paginate } from '../../common/dto/pagination.dto';
import { CreateSectionDto, UpdateSectionDto } from './dto/section.dto';

@Injectable()
export class SectionsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    universityId: string,
    page: number,
    pageSize: number,
    search?: string,
  ): Promise<Paginated<Section>> {
    const where: Prisma.SectionWhereInput = {
      universityId,
      deletedAt: null,
      ...(search ? { name: { contains: search, mode: 'insensitive' } } : {}),
    };
    const [total, data] = await this.prisma.$transaction([
      this.prisma.section.count({ where }),
      this.prisma.section.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return paginate(data, total, page, pageSize);
  }

  async findById(
    universityId: string,
    id: string,
  ): Promise<Section & { subjects: { subjectId: string }[] }> {
    const s = await this.prisma.section.findFirst({
      where: { id, universityId, deletedAt: null },
      include: { subjects: { select: { subjectId: true } } },
    });
    if (!s) throw new AppException(ErrorCodes.NOT_FOUND);
    return s;
  }

  async create(universityId: string, dto: CreateSectionDto): Promise<Section> {
    return this.prisma.section.create({
      data: {
        universityId,
        name: dto.name,
        faculty: dto.faculty,
        year: dto.year,
        capacity: dto.capacity,
        subjects: dto.subjectIds?.length
          ? {
              create: dto.subjectIds.map((subjectId) => ({ subjectId })),
            }
          : undefined,
      },
    });
  }

  async update(universityId: string, id: string, dto: UpdateSectionDto): Promise<Section> {
    await this.findById(universityId, id);
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.section.update({
        where: { id },
        data: {
          ...(dto.name !== undefined ? { name: dto.name } : {}),
          ...(dto.faculty !== undefined ? { faculty: dto.faculty } : {}),
          ...(dto.year !== undefined ? { year: dto.year } : {}),
          ...(dto.capacity !== undefined ? { capacity: dto.capacity } : {}),
        },
      });
      if (dto.subjectIds) {
        await tx.sectionSubject.deleteMany({ where: { sectionId: id } });
        if (dto.subjectIds.length > 0) {
          await tx.sectionSubject.createMany({
            data: dto.subjectIds.map((subjectId) => ({ sectionId: id, subjectId })),
            skipDuplicates: true,
          });
        }
      }
      return updated;
    });
  }

  async softDelete(universityId: string, id: string): Promise<void> {
    await this.findById(universityId, id);
    await this.prisma.section.update({ where: { id }, data: { deletedAt: new Date() } });
  }
}
