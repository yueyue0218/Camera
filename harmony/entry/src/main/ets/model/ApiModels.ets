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
  readonly timeSlot?: string;
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

export interface ServicePackageDetail extends ServicePackageSummary {
  readonly description?: string;
  readonly serviceArea?: string;
  readonly timeDescription?: string;
  readonly durationMinutes?: number;
  readonly originalCount?: number;
  readonly refinedCount?: number;
  readonly deliveryDays?: number;
}

export interface CreateDemandPayload {
  readonly scene: string;
  readonly cityCode: string;
  readonly location: string;
  readonly timeDescription: string;
  readonly description: string;
  readonly budgetMinCent?: number;
  readonly budgetMaxCent?: number;
}

export interface DemandResponseSummary {
  readonly responseId: number;
  readonly demandId: number;
  readonly providerId: number;
  readonly message: string;
  readonly expectedPriceCent?: number;
  readonly status: string;
}

export interface CreateDemandResponsePayload {
  readonly message: string;
  readonly expectedPriceCent?: number;
}

export interface AcceptedDemandResponse {
  readonly responseId: number;
  readonly conversationId: number;
  readonly responseStatus: string;
}

export interface MessageSummary {
  readonly messageId: number;
  readonly conversationId: number;
  readonly senderId: number;
  readonly messageType: string;
  readonly content?: string;
  readonly fileName?: string;
  readonly createdAt?: string;
}

export interface SendTextMessagePayload {
  readonly messageType: string;
  readonly content: string;
}

export interface StartServiceChatPayload {
  readonly initialMessage?: string;
}

export interface QuoteSummary {
  readonly quotationId: number;
  readonly conversationId: number;
  readonly customerId: number;
  readonly providerUserId: number;
  readonly amountCent: number;
  readonly shootStartTime: string;
  readonly shootEndTime: string;
  readonly deliveryDeadline: string;
  readonly location: string;
  readonly serviceContent: string;
  readonly status: string;
}

export interface CreateQuotePayload {
  readonly conversationId: number;
  readonly amountCent: number;
  readonly shootStartTime: string;
  readonly shootEndTime: string;
  readonly deliveryDeadline: string;
  readonly location: string;
  readonly serviceContent: string;
}

export interface ConfirmQuoteResult {
  readonly quotationId: number;
  readonly quotationStatus: string;
  readonly orderId: number;
  readonly orderStatus: string;
}

export interface StartServiceChatResult {
  readonly serviceId: number;
  readonly conversationId: number;
}

export interface NativeRefreshRequest {
  readonly refreshToken: string;
}

export interface SendSmsCodeRequest {
  readonly phone: string;
  readonly purpose: string;
  readonly deviceId: string;
}

export interface VerifyNativeSmsCodeRequest extends SendSmsCodeRequest {
  readonly code: string;
  readonly deviceName: string;
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

export interface SessionSummary {
  readonly userId: number;
  readonly nickname: string;
  readonly role: string;
  readonly adminCapable: boolean;
  readonly sessionId: string;
  readonly deviceId: string;
  readonly deviceName: string;
}

export interface ConversationSummary {
  readonly conversationId: number;
  readonly otherUserId: number;
  readonly participantAId?: number;
  readonly participantBId?: number;
  readonly sourceType?: string;
  readonly sourceId?: number;
  readonly orderId?: number;
  readonly lastMessageTime?: string;
  readonly createdAt?: string;
}

export interface OrderSummary {
  readonly orderId: number;
  readonly orderNo?: string;
  readonly customerNickname?: string;
  readonly providerNickname?: string;
  readonly status?: string;
  readonly amountCent?: number;
  readonly createdAt?: string;
  readonly demandId?: number;
}
