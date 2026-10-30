export interface CreateMomentPayload {
  readonly title: string;
  readonly content: string;
  readonly imageDataList: string[];
  readonly mentions?: string[];
}

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

export interface ContentModeration { readonly status: string; readonly reason?: string; }

export interface DemandSummary {
  readonly moderation?: ContentModeration;
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
  readonly pendingCount?: number;
  readonly acceptedCount?: number;
  readonly rejectedCount?: number;
  readonly timeTags?: string[];
  readonly recommendReasons?: string[];
  readonly createdAt?: string;
  readonly updatedAt?: string;
}

export interface ServicePackageSummary {
  readonly moderation?: ContentModeration;
  readonly serviceId: number;
  readonly providerId?: number;
  readonly photographerId?: number;
  readonly photographerNickname?: string;
  readonly photographerAvatarFileId?: number;
  readonly coverPortfolioId?: number;
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
  readonly availableDates?: string[];
  readonly timeDescription?: string;
  readonly timeTags?: string[];
  readonly portfolioIds?: number[];
  readonly recommendReasons?: string[];
  readonly createdAt?: string;
  readonly updatedAt?: string;
  /** Absent in the current public contract; undefined must render as not favorited. */
  readonly isFavorited?: boolean;
  readonly favoritedByCurrentUser?: boolean;
}

/** Authenticated social feed item returned by GET /moments. */
export interface MomentSummary {
  readonly momentId: number;
  readonly authorId: number;
  readonly authorRole: string;
  readonly title?: string;
  readonly content?: string;
  /** Legacy cover field retained by the backend for single-image clients. */
  readonly imageData?: string;
  /** Ordered inline image data returned by the current backend. */
  readonly imageDataList?: string[];
  readonly mentions?: string[];
  readonly likeCount: number;
  readonly likedByCurrentUser: boolean;
  readonly favoriteCount: number;
  readonly favoritedByCurrentUser: boolean;
  readonly createdAt?: string;
  readonly updatedAt?: string;
  readonly status?: string;
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
  readonly styleTags?: string[];
  readonly expectedDate?: string;
  readonly timeSlot?: string;
  readonly cityCode: string;
  readonly location: string;
  readonly timeDescription: string;
  readonly timeTags?: string[];
  readonly description: string;
  readonly budgetMinCent?: number;
  readonly budgetMaxCent?: number;
  readonly referenceFileIds?: number[];
}

export interface DemandListQuery {
  readonly page: number;
  readonly size: number;
  readonly cityCode?: string;
  readonly scene?: string;
  readonly status?: string;
  readonly expectedDate?: string;
  readonly styleTag?: string;
  readonly minBudgetCent?: number;
  readonly maxBudgetCent?: number;
  readonly timeTag?: string;
  readonly keyword?: string;
  readonly sort?: string;
  readonly feedSeed?: string;
}

export interface ServicePackageListQuery {
  readonly page: number;
  readonly size: number;
  readonly cityCode?: string;
  readonly scene?: string;
  readonly style?: string;
  readonly minPriceCent?: number;
  readonly maxPriceCent?: number;
  readonly availableDate?: string;
  readonly timeTag?: string;
  readonly keyword?: string;
  readonly sort?: string;
  readonly feedSeed?: string;
}

export interface CreateServicePackagePayload {
  readonly title: string;
  readonly cityCode: string;
  readonly serviceArea?: string;
  readonly scene: string;
  readonly styleTags?: string[];
  readonly images?: string[];
  readonly basePriceCent: number;
  readonly priceRange?: string;
  readonly durationMinutes: number;
  readonly originalCount: number;
  readonly refinedCount: number;
  readonly deliveryDays: number;
  readonly availableDates?: string[];
  readonly portfolioIds?: number[];
  readonly description?: string;
  readonly timeDescription: string;
  readonly timeTags?: string[];
}

export interface CreateServicePackageResult {
  readonly serviceId: number;
  readonly status: string;
  readonly isAvailable: boolean;
}

