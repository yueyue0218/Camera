import { ProvincePayload } from '../common/region/ProvincePayload';
import { UploadedImage } from '../model/ApiModels';
import { ProvinceCatalog } from '../common/region/ProvinceCatalog';
import { CreateMomentPayload } from '../model/ApiModels';
import { OrderEngagementSummary, ReviewSummary, ReviewComplaintSummary, DisputeSummary, CreateReviewPayload, ReviewTextPayload, CreateReviewComplaintPayload, DisputeReasonPayload } from '../model/ApiModels';
import { NotificationSummary, CreditSummary, CreditRecordSummary } from '../model/ApiModels';
import { NativeSessionApi } from '../auth/NativeSessionApi';
import { AcceptedDemandResponse, ConfirmQuoteResult, ConversationSummary, CreateDemandPayload,
  CreateDemandResponsePayload, CreateQuotePayload, CreateReportPayload, CreateServicePackagePayload,
  CreateServicePackageResult,
  DemandListQuery, DemandResponseSummary, DemandSummary, MessageSummary, NativeRefreshRequest, NativeSessionResponse,
  FollowState, MomentSummary, OrderSummary, PageResult, ProfileMomentPage, PublicUserProfile, QuoteSummary,
  ReportSummary, SendSmsCodeRequest, ServicePackageDetail, ServicePackageInterest, ServicePackageListQuery,
  ServicePackageSummary, SocialUserBrief, SwitchRolePayload, SwitchRoleResult, UserProfileSummary,
  SendTextMessagePayload, SessionSummary, StartServiceChatPayload, StartServiceChatResult,
  VerifyNativeSmsCodeRequest } from '../model/ApiModels';
import { ErrorMapper } from './ErrorMapper';
import { HttpClient } from './HttpClient';

export class ApiService implements NativeSessionApi {
  private readonly client: HttpClient;

  constructor(client: HttpClient = new HttpClient()) {
    this.client = client;
  }

  uploadImage(data: ArrayBuffer, bizType: string, mime: string, filename: string): Promise<UploadedImage> {
    return this.client.uploadImage(data, bizType, mime, filename);
  }

  createMoment(payload: CreateMomentPayload, requestKey: string = 'moments.create'): Promise<MomentSummary> {
    return this.client.post<MomentSummary>('/moments', payload, requestKey);
  }

  cancelMomentCreate(requestKey: string = 'moments.create'): void {
    this.client.cancelRequest(requestKey);
  }

  async updateMoment(momentId: number, payload: CreateMomentPayload, requestKey?: string): Promise<MomentSummary> {
    this.requireMomentId(momentId);
    const result = await this.client.put<MomentSummary>(`/moments/${momentId}`, payload,
      requestKey ?? `moments.${momentId}.update`);
    return this.requireMomentResult(result, momentId);
  }

  async deleteMoment(momentId: number, requestKey?: string): Promise<void> {
    this.requireMomentId(momentId);
    const result = await this.client.delete<void>(`/moments/${momentId}`,
      requestKey ?? `moments.${momentId}.delete`);
    if (result !== null && result !== undefined) { throw ErrorMapper.parse(); }
  }

  cancelMomentUpdate(momentId: number, requestKey?: string): void {
    this.requireMomentId(momentId);
    this.client.cancelRequest(requestKey ?? `moments.${momentId}.update`);
  }

  cancelMomentDelete(momentId: number, requestKey?: string): void {
    this.requireMomentId(momentId);
    this.client.cancelRequest(requestKey ?? `moments.${momentId}.delete`);
  }

  listDemands(page: number = 1, size: number = 10, requestKey: string = 'demands.list'):
    Promise<PageResult<DemandSummary>> {
    return this.client.getPublic<PageResult<DemandSummary>>(
      `/demands?page=${page}&size=${size}`,
      requestKey
    );
  }

