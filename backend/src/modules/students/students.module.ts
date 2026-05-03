import { Module } from '@nestjs/common';
import { StudentsController } from './students.controller';
import { StudentsService } from './students.service';
import { StudentsImportService } from './students.import.service';

@Module({
  controllers: [StudentsController],
  providers: [StudentsService, StudentsImportService],
  exports: [StudentsService],
})
export class StudentsModule {}