export interface ServicePackageInterest {
  readonly interestId: number;
  readonly userId: number;
  readonly serviceId: number;
  readonly createdAt?: string;
}

export interface DemandResponseSummary {
  readonly responseId: number;
  readonly demandId: number;
  readonly providerId: number;
  readonly providerProfileId?: number;
  readonly message: string;
  readonly expectedPriceCent?: number;
  readonly status: string;
  readonly rejectReason?: string;
  readonly responseTime?: string;
}

export interface CreateDemandResponsePayload {
  readonly message: string;
  readonly expectedPriceCent?: number;
}

export interface AcceptedDemandResponse {
  readonly responseId: number;
  readonly demandId: number;
  readonly customerId: number;
  readonly providerId: number;
  readonly conversationId: number;
  readonly responseStatus: string;
  readonly conversationSourceType: string;
  readonly sourceId: number;
}

export interface MessageSummary {
  readonly messageId: number;
  readonly conversationId: number;
  readonly senderId: number;
  readonly messageType: string;
  readonly content?: string;
  readonly fileName?: string;
  readonly createdAt?: string;
  readonly quotationId?: number;
  readonly orderId?: number;
  readonly deliveryStatus?: string;
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
  readonly createdAt?: string;
  readonly expireTime?: string;
  readonly originalCount?: number;
  readonly refinedCount?: number;
  readonly photoUsageScope?: string;
  readonly terms?: string;
  readonly contractTerms?: string;
  readonly safetyNoticeVersion?: string;
  readonly remark?: string;
}

export interface CreateQuotePayload {
  readonly conversationId: number;
  readonly amountCent: number;
  readonly shootStartTime: string;
  readonly shootEndTime: string;
  readonly deliveryDeadline: string;
  readonly location: string;
  readonly serviceContent: string;
  readonly originalCount?: number;
  readonly refinedCount?: number;
  readonly photoUsageScope?: string;
  readonly terms?: string;
  readonly contractTerms?: string;
  readonly safetyNoticeVersion?: string;
  readonly expireTime?: string;
  readonly remark?: string;
}

export interface ConfirmQuoteResult {
  readonly quotationId: number;
  readonly quotationStatus: string;
  readonly orderId: number;
  readonly orderNo?: string;
  readonly orderStatus: string;
}

export interface RejectQuoteResult {
  readonly quotationId: number;
  readonly quotationStatus: string;
}

export interface RejectQuotePayload {
  readonly rejectReason: string;
}

export interface MockPaymentPayload {
  readonly payMethod: string;
  readonly amountCent: number;
}

export interface PaymentResult {
  readonly paymentId: number;
  readonly orderId: number;
  readonly orderStatus: string;
  readonly paymentStatus: string;
  readonly amountCent: number;
}

export interface OrderStatusLogSummary {
  readonly logId?: number;
  readonly orderId?: number;
  readonly toStatus: string;
  readonly createdAt?: string;
  readonly reason?: string;
  readonly operatorId?: number;
}

export interface DeliveryFileSummary {
  readonly fileId: number;
  readonly fileName?: string;
  readonly mimeType?: string;
  readonly fileSize?: number;
  readonly fileType?: string;
  readonly sortOrder?: number;
}

export interface DeliverySummary {
  readonly deliveryId: number;
  readonly orderId: number;
  readonly deliveryRound: number;
  readonly isLatest?: boolean;
  readonly originalCount?: number;
  readonly refinedCount?: number;
  readonly remark?: string;
  readonly uploadTime?: string;
  readonly files?: DeliveryFileSummary[];
}

export interface PhotoAuthorizationFileSummary {
  readonly fileId: number;
  readonly deliveryId?: number;
  readonly fileName?: string;
  readonly fileType?: string;
  readonly mimeType?: string;
}

