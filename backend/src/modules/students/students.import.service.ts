import { Injectable } from '@nestjs/common';
import { Workbook } from 'exceljs';
import { AppException } from '../../common/errors/app.exception';
import { ErrorCodes } from '../../common/errors/error-codes';
import { CreateStudentDto } from './dto/student.dto';
import { StudentsService } from './students.service';

export interface ImportResult {
  total: number;
  created: number;
  updated: number;
  skipped: number;
  errors: Array<{ row: number; reason: string }>;
}

const HEADERS = ['studentId', 'name', 'email', 'phone', 'faculty', 'year', 'sectionId'] as const;

@Injectable()
export class StudentsImportService {
  constructor(private readonly students: StudentsService) {}

  async generateTemplate(): Promise<Buffer> {
    const wb = new Workbook();
    const ws = wb.addWorksheet('students');
    ws.columns = HEADERS.map((h) => ({ header: h, key: h, width: 22 }));
    ws.addRow({
      studentId: 'STU-2025-0001',
      name: 'Mariam Hassan',
      email: 'mariam@example.com',
      phone: '+201234567890',
      faculty: 'Engineering',
      year: 2,
      sectionId: '',
    });
    const buf = await wb.xlsx.writeBuffer();
    return Buffer.from(buf as ArrayBuffer);
  }

  async parseAndImport(universityId: string, file: Buffer): Promise<ImportResult> {
    const wb = new Workbook();
    try {
      await wb.xlsx.load(file as unknown as ArrayBuffer);
    } catch {
      throw new AppException(ErrorCodes.INVALID_FILE_FORMAT);
    }
    const ws = wb.worksheets[0];
    if (!ws) throw new AppException(ErrorCodes.INVALID_FILE_FORMAT);
    // Hard cap on the parseable row count. exceljs streams from a Buffer but
    // each cell still allocates — a 65k-row sheet of long strings can spike
    // hundreds of MB. The product spec caps imports to a few thousand rows.
    const MAX_ROWS = 5000;
    if (ws.rowCount > MAX_ROWS + 1) {
      throw new AppException(ErrorCodes.IMPORT_VALIDATION_FAILED, {
        message: `Import exceeds row limit (${MAX_ROWS}).`,
      });
    }

    const headerRow = ws.getRow(1).values as Array<string | undefined>;
    const headerIdx: Record<string, number> = {};
    headerRow.forEach((h, idx) => {
      if (h) headerIdx[String(h).trim()] = idx;
    });
    for (const h of HEADERS) {
      if (
        !headerIdx[h] &&
        h !== 'sectionId' &&
        h !== 'phone' &&
        h !== 'email' &&
        h !== 'faculty' &&
        h !== 'year'
      ) {
        throw new AppException(ErrorCodes.IMPORT_VALIDATION_FAILED, {
          message: `Missing required header: ${h}`,
        });
      }
    }

    const rows: CreateStudentDto[] = [];
    const errors: ImportResult['errors'] = [];
    const seen = new Set<string>();

    for (let r = 2; r <= ws.rowCount; r++) {
      const row = ws.getRow(r);
      const get = (h: (typeof HEADERS)[number]): string | undefined => {
        const idx = headerIdx[h];
        if (!idx) return undefined;
        const v = row.getCell(idx).value;
        if (v === null || v === undefined) return undefined;
        return String(v).trim();
      };

      const studentId = get('studentId');
      const name = get('name');
      if (!studentId || !name) {
        if (studentId || name) errors.push({ row: r, reason: 'studentId and name are required' });
        continue;
      }
      if (seen.has(studentId)) {
        errors.push({ row: r, reason: `Duplicate studentId in file: ${studentId}` });
        continue;
      }
      seen.add(studentId);

      const yearStr = get('year');
      rows.push({
        studentId,
        name,
        email: get('email') || undefined,
        phone: get('phone') || undefined,
        faculty: get('faculty') || undefined,
        year: yearStr ? Number(yearStr) : undefined,
        sectionId: get('sectionId') || undefined,
      });
    }

    if (errors.length > 0 && rows.length === 0) {
      throw new AppException(ErrorCodes.IMPORT_VALIDATION_FAILED, { details: { errors } });
    }

    const result = await this.students.upsertBulk(universityId, rows);
    return {
      total: rows.length + errors.length,
      ...result,
      errors,
    };
  }
}
