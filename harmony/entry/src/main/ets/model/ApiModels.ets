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
  readonly customerId?: number;
  readonly customerNickname?: string;
  readonly customerAvatarFileId?: number;
  readonly customerAvatarUrl?: string;
  readonly customerAvatar?: string;
  readonly scene?: string;
  readonly styleTags?: string[];
  readonly expectedDate?: string;
  readonly timeDescription?: string;
  readonly cityCode?: string;
  readonly location?: string;
  readonly description?: string;
  readonly status?: string;
  readonly budgetMinCent?: number;
  readonly budgetMaxCent?: number;
  readonly referenceFileIds?: number[];
  /** Public URL fields are optional compatibility fields; file IDs still require the media download boundary. */
  readonly imageUrl?: string;
  readonly coverUrl?: string;
  readonly thumbnailUrl?: string;
  readonly referenceImageUrl?: string;
  readonly referenceImages?: string[];
  readonly images?: string[];
  readonly attachmentUrls?: string[];
  readonly referencePreviewUrls?: string[];
  readonly responseCount?: number;
}

export interface ServicePackageSummary {
  readonly serviceId: number;
  readonly providerId?: number;
  readonly photographerId?: number;
  readonly photographerNickname?: string;
  readonly photographerAvatarUrl?: string;
  readonly photographerAvatar?: string;
  readonly title?: string;
  readonly cityCode?: string;
  readonly scene?: string;
  readonly styleTags?: string[];
  readonly coverImage?: string;
  readonly images?: string[];
  readonly basePriceCent?: number;
  readonly priceRange?: string;
  readonly status?: string;
  readonly isAvailable?: boolean;
  /** Absent in the current public contract; undefined must render as not favorited. */
  readonly isFavorited?: boolean;
  readonly favoritedByCurrentUser?: boolean;
}

export interface ApiEnvelope<T> {
  readonly code: number;
  readonly message: string;
  readonly data: T;
}

export interface NativeSessionResponse {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly userId: number;
  readonly nickname: string;
  readonly role: string;
  readonly adminCapable: boolean;
  readonly newUser: boolean;
}