  listDemandsByQuery(query: DemandListQuery, requestKey: string = 'demands.list'):
    Promise<PageResult<DemandSummary>> {
    const params: string[] = [`page=${this.safePage(query.page)}`, `size=${this.safeSize(query.size)}`];
    this.appendText(params, 'cityCode', query.cityCode?.trim() ? ProvinceCatalog.requireCode(query.cityCode) : undefined);
    this.appendText(params, 'scene', query.scene);
    this.appendText(params, 'status', query.status);
    this.appendDate(params, 'expectedDate', query.expectedDate);
    this.appendText(params, 'styleTag', query.styleTag);
    this.appendNonNegative(params, 'minBudgetCent', query.minBudgetCent);
    this.appendNonNegative(params, 'maxBudgetCent', query.maxBudgetCent);
    this.appendText(params, 'timeTag', query.timeTag);
    this.appendText(params, 'keyword', query.keyword);
    this.appendSort(params, query.sort, ['latest', 'recommend']);
    this.appendText(params, 'feedSeed', query.feedSeed);
    return this.client.getPublic<PageResult<DemandSummary>>(`/demands?${params.join('&')}`, requestKey);
  }

  cancelDemands(requestKey: string = 'demands.list'): void {
    this.client.cancelRequest(requestKey);
  }

  async getDemand(demandId: number): Promise<DemandSummary> {
    if (!Number.isSafeInteger(demandId) || demandId <= 0) {
      throw ErrorMapper.parse();
    }
    const result = await this.client.getPublic<DemandSummary>(`/demands/${demandId}`, 'demands.detail');
    if (result === null || result.demandId !== demandId) {
      throw ErrorMapper.parse();
    }
    return result;
  }

  cancelDemandDetail(): void {
    this.client.cancelRequest('demands.detail');
  }

  createDemand(payload: CreateDemandPayload): Promise<DemandSummary> {
    ProvinceCatalog.requireCode(payload.cityCode);
    return this.client.post<DemandSummary>('/demands', ProvincePayload.demand(payload), 'demands.create');
  }

  updateDemand(id: number, payload: CreateDemandPayload): Promise<DemandSummary> {
    ProvinceCatalog.requireCode(payload.cityCode);
    return this.client.put<DemandSummary>(`/demands/${id}`, ProvincePayload.demand(payload), 'demands.update');
  }
  updateService(id: number, payload: CreateServicePackagePayload): Promise<ServicePackageDetail> {
    ProvinceCatalog.requireCode(payload.cityCode);
    return this.client.put<ServicePackageDetail>(`/service-packages/${id}`, ProvincePayload.service(payload), 'servicePackages.update');
  }

  respondToDemand(demandId: number, message: string, expectedPriceCent?: number): Promise<DemandResponseSummary> {
    const payload: CreateDemandResponsePayload = { message: message, expectedPriceCent: expectedPriceCent };
    return this.client.post<DemandResponseSummary>(`/demands/${demandId}/responses`,
      payload, `demands.${demandId}.respond`);
  }

  listDemandResponses(demandId: number): Promise<DemandResponseSummary[]> {
    return this.client.get<DemandResponseSummary[]>(`/demands/${demandId}/responses`, `demands.${demandId}.responses`);
  }

  listMyDemandResponses(): Promise<DemandResponseSummary[]> {
    return this.client.get<DemandResponseSummary[]>('/demands/responses/me', 'demands.responses.me');
  }

  acceptDemandResponse(demandId: number, responseId: number): Promise<AcceptedDemandResponse> {
    return this.client.post<AcceptedDemandResponse>(`/demands/${demandId}/responses/${responseId}/accept`,
      undefined, `demands.${demandId}.accept`);
  }

  cancelDemandActions(demandId: number): void {
    this.client.cancelRequest(`demands.${demandId}.responses`);
    this.client.cancelRequest(`demands.${demandId}.respond`);
    this.client.cancelRequest(`demands.${demandId}.accept`);
    this.client.cancelRequest('demands.responses.me');
  }

  listServicePackages(page: number = 1, size: number = 10, requestKey: string = 'servicePackages.list'):
    Promise<PageResult<ServicePackageSummary>> {
    return this.client.getPublic<PageResult<ServicePackageSummary>>(
      `/service-packages?page=${page}&size=${size}`,
      requestKey
    );
  }