export interface PhotoAuthorizationSummary {
  readonly id: number;
  readonly orderId: number;
  readonly customerId: number;
  readonly providerUserId: number;
  readonly photoUsageScope: string;
  readonly status: string;
  readonly remark?: string;
  readonly authorizedAt?: string;
  readonly files: PhotoAuthorizationFileSummary[];
}

export interface PhotoAuthorizationPayload {
  readonly fileIds: number[];
  readonly remark: string;
}

export interface PhotoAuthorizationDecisionPayload {
  readonly remark: string;
}

export interface StatusTransitionResult {
  readonly toStatus: string;
  readonly createdAt?: string;
}

export interface ReworkPayload {
  readonly reason: string;
}

export interface OrderTransitionPayload {
  readonly targetStatus: string;
  readonly reason: string;
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
  // These fields are supplied by /auth/session. When /users/me is used as
  // a verified identity fallback, session metadata is deliberately absent.
  readonly adminCapable?: boolean;
  readonly sessionId?: string;
  readonly deviceId?: string;
  readonly deviceName?: string;
  readonly createdAt?: string;
  readonly expiresAt?: string;
}

export interface UpdateProfilePayload {
  nickname: string; bio: string; role: string; avatarFileId?: number;
  locationDisplay?: string;
  locationVisible?: boolean;
  birthdayVisible?: boolean;
}

export interface UserProfileSummary {
  readonly id: number;
  readonly studentNo?: string;
  readonly nickname?: string;
  readonly school?: string;
  readonly gender?: string;
  readonly genderVisible?: boolean;
  readonly birthday?: string;
  readonly birthdayVisible?: boolean;
  readonly locationDisplay?: string;
  readonly locationVisible?: boolean;
  readonly cityCode?: string;
  readonly bio?: string;
  readonly avatarFileId?: number;
  readonly currentRole: string;
  readonly status?: string;
  readonly creditScore?: number;
  readonly createdAt?: string;
  readonly customerNickname?: string;
  readonly customerAvatarFileId?: number;
  readonly customerBio?: string;
  readonly providerNickname?: string;
  readonly providerAvatarFileId?: number;
  readonly providerBio?: string;
}

export interface SwitchRoleResult {
  readonly id: number;
  readonly currentRole: string;
  readonly nickname: string;
}

export interface SwitchRolePayload {
  readonly role: string;
}

export interface SocialUserBrief {
  readonly userId: number;
  readonly nickname?: string;
  readonly avatarFileId?: number;
  readonly currentRole: string;
  readonly bio?: string;
  readonly followedByCurrentUser: boolean;
}

export interface PublicUserProfile {
  readonly userId: number;
  readonly nickname?: string;
  readonly avatarFileId?: number;
  readonly bio?: string;
  readonly currentRole: string;
  readonly followerCount: number;
  readonly followingCount: number;
  readonly followedByCurrentUser: boolean;
  readonly momentCount: number;
  readonly cityCode?: string;
}

export interface FollowState {
  readonly targetUserId: number;
  readonly followed: boolean;
  readonly followerCount: number;
  readonly followingCount: number;
}

export interface ProfileMomentPage extends PageResult<MomentSummary> {
  readonly totalLikeCount: number;
  readonly totalFavoriteCount: number;
}

export interface CreateReportPayload {
  readonly targetType: string;
  readonly targetId: number;
  readonly reason: string;
  readonly description?: string;
}

