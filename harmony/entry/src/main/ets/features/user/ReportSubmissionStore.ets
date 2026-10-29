import { CreateReportPayload, ReportSummary } from '../../model/ApiModels';

let nextReportInstance: number = 0;

export function createReportInstanceKey(): string {
  nextReportInstance++;
  return `reports.instance.${nextReportInstance}`;
}

export class ReportSubmissionRecord {
  readonly key: string;
  readonly sessionVersion: number;
  readonly actorId: number;
  readonly payload: CreateReportPayload;
  state: string = 'pending';
  report?: ReportSummary;

  constructor(key: string, sessionVersion: number, actorId: number, payload: CreateReportPayload) {
    this.key = key;
    this.sessionVersion = sessionVersion;
    this.actorId = actorId;
    this.payload = payload;
  }
}

/** Memory-only ambiguity survives component destruction, isolated by account/session/object. */
export class ReportSubmissionStore {
  static readonly shared: ReportSubmissionStore = new ReportSubmissionStore();
  private entries: Map<string, ReportSubmissionRecord> = new Map<string, ReportSubmissionRecord>();

  find(sessionVersion: number, actorId: number, targetType: string, targetId: number): ReportSubmissionRecord | undefined {
    return this.entries.get(this.identity(sessionVersion, actorId, targetType, targetId));
  }

  findUnconfirmed(actorId: number, targetType: string, targetId: number): ReportSubmissionRecord | undefined {
    let pending: ReportSubmissionRecord | undefined = undefined;
    const normalized = targetType.trim().toUpperCase();
    this.entries.forEach((record: ReportSubmissionRecord) => {
      if (record.actorId === actorId && record.payload.targetType === normalized && record.payload.targetId === targetId &&
        (record.state === 'pending' || record.state === 'unknown')) {
        pending = record;
      }
    });
    return pending;
  }

  begin(key: string, sessionVersion: number, actorId: number, payload: CreateReportPayload): ReportSubmissionRecord {
    const record = new ReportSubmissionRecord(key, sessionVersion, actorId, payload);
    this.entries.set(this.identity(sessionVersion, actorId, payload.targetType, payload.targetId), record);
    return record;
  }

  markUnknown(record: ReportSubmissionRecord): void {
    if (this.owns(record) && record.state !== 'confirmed') {
      record.state = 'unknown';
    }
  }

  confirm(record: ReportSubmissionRecord, report: ReportSummary): void {
    if (this.owns(record)) {
      record.state = 'confirmed';
      record.report = report;
    }
  }

  reject(record: ReportSubmissionRecord): void {
    if (this.owns(record)) {
      this.entries.delete(this.identity(record.sessionVersion, record.actorId,
        record.payload.targetType, record.payload.targetId));
    }
  }

  private owns(record: ReportSubmissionRecord): boolean {
    return this.find(record.sessionVersion, record.actorId, record.payload.targetType, record.payload.targetId) === record;
  }

  private identity(sessionVersion: number, actorId: number, targetType: string, targetId: number): string {
    return `${sessionVersion}:${actorId}:${targetType.trim().toUpperCase()}:${targetId}`;
  }
}