  listServicePackagesByQuery(query: ServicePackageListQuery,
    requestKey: string = 'servicePackages.list'): Promise<PageResult<ServicePackageSummary>> {
    const params: string[] = [`page=${this.safePage(query.page)}`, `size=${this.safeSize(query.size)}`];
    this.appendText(params, 'cityCode', query.cityCode?.trim() ? ProvinceCatalog.requireCode(query.cityCode) : undefined);
    this.appendText(params, 'scene', query.scene);
    this.appendText(params, 'style', query.style);
    this.appendNonNegative(params, 'minPriceCent', query.minPriceCent);
    this.appendNonNegative(params, 'maxPriceCent', query.maxPriceCent);
    this.appendDate(params, 'availableDate', query.availableDate);
    this.appendText(params, 'timeTag', query.timeTag);
    this.appendText(params, 'keyword', query.keyword);
    this.appendSort(params, query.sort, ['latest', 'recommend', 'price_asc', 'price_desc', 'created_asc']);
    this.appendText(params, 'feedSeed', query.feedSeed);
    return this.client.getPublic<PageResult<ServicePackageSummary>>(
      `/service-packages?${params.join('&')}`, requestKey);
  }

  cancelServicePackages(requestKey: string = 'servicePackages.list'): void {
    this.client.cancelRequest(requestKey);
  }

  getServicePackage(serviceId: number): Promise<ServicePackageDetail> {
    return this.client.getPublic<ServicePackageDetail>(`/service-packages/${serviceId}`, 'servicePackages.detail');
  }

  startServiceChat(serviceId: number): Promise<StartServiceChatResult> {
    const payload: StartServiceChatPayload = {};
    return this.client.post<StartServiceChatResult>(`/service-packages/${serviceId}/start-chat`,
      payload, `servicePackages.${serviceId}.chat`);
  }

  createServicePackage(payload: CreateServicePackagePayload): Promise<CreateServicePackageResult> {
    ProvinceCatalog.requireCode(payload.cityCode);
    return this.client.post<CreateServicePackageResult>('/service-packages', ProvincePayload.service(payload), 'servicePackages.create');
  }

  listServicePackageInterests(page: number = 1, size: number = 100):
    Promise<PageResult<ServicePackageSummary>> {
    return this.client.get<PageResult<ServicePackageSummary>>(
      `/me/service-package-interests?page=${this.safePage(page)}&size=${this.safeSize(size)}`,
      'servicePackages.interests');
  }

  addServicePackageInterest(serviceId: number): Promise<ServicePackageInterest> {
    return this.client.post<ServicePackageInterest>(`/service-packages/${serviceId}/interest`, undefined,
      `servicePackages.${serviceId}.interest`);
  }

  cancelServicePackageInterest(serviceId: number): Promise<void> {
    return this.client.delete<void>(`/service-packages/${serviceId}/interest`,
      `servicePackages.${serviceId}.interest`);
  }

  cancelServiceDetail(serviceId: number): void {
    this.client.cancelRequest('servicePackages.detail');
    this.client.cancelRequest(`servicePackages.${serviceId}.chat`);
    this.client.cancelRequest(`servicePackages.${serviceId}.interest`);
    this.client.cancelRequest('servicePackages.interests');
  }

  listMoments(scope: string = 'latest', requestKey: string = 'moments.list'): Promise<MomentSummary[]> {
    const normalizedScope = scope.trim().toLowerCase();
    if (normalizedScope !== 'latest' && normalizedScope !== 'hot' && normalizedScope !== 'following') {
      return Promise.reject(ErrorMapper.parse());
    }
    return this.client.get<MomentSummary[]>(`/moments?scope=${normalizedScope}`, requestKey);
  }

  cancelMoments(requestKey: string = 'moments.list'): void {
    this.client.cancelRequest(requestKey);
  }

  async getMoment(momentId: number, requestKey: string = 'moments.detail'): Promise<MomentSummary> {
    this.requireMomentId(momentId);
    const result = await this.client.get<MomentSummary>(`/moments/${momentId}`, requestKey);
    return this.requireMomentResult(result, momentId);
  }

  cancelMomentDetail(requestKey: string = 'moments.detail'): void {
    this.client.cancelRequest(requestKey);
  }

