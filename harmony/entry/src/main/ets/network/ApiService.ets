import { CreateMomentPayload } from '../model/ApiModels';
import { DemandInterestSummary } from '../model/ApiModels';
import { OrderEngagementSummary, ReviewSummary, ReviewComplaintSummary, DisputeSummary, CreateReviewPayload, ReviewTextPayload, CreateReviewComplaintPayload, DisputeReasonPayload } from '../model/ApiModels';
import { NotificationSummary, CreditSummary, CreditRecordSummary } from '../model/ApiModels';
import { NativeSessionApi } from '../auth/NativeSessionApi';
import { AcceptedDemandResponse, AccountCancellationPayload, AccountCancellationSummary,
  ConfirmQuoteResult, ConversationSummary, CreateDemandPayload,
  CreateDemandResponsePayload, CreateQuotePayload, CreateReportPayload, CreateServicePackagePayload,
  CreateServicePackageResult,
  DemandListQuery, DemandResponseSummary, DemandSummary, DeliverySummary, MessageSummary, NativeRefreshRequest,
  NativeSessionResponse,
  FollowState, MockPaymentPayload, MomentSummary, OrderStatusLogSummary, OrderSummary, PageResult, PaymentResult,
  ProfileMomentPage, PublicUserProfile, QuoteSummary, RejectQuotePayload, RejectQuoteResult,
  ReportSummary, SendSmsCodeRequest, ServicePackageDetail, ServicePackageInterest, ServicePackageListQuery,
  ServicePackageSummary, SocialUserBrief, SwitchRolePayload, SwitchRoleResult, UserProfileSummary,
  SendTextMessagePayload, SessionSummary, StartServiceChatPayload, StartServiceChatResult,
  OrderTransitionPayload, ReworkPayload, StatusTransitionResult, VerifyNativeSmsCodeRequest } from '../model/ApiModels';
import { UpdateProfilePayload } from '../model/ApiModels';
import { PhotoAuthorizationDecisionPayload, PhotoAuthorizationPayload, PhotoAuthorizationSummary } from '../model/ApiModels';
import { UserBrief } from '../model/ApiModels';
import { ErrorMapper, PortraError } from './ErrorMapper';
import { UploadedImage, HttpClient } from './HttpClient';

interface DemandChatSnapshot { responseId: number; demandId: number; customerId: number; providerId: number; responseStatus: string; }
interface DemandChatPayload { responseId: number; demandId: number; customerId: number; providerUserId: number; status: string; }

export class ApiService implements NativeSessionApi {
  private readonly client: HttpClient;

  constructor(client: HttpClient = new HttpClient()) {
    this.client = client;
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
    this.appendText(params, 'cityCode', query.cityCode);
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
    const result = await this.client.get<DemandSummary>(`/demands/${demandId}`, 'demands.detail');
    if (result === null || result.demandId !== demandId) {
      throw ErrorMapper.parse();
    }
    return result;
  }

  cancelDemandDetail(): void {
    this.client.cancelRequest('demands.detail');
  }

  getDemandInterest(demandId: number): Promise<DemandInterestSummary> {
    return this.client.get<DemandInterestSummary>(`/demands/${demandId}/interest`, `demands.${demandId}.interestState`);
  }

  addDemandInterest(demandId: number): Promise<DemandInterestSummary> {
    return this.client.post<DemandInterestSummary>(`/demands/${demandId}/interest`, undefined, `demands.${demandId}.interest`);
  }

  removeDemandInterest(demandId: number): Promise<void> {
    return this.client.delete<void>(`/demands/${demandId}/interest`, `demands.${demandId}.interest`);
  }

  listDemandInterests(page: number = 1, size: number = 10): Promise<PageResult<DemandInterestSummary>> {
    return this.client.get<PageResult<DemandInterestSummary>>(
      `/me/demand-interests?page=${this.safePage(page)}&size=${this.safeSize(size)}`, 'demands.interests');
  }

  cancelDemandInterests(demandId: number = 0): void {
    this.client.cancelRequest('demands.interests');
    this.client.cancelRequest(`demands.${demandId}.interestState`);
    this.client.cancelRequest(`demands.${demandId}.interest`);
  }

  createDemand(payload: CreateDemandPayload): Promise<DemandSummary> {
    return this.client.post<DemandSummary>('/demands', payload, 'demands.create');
  }

