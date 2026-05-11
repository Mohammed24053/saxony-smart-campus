import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { AtRiskService } from './at-risk.service';

interface CheckAbsencesJob {
  sessionId: string;
}

@Processor('at-risk')
export class AtRiskProcessor {
  private readonly logger = new Logger(AtRiskProcessor.name);

  constructor(private readonly atRisk: AtRiskService) {}

  @Process('check-absences')
  async handleCheckAbsences(
    job: Job<CheckAbsencesJob>,
  ): Promise<{ created: number; notified: number }> {
    this.logger.log(`Processing check-absences for session ${job.data.sessionId}`);
    return this.atRisk.runCheck(job.data.sessionId);
  }
}