  async likeMoment(momentId: number, requestKey?: string): Promise<MomentSummary> {
    this.requireMomentId(momentId);
    const result = await this.client.put<MomentSummary>(`/moments/${momentId}/like`, undefined,
      requestKey ?? `moments.${momentId}.like`);
    return this.requireMomentResult(result, momentId, true);
  }

  async unlikeMoment(momentId: number, requestKey?: string): Promise<MomentSummary> {
    this.requireMomentId(momentId);
    const result = await this.client.delete<MomentSummary>(`/moments/${momentId}/like`,
      requestKey ?? `moments.${momentId}.like`);
    return this.requireMomentResult(result, momentId, false);
  }

  cancelMomentLike(momentId: number, requestKey?: string): void {
    this.requireMomentId(momentId);
    this.client.cancelRequest(requestKey ?? `moments.${momentId}.like`);
  }

  private requireMomentId(momentId: number): void {
    if (!Number.isSafeInteger(momentId) || momentId <= 0) {
      throw ErrorMapper.parse();
    }
  }

  private requireMomentResult(result: MomentSummary, momentId: number, expectedLiked?: boolean): MomentSummary {
    if (result === null || result === undefined || result.momentId !== momentId ||
      !Number.isSafeInteger(result.likeCount) || result.likeCount < 0 ||
      !Number.isSafeInteger(result.favoriteCount) || result.favoriteCount < 0 ||
      typeof result.likedByCurrentUser !== 'boolean' || typeof result.favoritedByCurrentUser !== 'boolean' ||
      (expectedLiked !== undefined && result.likedByCurrentUser !== expectedLiked)) {
      throw ErrorMapper.parse();
    }
    return result;
  }


  listProfileMoments(authorId: number, authorRole: string, page: number = 1, size: number = 12, requestKey?: string):
    Promise<ProfileMomentPage> {
    const role = this.requireIdentityRole(authorRole);
    if (!Number.isSafeInteger(authorId) || authorId <= 0) {
      return Promise.reject(ErrorMapper.parse());
    }
    return this.client.get<ProfileMomentPage>(
      `/moments/profile?authorId=${authorId}&authorRole=${role}&page=${this.safePage(page)}&size=${this.safeSize(size)}`,
      requestKey ?? `moments.profile.${authorId}.${role}`);
  }

  listFavoriteMoments(page: number = 1, size: number = 12): Promise<PageResult<MomentSummary>> {
    return this.client.get<PageResult<MomentSummary>>(
      `/moments/me/interactions?interaction=FAVORITED&page=${this.safePage(page)}&size=${this.safeSize(size)}`,
      'moments.favorites');
  }

  favoriteMoment(momentId: number): Promise<MomentSummary> {
    if (!Number.isSafeInteger(momentId) || momentId <= 0) {
      return Promise.reject(ErrorMapper.parse());
    }
    return this.client.put<MomentSummary>(`/moments/${momentId}/favorite`, undefined, `moments.${momentId}.favorite`);
  }

  unfavoriteMoment(momentId: number): Promise<MomentSummary> {
    if (!Number.isSafeInteger(momentId) || momentId <= 0) {
      return Promise.reject(ErrorMapper.parse());
    }
    return this.client.delete<MomentSummary>(`/moments/${momentId}/favorite`, `moments.${momentId}.favorite`);
  }

  getMyProfile(): Promise<UserProfileSummary> {
    return this.client.get<UserProfileSummary>('/users/me', 'users.me');
  }

  switchRole(role: string): Promise<SwitchRoleResult> {
    const normalizedRole = this.requireIdentityRole(role);
    const payload: SwitchRolePayload = { role: normalizedRole };
    return this.client.post<SwitchRoleResult>('/users/me/role', payload, 'users.me.role');
  }

  getPublicProfile(userId: number, role: string, requestKey?: string): Promise<PublicUserProfile> {
    const normalizedRole = this.requireIdentityRole(role);
    if (!Number.isSafeInteger(userId) || userId <= 0) {
      return Promise.reject(ErrorMapper.parse());
    }
    return this.client.get<PublicUserProfile>(
      `/users/${userId}/public-profile?role=${normalizedRole}`, requestKey ?? `users.${userId}.${normalizedRole}.profile`);
  }