  async openAcceptedDemandChat(responseId: number): Promise<ConversationSummary> {
    if (!Number.isSafeInteger(responseId) || responseId <= 0) { throw ErrorMapper.parse(); }
    const identity = this.client.getIdentityEpoch();
    const snapshot = await this.client.get<DemandChatSnapshot>(
      `/demands/responses/${responseId}/accepted-snapshot`, `demands.chat.${responseId}`);
    if (identity !== this.client.getIdentityEpoch() || !snapshot || snapshot.responseId !== responseId || snapshot.responseStatus !== 'ACCEPTED' ||
      !Number.isSafeInteger(snapshot.demandId) || snapshot.demandId <= 0 ||
      !Number.isSafeInteger(snapshot.customerId) || snapshot.customerId <= 0 ||
      !Number.isSafeInteger(snapshot.providerId) || snapshot.providerId <= 0) {
      throw ErrorMapper.parse();
    }
    const payload: DemandChatPayload = { responseId: snapshot.responseId, demandId: snapshot.demandId,
      customerId: snapshot.customerId, providerUserId: snapshot.providerId, status: snapshot.responseStatus };
    return this.client.post<ConversationSummary>('/conversations/from-response', payload, `demands.chat.${responseId}`);
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
    this.appendText(params, 'cityCode', query.cityCode);
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
    return this.client.get<ServicePackageDetail>(`/service-packages/${serviceId}`, 'servicePackages.detail');
  }

  startServiceChat(serviceId: number): Promise<StartServiceChatResult> {
    const payload: StartServiceChatPayload = {};
    return this.client.post<StartServiceChatResult>(`/service-packages/${serviceId}/start-chat`,
      payload, `servicePackages.${serviceId}.chat`);
  }

