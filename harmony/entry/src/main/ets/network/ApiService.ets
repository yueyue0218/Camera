import { NativeSessionApi } from '../auth/NativeSessionApi';
import { AcceptedDemandResponse, ConfirmQuoteResult, ConversationSummary, CreateDemandPayload,
  CreateDemandResponsePayload, CreateQuotePayload,
  DemandResponseSummary, DemandSummary, MessageSummary, NativeRefreshRequest, NativeSessionResponse,
  OrderSummary, PageResult, QuoteSummary, SendSmsCodeRequest, ServicePackageDetail, ServicePackageSummary,
  SendTextMessagePayload, SessionSummary, StartServiceChatPayload, StartServiceChatResult,
  VerifyNativeSmsCodeRequest } from '../model/ApiModels';
import { ErrorMapper } from './ErrorMapper';
import { HttpClient } from './HttpClient';

export class ApiService implements NativeSessionApi {
  private readonly client: HttpClient;

  constructor(client: HttpClient = new HttpClient()) {
    this.client = client;
  }

  listDemands(page: number = 1, size: number = 10, requestKey: string = 'demands.list'):
    Promise<PageResult<DemandSummary>> {
    return this.client.getPublic<PageResult<DemandSummary>>(
      `/demands?page=${page}&size=${size}`,
      requestKey
    );
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
    return this.client.post<DemandSummary>('/demands', payload, 'demands.create');
  }

  respondToDemand(demandId: number, message: string, expectedPriceCent?: number): Promise<DemandResponseSummary> {
    const payload: CreateDemandResponsePayload = { message: message, expectedPriceCent: expectedPriceCent };
    return this.client.post<DemandResponseSummary>(`/demands/${demandId}/responses`,
      payload, `demands.${demandId}.respond`);
  }

  listDemandResponses(demandId: number): Promise<DemandResponseSummary[]> {
    return this.client.get<DemandResponseSummary[]>(`/demands/${demandId}/responses`, `demands.${demandId}.responses`);
  }

  acceptDemandResponse(demandId: number, responseId: number): Promise<AcceptedDemandResponse> {
    return this.client.post<AcceptedDemandResponse>(`/demands/${demandId}/responses/${responseId}/accept`,
      undefined, `demands.${demandId}.accept`);
  }

  cancelDemandActions(demandId: number): void {
    this.client.cancelRequest(`demands.${demandId}.responses`);
    this.client.cancelRequest(`demands.${demandId}.respond`);
    this.client.cancelRequest(`demands.${demandId}.accept`);
  }

  listServicePackages(page: number = 1, size: number = 10, requestKey: string = 'servicePackages.list'):
    Promise<PageResult<ServicePackageSummary>> {
    return this.client.getPublic<PageResult<ServicePackageSummary>>(
      `/service-packages?page=${page}&size=${size}`,
      requestKey
    );
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

  cancelServiceDetail(serviceId: number): void {
    this.client.cancelRequest('servicePackages.detail');
    this.client.cancelRequest(`servicePackages.${serviceId}.chat`);
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

  async currentSession(): Promise<SessionSummary> {
    const response = await this.client.get<SessionSummary>('/auth/session', 'auth.session');
    if (response === null || !Number.isSafeInteger(response.userId) || response.userId <= 0 ||
      typeof response.nickname !== 'string' || typeof response.role !== 'string') {
      throw ErrorMapper.parse();
    }
    return response;
  }

  cancelCurrentSession(): void {
    this.client.cancelRequest('auth.session');
  }

  listConversations(requestKey: string = 'conversations.list'): Promise<ConversationSummary[]> {
    return this.client.get<ConversationSummary[]>('/conversations', requestKey);
  }

  cancelConversations(requestKey: string = 'conversations.list'): void {
    this.client.cancelRequest(requestKey);
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
  }

  listOrders(): Promise<OrderSummary[]> {
    return this.client.get<OrderSummary[]>('/orders', 'orders.list');
  }

  cancelOrders(): void {
    this.client.cancelRequest('orders.list');
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
}