  cancelPublicProfile(profileRequestKey: string, momentsRequestKey: string): void {
    this.client.cancelRequest(profileRequestKey);
    this.client.cancelRequest(momentsRequestKey);
  }

  listFollowers(userId: number, role: string): Promise<SocialUserBrief[]> {
    return this.listSocialUsers(userId, role, 'followers');
  }

  listFollowing(userId: number, role: string): Promise<SocialUserBrief[]> {
    return this.listSocialUsers(userId, role, 'following');
  }

  followUser(userId: number, role: string): Promise<FollowState> {
    const normalizedRole = this.requireIdentityRole(role);
    if (!Number.isSafeInteger(userId) || userId <= 0) {
      return Promise.reject(ErrorMapper.parse());
    }
    return this.client.put<FollowState>(`/users/${userId}/follow?targetRole=${normalizedRole}`, undefined,
      `users.${userId}.${normalizedRole}.follow`);
  }

  unfollowUser(userId: number, role: string): Promise<FollowState> {
    const normalizedRole = this.requireIdentityRole(role);
    if (!Number.isSafeInteger(userId) || userId <= 0) {
      return Promise.reject(ErrorMapper.parse());
    }
    return this.client.delete<FollowState>(`/users/${userId}/follow?targetRole=${normalizedRole}`,
      `users.${userId}.${normalizedRole}.follow`);
  }

  cancelUserSystemRequests(userId?: number): void {
    this.client.cancelRequest('users.me');
    this.client.cancelRequest('users.me.role');
    this.client.cancelRequest('moments.favorites');
    if (userId !== undefined && Number.isSafeInteger(userId) && userId > 0) {
      ['CUSTOMER', 'PROVIDER'].forEach((identityRole: string) => {
        this.cancelSocialUserRequests(userId, identityRole);
        this.client.cancelRequest(`moments.profile.${userId}.${identityRole}`);
      });
    }
  }

  cancelSocialUserRequests(userId: number, role: string): void {
    const normalizedRole = role.trim().toUpperCase();
    if (!Number.isSafeInteger(userId) || userId <= 0 ||
      (normalizedRole !== 'CUSTOMER' && normalizedRole !== 'PROVIDER')) {
      return;
    }
    this.client.cancelRequest(`users.${userId}.${normalizedRole}.profile`);
    this.client.cancelRequest(`users.${userId}.${normalizedRole}.followers`);
    this.client.cancelRequest(`users.${userId}.${normalizedRole}.following`);
    this.client.cancelRequest(`users.${userId}.${normalizedRole}.follow`);
  }

  sendLoginCode(phone: string, deviceId: string): Promise<void> {
    const request: SendSmsCodeRequest = { phone: phone, purpose: 'LOGIN', deviceId: deviceId };
    return this.client.postPublic<void>('/auth/sms/send', request, 'auth.sms.send');
  }

  cancelSendLoginCode(): void {
    this.client.cancelRequest('auth.sms.send');
  }

  async verifyLoginCode(phone: string, code: string, deviceId: string): Promise<NativeSessionResponse> {
    const request: VerifyNativeSmsCodeRequest = {
      phone: phone, purpose: 'LOGIN', code: code, deviceId: deviceId, deviceName: 'Portra HarmonyOS'
    };
    const response = await this.client.postPublic<NativeSessionResponse>(
      '/auth/native/sms/verify', request, 'auth.sms.verify');
    return this.requireNativeSession(response);
  }

  cancelVerifyLoginCode(): void {
    this.client.cancelRequest('auth.sms.verify');
  }

  async currentSession(requestKey: string = 'auth.session'): Promise<SessionSummary> {
    const response = await this.client.get<SessionSummary>('/auth/session', requestKey);
    if (response === null || !Number.isSafeInteger(response.userId) || response.userId <= 0 ||
      typeof response.nickname !== 'string' || typeof response.role !== 'string') {
      throw ErrorMapper.parse();
    }
    return response;
  }

  cancelCurrentSession(requestKey: string = 'auth.session'): void {
    this.client.cancelRequest(requestKey);
  }