export interface ReportSummary {
  readonly resolution?: string;
  readonly publicOutcome?: string;
  readonly publicMessage?: string;
  readonly followUpRecorded?: boolean;
  readonly reportId: number;
  readonly reporterId: number;
  readonly targetType: string;
  readonly targetId: number;
  readonly reason: string;
  readonly description?: string;
  readonly status: string;
  readonly createdAt?: string;
  readonly resolvedAt?: string;
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

export interface UserBrief {
  readonly userId: number;
  readonly nickname?: string;
  readonly avatarFileId?: number;
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
  readonly quoteId?: number;
  readonly conversationId?: number;
  readonly customerId?: number;
  readonly providerUserId?: number;
  readonly shootStartTime?: string;
  readonly shootEndTime?: string;
  readonly deliveryDeadline?: string;
  readonly shootLocation?: string;
  readonly escrowStatus?: string;
}

export interface AccountCancellationPayload {
  readonly reason?: string;
}

export interface AccountCancellationSummary {
  readonly requestId?: number;
  readonly status: string;
  readonly reason?: string;
  readonly requestedAt?: string;
  readonly updatedAt?: string;
  readonly processedAt?: string;
  readonly resolutionNote?: string;
}

export interface NotificationSummary {
  readonly notificationId: number;
  readonly recipientUserId: number;
  readonly actorUserId?: number | null;
  readonly title: string;
  readonly content: string;
  readonly type: string;
  readonly eventType?: string;
  readonly relatedType?: string;
  readonly relatedId?: number | null;
  readonly targetType?: string;
  readonly targetId?: number | null;
  readonly sourceType?: string;
  readonly sourceId?: number | null;
  readonly metadataJson?: string | null;
  readonly navigationPath?: string | null;
  readonly isRead: boolean;
  readonly createdAt?: string;
}
export interface CreditSummary {
  readonly userId: number;
  readonly creditScore?: number | null;
  readonly creditLevel?: string;
  readonly recordCount?: number;
  readonly lastUpdatedAt?: string | null;
  readonly effectiveOrderCount?: number;
  readonly completedOrderCount?: number;
  readonly goodReviewRate?: number | null;
  readonly defaultRate?: number | null;
  readonly riskRecordCount?: number;
  readonly receivedReviewCount?: number;
  readonly averageRating?: number | null;
}
export interface CreditRecordSummary {
  readonly recordId: number;
  readonly userId: number;
  readonly relatedOrderId?: number | null;
  readonly eventType?: string;
  readonly scoreChange?: number | null;
  readonly beforeScore?: number | null;
  readonly scoreAfter?: number | null;
  readonly afterScore?: number | null;
  readonly appliedScoreChange?: number | null;
  readonly sourceType?: string | null;
  readonly sourceId?: number | null;
  readonly reason?: string;
  readonly createdAt?: string;
}

export interface OrderEngagementSummary extends OrderSummary {
  readonly customerId: number;
  readonly providerUserId: number;
  readonly refundStatus?: string;
}
export interface ReviewSummary {
  readonly reviewId: number; readonly orderId: number; readonly reviewerId: number;
  readonly targetUserId: number; readonly reviewerNickname?: string; readonly targetUserNickname?: string;
  readonly direction?: string; readonly rating: number; readonly content: string; readonly isVisible: boolean;
  readonly replyContent?: string; readonly replyTime?: string; readonly createdAt?: string; readonly complaintStatus?: string;
}
export interface ReviewComplaintSummary {
  readonly complaintId: number; readonly reviewId: number; readonly orderId: number; readonly complainantId: number;
  readonly respondentId?: number; readonly reason: string; readonly status: string;
  readonly arbitrationResult?: string; readonly arbitrationComment?: string; readonly createdAt?: string; readonly handledAt?: string;
  readonly evidenceFileIds?: string; readonly updatedAt?: string;
}
export interface DisputeReplySummary { readonly id: number; readonly disputeId: number; readonly replierId: number; readonly content: string; readonly createdAt?: string; }
export interface DisputeSummary {
  readonly id: number; readonly orderId: number; readonly initiatorId: number; readonly reason: string; readonly status: string;
  readonly resolution?: string; readonly responsibility?: string; readonly adminComment?: string;
  readonly createdAt?: string; readonly resolvedAt?: string; readonly replies: DisputeReplySummary[];
}
export interface CreateReviewPayload { readonly rating: number; readonly content: string; }
export interface ReviewTextPayload { readonly content: string; }
export interface CreateReviewComplaintPayload { readonly reason: string; readonly evidenceFileIds: string; }
export interface DisputeReasonPayload { readonly reason: string; }
