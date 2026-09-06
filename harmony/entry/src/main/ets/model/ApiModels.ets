/**
 * Minimal API models shared by the network layer and feature pages.
 * Field names follow the current Spring Boot DTOs; this is not mock data.
 */
export interface PageResult<T> {
  readonly records: T[];
  readonly page: number;
  readonly size: number;
  readonly total: number;
}

export interface DemandSummary {
  readonly demandId: number;
  readonly customerNickname?: string;
  readonly scene?: string;
  readonly cityCode?: string;
  readonly location?: string;
  readonly description?: string;
  readonly status?: string;
  readonly budgetMinCent?: number;
  readonly budgetMaxCent?: number;
}

export interface ServicePackageSummary {
  readonly serviceId: number;
  readonly providerId?: number;
  readonly photographerNickname?: string;
  readonly title?: string;
  readonly cityCode?: string;
  readonly scene?: string;
  readonly basePriceCent?: number;
  readonly status?: string;
  readonly isAvailable?: boolean;
}

export interface ApiEnvelope<T> {
  readonly code: number;
  readonly message: string;
  readonly data: T;
}