  listNotifications(page: number = 0, size: number = 20, requestKey: string = 'notifications.list'):
    Promise<PageResult<NotificationSummary>> {
    if (!Number.isSafeInteger(page) || page < 0 || !Number.isSafeInteger(size) || size < 1 || size > 100) {
      return Promise.reject(ErrorMapper.parse());
    }
    return this.client.get<PageResult<NotificationSummary>>('/notifications?page=' + page + '&size=' + size, requestKey);
  }
  unreadNotificationCount(requestKey: string = 'notifications.unread'): Promise<number> {
    return this.client.get<number>('/notifications/unread-count', requestKey);
  }
  markNotificationRead(id: number, requestKey: string = 'notifications.read'): Promise<NotificationSummary> {
    if (!Number.isSafeInteger(id) || id <= 0) { return Promise.reject(ErrorMapper.parse()); }
    return this.client.patch<NotificationSummary>('/notifications/' + id + '/read', undefined, requestKey);
  }
  markAllNotificationsRead(requestKey: string = 'notifications.readAll'): Promise<NotificationSummary[]> {
    return this.client.patch<NotificationSummary[]>('/notifications/read-all', undefined, requestKey);
  }
  cancelNotificationRequests(requestKeys: string[]): void {
    requestKeys.forEach((key: string) => this.client.cancelRequest(key));
  }
  getCreditSummary(id: number, requestKey: string = 'credit.summary'): Promise<CreditSummary> {
    if (!Number.isSafeInteger(id) || id <= 0) { return Promise.reject(ErrorMapper.parse()); }
    return this.client.get<CreditSummary>('/users/' + id + '/credit', requestKey);
  }
  listCreditRecords(id: number, requestKey: string = 'credit.records'): Promise<CreditRecordSummary[]> {
    if (!Number.isSafeInteger(id) || id <= 0) { return Promise.reject(ErrorMapper.parse()); }
    return this.client.get<CreditRecordSummary[]>('/users/' + id + '/credit-records', requestKey);
  }
  cancelCreditRequests(requestKeys: string[]): void {
    requestKeys.forEach((key: string) => this.client.cancelRequest(key));
  }

  listConversations(requestKey: string = 'conversations.list'): Promise<ConversationSummary[]> {
    return this.client.get<ConversationSummary[]>('/conversations', requestKey);
  }

  cancelConversations(requestKey: string = 'conversations.list'): void {
    this.client.cancelRequest(requestKey);
  }

  hideConversation(conversationId: number): Promise<void> {
    if (!Number.isSafeInteger(conversationId) || conversationId <= 0) {
      return Promise.reject(ErrorMapper.parse());
    }
    return this.client.delete<void>(`/conversations/${conversationId}`, `conversations.${conversationId}.hide`);
  }

  cancelHideConversation(conversationId: number): void {
    this.client.cancelRequest(`conversations.${conversationId}.hide`);
  }

  listMessages(conversationId: number): Promise<MessageSummary[]> {
    return this.client.get<MessageSummary[]>(`/conversations/${conversationId}/messages`,
      `conversations.${conversationId}.messages`);
  }

  sendMessage(conversationId: number, content: string): Promise<MessageSummary> {
    const payload: SendTextMessagePayload = { messageType: 'TEXT', content: content };
    return this.client.post<MessageSummary>(`/conversations/${conversationId}/messages`,
      payload, `conversations.${conversationId}.send`);
  }

  listQuotes(conversationId: number): Promise<QuoteSummary[]> {
    return this.client.get<QuoteSummary[]>(`/conversations/${conversationId}/quotations`,
      `conversations.${conversationId}.quotes`);
  }

  createQuote(payload: CreateQuotePayload): Promise<QuoteSummary> {
    return this.client.post<QuoteSummary>('/quotations', payload, `conversations.${payload.conversationId}.createQuote`);
  }

  confirmQuote(quoteId: number): Promise<ConfirmQuoteResult> {
    return this.client.post<ConfirmQuoteResult>(`/quotations/${quoteId}/confirm`,
      undefined, `quotations.${quoteId}.confirm`);
  }

  cancelConversationDetail(conversationId: number): void {
    this.client.cancelRequest(`conversations.${conversationId}.messages`);
    this.client.cancelRequest(`conversations.${conversationId}.quotes`);
    this.client.cancelRequest(`conversations.${conversationId}.send`);
    this.client.cancelRequest(`conversations.${conversationId}.createQuote`);
  }