  createServicePackage(payload: CreateServicePackagePayload): Promise<CreateServicePackageResult> {
    return this.client.post<CreateServicePackageResult>('/service-packages', payload, 'servicePackages.create');
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


  listPublicMoments(userId: number, role: string, page: number, key: string): Promise<ProfileMomentPage> {
    return this.client.getPublic<ProfileMomentPage>(`/moments/profile?authorId=${userId}&authorRole=${this.requireIdentityRole(role)}&page=${this.safePage(page)}&size=12`, key);
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

  listLikedMoments(page: number = 1, size: number = 12): Promise<PageResult<MomentSummary>> {
    return this.client.get<PageResult<MomentSummary>>(
      `/moments/me/interactions?interaction=LIKED&page=${this.safePage(page)}&size=${this.safeSize(size)}`,
      'moments.likes');
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

  uploadImage(data: ArrayBuffer, bizType: string, mime: string, filename: string): Promise<UploadedImage> {
    return this.client.uploadImage(data, bizType, mime, filename);
  }
  updateMyProfile(payload: UpdateProfilePayload): Promise<void> {
    return this.client.patch<void>('/users/me', payload, 'users.me.update');
  }
  listMyDemands(page: number = 1, requestKey: string = 'profile.demands'): Promise<PageResult<DemandSummary>> {
    return this.client.get<PageResult<DemandSummary>>(`/demands/me/publications?page=${this.safePage(page)}&size=10`, requestKey);
  }
  listMyServices(page: number = 1, requestKey: string = 'profile.services'): Promise<PageResult<ServicePackageSummary>> {
    return this.client.get<PageResult<ServicePackageSummary>>(`/service-packages/me/publications?page=${this.safePage(page)}&size=10`, requestKey);
  }
  updateDemand(id: number, payload: CreateDemandPayload): Promise<DemandSummary> {
    return this.client.put<DemandSummary>(`/demands/${id}`, payload, 'demands.update');
  }
  closeDemand(id: number): Promise<DemandSummary> {
    return this.client.patch<DemandSummary>(`/demands/${id}/close`, undefined, 'demands.close');
  }
  updateService(id: number, payload: CreateServicePackagePayload): Promise<ServicePackageDetail> {
    return this.client.put<ServicePackageDetail>(`/service-packages/${id}`, payload, 'servicePackages.update');
  }
  offlineService(id: number): Promise<ServicePackageDetail> {
    return this.client.patch<ServicePackageDetail>(`/service-packages/${id}/offline`, undefined, 'servicePackages.offline');
  }
  listPublicDemands(userId: number, page: number, key: string): Promise<PageResult<DemandSummary>> {
    return this.client.getPublic<PageResult<DemandSummary>>(`/demands/by-user/${userId}?page=${this.safePage(page)}&size=12`, key);
  }
  listPublicServices(userId: number, page: number, key: string): Promise<PageResult<ServicePackageSummary>> {
    return this.client.getPublic<PageResult<ServicePackageSummary>>(`/service-packages/by-user/${userId}?page=${this.safePage(page)}&size=12`, key);
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
    return this.client.getPublic<PublicUserProfile>(
      `/users/${userId}/public-profile?role=${normalizedRole}`, requestKey ?? `users.${userId}.${normalizedRole}.profile`);
  }

  cancelPublicProfile(profileRequestKey: string, momentsRequestKey: string): void {
    this.client.cancelRequest(profileRequestKey);
    this.client.cancelRequest(momentsRequestKey);
    this.client.cancelRequest(profileRequestKey.replace(/\.profile$/, '.content'));
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
    this.client.cancelRequest('profile.orders');
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

  // Both endpoints are server-authoritative. A failing optional session summary
  // must not disable the hall/search/publish UI if /users/me still verifies the
  // same signed-in account. Callers that are already recovering /users/me may
  // opt out of the reverse fallback to avoid a circular retry chain.
  async currentSession(requestKey: string = 'auth.session', allowProfileFallback: boolean = true): Promise<SessionSummary> {
    try {
      const response = await this.client.get<SessionSummary>('/auth/session', requestKey);
      if (response === null || !Number.isSafeInteger(response.userId) || response.userId <= 0 ||
        typeof response.nickname !== 'string' ||
        (response.role !== 'CUSTOMER' && response.role !== 'PROVIDER')) {
        throw ErrorMapper.parse();
      }
      return response;
    } catch (error) {
      if (!allowProfileFallback || ErrorMapper.isStale(error as PortraError) ||
        ErrorMapper.isAuthenticationExpired(error as PortraError) ||
        (error as PortraError).httpStatus === 403 || (error as PortraError).businessCode === 40301) {
        throw error as PortraError;
      }
    }
    // Use an independent request key: never cancel the personal page's
    // simultaneous /users/me load when the hall or search is recovering.
    const profile = await this.client.get<UserProfileSummary>('/users/me', `${requestKey}.profileFallback`);
    if (profile === null || !Number.isSafeInteger(profile.id) || profile.id <= 0 ||
      (profile.currentRole !== 'CUSTOMER' && profile.currentRole !== 'PROVIDER')) {
      throw ErrorMapper.parse();
    }
    // Do not fabricate sessionId, deviceId, admin permission or other metadata.
    return { userId: profile.id, nickname: profile.nickname ?? '', role: profile.currentRole };
  }

  cancelCurrentSession(requestKey: string = 'auth.session'): void {
    this.client.cancelRequest(requestKey);
    this.client.cancelRequest(`${requestKey}.profileFallback`);
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

  getUserBrief(userId: number, role: string): Promise<UserBrief> {
    const suffix = role === 'PROVIDER' ? '?role=PROVIDER' : '?role=CUSTOMER';
    return this.client.get<UserBrief>(`/users/${userId}/brief${suffix}`, `users.${userId}.brief`);
  }

  getAvatarThumbnail(fileId: number): Promise<ArrayBuffer> {
    if (!Number.isSafeInteger(fileId) || fileId <= 0) return Promise.reject(ErrorMapper.parse());
    return this.client.getBinary(`/files/${fileId}/thumbnail`, `avatar.${fileId}`);
  }

  cancelAvatarThumbnail(fileId: number): void {
    this.client.cancelRequest(`avatar.${fileId}`);
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

  listMessages(conversationId: number,
    requestKey: string = `conversations.${conversationId}.messages`): Promise<MessageSummary[]> {
    return this.client.get<MessageSummary[]>(`/conversations/${conversationId}/messages`,
      requestKey);
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

  async createQuote(payload: CreateQuotePayload): Promise<QuoteSummary> {
    const result = await this.client.post<QuoteSummary>('/quotations', payload,
      `conversations.${payload.conversationId}.createQuote`);
    return this.requireQuote(result, payload.conversationId);
  }

  async updateQuote(quoteId: number, payload: CreateQuotePayload): Promise<QuoteSummary> {
    const result = await this.client.put<QuoteSummary>(`/quotations/${quoteId}`, payload,
      `quotations.${quoteId}.update`);
    const quote = this.requireQuote(result, payload.conversationId);
    if (quote.quotationId !== quoteId) throw ErrorMapper.parse();
    return quote;
  }

  async rejectQuote(quoteId: number, reason: string): Promise<RejectQuoteResult> {
    const payload: RejectQuotePayload = { rejectReason: reason };
    const result = await this.client.post<RejectQuoteResult>(`/quotations/${quoteId}/reject`,
      payload, `quotations.${quoteId}.reject`);
    if (result === null || result.quotationId !== quoteId || result.quotationStatus !== 'REJECTED') {
      throw ErrorMapper.parse();
    }
    return result;
  }

  async confirmQuote(quoteId: number): Promise<ConfirmQuoteResult> {
    const result = await this.client.post<ConfirmQuoteResult>(`/quotations/${quoteId}/confirm`,
      undefined, `quotations.${quoteId}.confirm`);
    if (result === null || result.quotationId !== quoteId || !Number.isSafeInteger(result.orderId) ||
      result.orderId <= 0 || result.quotationStatus !== 'CONFIRMED') throw ErrorMapper.parse();
    return result;
  }

  cancelConversationDetail(conversationId: number): void {
    this.client.cancelRequest(`conversations.${conversationId}.messages`);
    this.client.cancelRequest(`conversations.${conversationId}.quotes`);
    this.client.cancelRequest(`conversations.${conversationId}.send`);
    this.client.cancelRequest(`conversations.${conversationId}.createQuote`);
  }

  getOrder(id: number, requestKey: string = `orders.${id}.detail`): Promise<OrderEngagementSummary> {
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
  cancelReviewComplaint(id: number): Promise<ReviewComplaintSummary> {
    if (!Number.isSafeInteger(id) || id <= 0) return Promise.reject(ErrorMapper.parse());
    return this.client.post<ReviewComplaintSummary>(`/reviews/complaints/${id}/cancel`,
      undefined, `review.complaint.${id}.cancel`);
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

  listOrders(role?: string, requestKey: string = 'orders.list'): Promise<OrderSummary[]> {
    const path = role === undefined ? '/orders' : `/orders?role=${this.requireIdentityRole(role)}`;
    return this.client.get<OrderSummary[]>(path, requestKey);
  }

  getOrderStatusLogs(orderId: number): Promise<OrderStatusLogSummary[]> {
    return this.client.get<OrderStatusLogSummary[]>(`/orders/${orderId}/status-logs`, `orders.${orderId}.logs`);
  }

  listDeliveries(orderId: number): Promise<DeliverySummary[]> {
    return this.client.get<DeliverySummary[]>(`/orders/${orderId}/deliveries`, `orders.${orderId}.deliveries`);
  }

  listPhotoAuthorizations(orderId: number, key: string = `authorizations.${orderId}.list`): Promise<PhotoAuthorizationSummary[]> {
    if (!Number.isSafeInteger(orderId) || orderId <= 0) return Promise.reject(ErrorMapper.parse());
    return this.client.get<PhotoAuthorizationSummary[]>(`/orders/${orderId}/photo-authorizations`, key);
  }

  requestPhotoAuthorization(orderId: number, payload: PhotoAuthorizationPayload): Promise<PhotoAuthorizationSummary> {
    if (!Number.isSafeInteger(orderId) || orderId <= 0 || !Array.isArray(payload.fileIds) ||
      payload.fileIds.length === 0 || payload.fileIds.some((id: number) => !Number.isSafeInteger(id) || id <= 0)) {
      return Promise.reject(ErrorMapper.parse());
    }
    return this.client.post<PhotoAuthorizationSummary>(`/orders/${orderId}/photo-authorizations/requests`,
      payload, `authorizations.${orderId}.request`);
  }

  decidePhotoAuthorization(id: number, approve: boolean, remark: string): Promise<PhotoAuthorizationSummary> {
    if (!Number.isSafeInteger(id) || id <= 0) return Promise.reject(ErrorMapper.parse());
    const payload: PhotoAuthorizationDecisionPayload = { remark: remark };
    return this.client.post<PhotoAuthorizationSummary>(`/photo-authorizations/${id}/${approve ? 'approve' : 'reject'}`,
      payload, `authorizations.${id}.decision`);
  }

  cancelPhotoAuthorizationReads(orderId: number): void {
    this.client.cancelRequest(`authorizations.${orderId}.list`);
    this.client.cancelRequest(`orders.${orderId}.deliveries`);
  }

  getDeliveryImage(fileId: number, variant: 'thumbnail' | 'medium',
    requestKey: string = `delivery.${fileId}.${variant}`): Promise<ArrayBuffer> {
    if (!Number.isSafeInteger(fileId) || fileId <= 0) return Promise.reject(ErrorMapper.parse());
    return this.client.getBinary(`/files/${fileId}/${variant}`, requestKey,
      variant === 'thumbnail' ? 2 * 1024 * 1024 : 12 * 1024 * 1024);
  }

  cancelDeliveryImage(fileId: number, variant: 'thumbnail' | 'medium',
    requestKey: string = `delivery.${fileId}.${variant}`): void {
    this.client.cancelRequest(requestKey);
  }

  cancelOrder(orderId: number): Promise<StatusTransitionResult> {
    return this.client.post<StatusTransitionResult>(`/orders/${orderId}/cancel`, undefined,
      `orders.${orderId}.cancel`);
  }

  requestRework(orderId: number, reason: string): Promise<StatusTransitionResult> {
    const payload: ReworkPayload = { reason: reason };
    return this.client.post<StatusTransitionResult>(`/orders/${orderId}/request-rework`, payload,
      `orders.${orderId}.rework`);
  }

  confirmReceipt(orderId: number): Promise<StatusTransitionResult> {
    const payload: OrderTransitionPayload = { targetStatus: 'COMPLETED', reason: '客户确认收片' };
    return this.client.post<StatusTransitionResult>(`/orders/${orderId}/status-transitions`,
      payload, `orders.${orderId}.receipt`);
  }

  async mockPay(orderId: number, amountCent: number): Promise<PaymentResult> {
    const payload: MockPaymentPayload = { payMethod: 'MOCK_PAY', amountCent: amountCent };
    const result = await this.client.post<PaymentResult>(`/orders/${orderId}/payments`,
      payload, `orders.${orderId}.pay`);
    return this.requirePayment(result, orderId, amountCent);
  }

  async getPayment(orderId: number): Promise<PaymentResult> {
    const result = await this.client.get<PaymentResult>(`/orders/${orderId}/payments`, `orders.${orderId}.payment`);
    return this.requirePayment(result, orderId);
  }

  cancelOrderDetail(orderId: number): void {
    this.client.cancelRequest(`orders.${orderId}.detail`);
    this.client.cancelRequest(`orders.${orderId}.logs`);
    this.client.cancelRequest(`orders.${orderId}.payment`);
    this.client.cancelRequest(`orders.${orderId}.deliveries`);
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

  getAccountCancellation(): Promise<AccountCancellationSummary> {
    return this.client.get<AccountCancellationSummary>(
      '/users/me/cancellation-request', 'users.me.cancellation.get');
  }

  requestAccountCancellation(reason?: string): Promise<AccountCancellationSummary> {
    const normalizedReason = reason?.trim() ?? '';
    const payload: AccountCancellationPayload = normalizedReason.length > 0 ?
      { reason: normalizedReason } : {};
    return this.client.post<AccountCancellationSummary>(
      '/users/me/cancellation-request', payload, 'users.me.cancellation.create');
  }

  cancelAccountCancellationRequests(): void {
    this.client.cancelRequest('users.me.cancellation.get');
    this.client.cancelRequest('users.me.cancellation.create');
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

  private requireQuote(quote: QuoteSummary, conversationId: number): QuoteSummary {
    if (quote === null || !Number.isSafeInteger(quote.quotationId) || quote.quotationId <= 0 ||
      quote.conversationId !== conversationId || !Number.isSafeInteger(quote.amountCent) ||
      quote.amountCent <= 0) throw ErrorMapper.parse();
    return quote;
  }

  private requirePayment(payment: PaymentResult, orderId: number, amountCent?: number): PaymentResult {
    if (payment === null || !Number.isSafeInteger(payment.paymentId) || payment.paymentId <= 0 ||
      payment.orderId !== orderId || !Number.isSafeInteger(payment.amountCent) ||
      payment.amountCent < 0 || (amountCent !== undefined && payment.amountCent !== amountCent)) {
      throw ErrorMapper.parse();
    }
    return payment;
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