  getOrder(id: number, requestKey: string = 'engagement.getOrder'): Promise<OrderEngagementSummary> {
    if (!Number.isSafeInteger(id) || id <= 0) { return Promise.reject(ErrorMapper.parse()); }
    return this.client.get<OrderEngagementSummary>(`/orders/${id}`, requestKey);
  }
  listOrderReviews(id: number, requestKey: string = 'engagement.listOrderReviews'): Promise<ReviewSummary[]> {
    if (!Number.isSafeInteger(id) || id <= 0) { return Promise.reject(ErrorMapper.parse()); }
    return this.client.get<ReviewSummary[]>(`/orders/${id}/reviews`, requestKey);
  }
  getReview(id: number, requestKey: string = 'engagement.getReview'): Promise<ReviewSummary> {
    if (!Number.isSafeInteger(id) || id <= 0) { return Promise.reject(ErrorMapper.parse()); }
    return this.client.get<ReviewSummary>(`/reviews/${id}`, requestKey);
  }
  listReviewComplaints(id: number, requestKey: string = 'engagement.listReviewComplaints'): Promise<ReviewComplaintSummary[]> {
    if (!Number.isSafeInteger(id) || id <= 0) { return Promise.reject(ErrorMapper.parse()); }
    return this.client.get<ReviewComplaintSummary[]>(`/reviews/${id}/complaints`, requestKey);
  }
  getReviewComplaint(id: number, requestKey: string = 'engagement.getReviewComplaint'): Promise<ReviewComplaintSummary> {
    if (!Number.isSafeInteger(id) || id <= 0) { return Promise.reject(ErrorMapper.parse()); }
    return this.client.get<ReviewComplaintSummary>(`/reviews/complaints/${id}`, requestKey);
  }
  listOrderDisputes(id: number, requestKey: string = 'engagement.listOrderDisputes'): Promise<DisputeSummary[]> {
    if (!Number.isSafeInteger(id) || id <= 0) { return Promise.reject(ErrorMapper.parse()); }
    return this.client.get<DisputeSummary[]>(`/orders/${id}/disputes`, requestKey);
  }
  getDispute(id: number, requestKey: string = 'engagement.getDispute'): Promise<DisputeSummary> {
    if (!Number.isSafeInteger(id) || id <= 0) { return Promise.reject(ErrorMapper.parse()); }
    return this.client.get<DisputeSummary>(`/disputes/${id}`, requestKey);
  }
  createReview(id: number, payload: CreateReviewPayload, requestKey: string = 'engagement.createReview'): Promise<ReviewSummary> {
    if (!Number.isSafeInteger(id) || id <= 0) { return Promise.reject(ErrorMapper.parse()); }
    return this.client.post<ReviewSummary>(`/orders/${id}/reviews`, payload, requestKey);
  }
  followUpReview(id: number, payload: ReviewTextPayload, requestKey: string = 'engagement.followUpReview'): Promise<ReviewSummary> {
    if (!Number.isSafeInteger(id) || id <= 0) { return Promise.reject(ErrorMapper.parse()); }
    return this.client.post<ReviewSummary>(`/reviews/${id}/follow-up`, payload, requestKey);
  }
  createReviewComplaint(id: number, payload: CreateReviewComplaintPayload, requestKey: string = 'engagement.createReviewComplaint'): Promise<ReviewComplaintSummary> {
    if (!Number.isSafeInteger(id) || id <= 0) { return Promise.reject(ErrorMapper.parse()); }
    return this.client.post<ReviewComplaintSummary>(`/reviews/${id}/complaints`, payload, requestKey);
  }
  createDispute(id: number, payload: DisputeReasonPayload, requestKey: string = 'engagement.createDispute'): Promise<DisputeSummary> {
    if (!Number.isSafeInteger(id) || id <= 0) { return Promise.reject(ErrorMapper.parse()); }
    return this.client.post<DisputeSummary>(`/orders/${id}/disputes`, payload, requestKey);
  }
  replyDispute(id: number, payload: ReviewTextPayload, requestKey: string = 'engagement.replyDispute'): Promise<DisputeSummary> {
    if (!Number.isSafeInteger(id) || id <= 0) { return Promise.reject(ErrorMapper.parse()); }
    return this.client.post<DisputeSummary>(`/disputes/${id}/replies`, payload, requestKey);
  }
  cancelEngagementRequests(keys: string[]): void { keys.forEach((key: string) => this.client.cancelRequest(key)); }

  listOrders(): Promise<OrderSummary[]> {
    return this.client.get<OrderSummary[]>('/orders', 'orders.list');
  }

  cancelOrders(): void {
    this.client.cancelRequest('orders.list');
  }

  createReport(payload: CreateReportPayload, requestKey: string = 'reports.create'): Promise<ReportSummary> {
    return this.client.post<ReportSummary>('/reports', payload, requestKey);
  }

  listMyReports(requestKey: string = 'reports.my'): Promise<ReportSummary[]> {
    return this.client.get<ReportSummary[]>('/reports/my', requestKey);
  }

  cancelReports(createRequestKey: string = 'reports.create', myRequestKey: string = 'reports.my'): void {
    this.client.cancelRequest(createRequestKey);
    this.client.cancelRequest(myRequestKey);
  }

  async refresh(refreshToken: string): Promise<NativeSessionResponse> {
    const request: NativeRefreshRequest = { refreshToken: refreshToken };
    const response = await this.client.postPublic<NativeSessionResponse>(
      '/auth/native/refresh', request, 'auth.refresh');
    return this.requireNativeSession(response);
  }

  logout(): Promise<boolean> {
    return this.client.post<boolean>('/auth/native/logout', undefined, 'auth.logout');
  }

  private requireNativeSession(response: NativeSessionResponse): NativeSessionResponse {
    if (response === null || typeof response.accessToken !== 'string' ||
      response.accessToken.trim().length === 0 || typeof response.refreshToken !== 'string' ||
      response.refreshToken.trim().length === 0 || !Number.isSafeInteger(response.userId) ||
      response.userId <= 0 || typeof response.nickname !== 'string' || typeof response.role !== 'string') {
      throw ErrorMapper.parse();
    }
    return response;
  }

  private safePage(value: number): number {
    return Number.isSafeInteger(value) && value > 0 ? value : 1;
  }

  private safeSize(value: number): number {
    return Number.isSafeInteger(value) && value > 0 ? Math.min(value, 100) : 10;
  }

  private requireIdentityRole(role: string): string {
    const normalizedRole = role.trim().toUpperCase();
    if (normalizedRole !== 'CUSTOMER' && normalizedRole !== 'PROVIDER') {
      throw ErrorMapper.parse();
    }
    return normalizedRole;
  }

  private listSocialUsers(userId: number, role: string, relation: string): Promise<SocialUserBrief[]> {
    const normalizedRole = this.requireIdentityRole(role);
    if (!Number.isSafeInteger(userId) || userId <= 0 ||
      (relation !== 'followers' && relation !== 'following')) {
      return Promise.reject(ErrorMapper.parse());
    }
    return this.client.get<SocialUserBrief[]>(`/users/${userId}/${relation}?role=${normalizedRole}`,
      `users.${userId}.${normalizedRole}.${relation}`);
  }

  private appendText(params: string[], name: string, value: string | undefined): void {
    const normalized = value?.trim() ?? '';
    if (normalized.length > 0) {
      params.push(`${name}=${encodeURIComponent(normalized)}`);
    }
  }

  private appendDate(params: string[], name: string, value: string | undefined): void {
    const normalized = value?.trim() ?? '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
      params.push(`${name}=${normalized}`);
    }
  }

  private appendNonNegative(params: string[], name: string, value: number | undefined): void {
    if (value !== undefined && Number.isSafeInteger(value) && value >= 0) {
      params.push(`${name}=${value}`);
    }
  }

  private appendSort(params: string[], value: string | undefined, allowed: string[]): void {
    const normalized = value?.trim().toLowerCase() ?? '';
    if (allowed.includes(normalized)) {
      params.push(`sort=${normalized}`);
    }
  }
}
