import { CreateQuotePayload, QuoteSummary } from '../../model/ApiModels';

export interface QuoteDraft {
  amount: string;
  shootStart: string;
  shootEnd: string;
  delivery: string;
  location: string;
  service: string;
  originals: string;
  refined: string;
  usage: string;
  terms: string;
  contract: string;
  remark: string;
}

export class QuoteWorkflow {
  static empty(): QuoteDraft {
    return { amount: '', shootStart: '', shootEnd: '', delivery: '', location: '', service: '',
      originals: '', refined: '', usage: 'PERSONAL_ONLY', terms: '', contract: '', remark: '' };
  }

  static withField(draft: QuoteDraft, field: string, value: string): QuoteDraft {
    return {
      amount: field === 'amount' ? value : draft.amount,
      shootStart: field === 'shootStart' ? value : draft.shootStart,
      shootEnd: field === 'shootEnd' ? value : draft.shootEnd,
      delivery: field === 'delivery' ? value : draft.delivery,
      location: field === 'location' ? value : draft.location,
      service: field === 'service' ? value : draft.service,
      originals: field === 'originals' ? value : draft.originals,
      refined: field === 'refined' ? value : draft.refined,
      usage: field === 'usage' ? value : draft.usage,
      terms: field === 'terms' ? value : draft.terms,
      contract: field === 'contract' ? value : draft.contract,
      remark: field === 'remark' ? value : draft.remark
    };
  }

  static isDraft(value: QuoteDraft | null): boolean {
    return value !== null && typeof value.amount === 'string' && typeof value.shootStart === 'string' &&
      typeof value.shootEnd === 'string' && typeof value.delivery === 'string' &&
      typeof value.location === 'string' && typeof value.service === 'string' &&
      typeof value.originals === 'string' && typeof value.refined === 'string' &&
      typeof value.usage === 'string' && typeof value.terms === 'string' &&
      typeof value.contract === 'string' && typeof value.remark === 'string';
  }

  static fromQuote(quote: QuoteSummary): QuoteDraft {
    return { amount: (quote.amountCent / 100).toFixed(2), shootStart: QuoteWorkflow.dateInput(quote.shootStartTime),
      shootEnd: QuoteWorkflow.dateInput(quote.shootEndTime), delivery: QuoteWorkflow.dateInput(quote.deliveryDeadline),
      location: quote.location, service: quote.serviceContent, originals: String(quote.originalCount ?? 0),
      refined: String(quote.refinedCount ?? 0), usage: quote.photoUsageScope ?? 'PERSONAL_ONLY',
      terms: quote.terms ?? '', contract: quote.contractTerms ?? '', remark: quote.remark ?? '' };
  }

  static dateInput(value: string): string {
    return typeof value === 'string' ? value.replace('T', ' ').slice(0, 16) : '';
  }

  static status(quote: QuoteSummary): string {
    if (quote.status === 'PENDING_CONFIRM' && quote.expireTime !== undefined &&
      Date.parse(quote.expireTime) <= Date.now()) return '已过期';
    switch (quote.status) {
      case 'PENDING_CONFIRM': return '待确认';
      case 'CONFIRMED': return '已确认';
      case 'REJECTED': return '已拒绝';
      case 'EXPIRED': return '已过期';
      default: return '待更新';
    }
  }

  static canEdit(quote: QuoteSummary, userId: number): boolean {
    return quote.providerUserId === userId && QuoteWorkflow.status(quote) === '待确认';
  }

  static canDecide(quote: QuoteSummary, userId: number): boolean {
    return quote.customerId === userId && QuoteWorkflow.status(quote) === '待确认';
  }

  static active(quotes: QuoteSummary[]): QuoteSummary | undefined {
    return quotes.find((quote: QuoteSummary) => QuoteWorkflow.status(quote) === '待确认');
  }

  static payload(conversationId: number, draft: QuoteDraft): CreateQuotePayload {
    const amount = draft.amount.trim();
    if (!/^\d+(\.\d{1,2})?$/.test(amount) || Number(amount) <= 0 ||
      !Number.isSafeInteger(Math.round(Number(amount) * 100))) throw new Error('请填写正确的费用');
    const start = QuoteWorkflow.dateValue(draft.shootStart);
    const end = QuoteWorkflow.dateValue(draft.shootEnd);
    const delivery = QuoteWorkflow.dateValue(draft.delivery);
    if (!start || !end || !delivery || start >= end || end >= delivery) {
      throw new Error('请检查拍摄和交付时间');
    }
    if (!draft.location.trim() || !draft.service.trim()) throw new Error('请填写地点和服务内容');
    const originalCount = QuoteWorkflow.count(draft.originals);
    const refinedCount = QuoteWorkflow.count(draft.refined);
    if (originalCount === undefined || refinedCount === undefined) throw new Error('请填写正确的照片数量');
    return { conversationId: conversationId, amountCent: Math.round(Number(amount) * 100),
      shootStartTime: start, shootEndTime: end, deliveryDeadline: delivery,
      location: draft.location.trim(), serviceContent: draft.service.trim(), originalCount: originalCount,
      refinedCount: refinedCount, photoUsageScope: draft.usage, terms: draft.terms.trim(),
      contractTerms: draft.contract.trim(), remark: draft.remark.trim() };
  }

  private static dateValue(input: string): string | undefined {
    const value = input.trim().replace(' ', 'T');
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return undefined;
    const parsed = new Date(`${value}:00`);
    if (Number.isNaN(parsed.getTime()) || parsed.getFullYear() !== Number(value.slice(0, 4)) ||
      parsed.getMonth() + 1 !== Number(value.slice(5, 7)) || parsed.getDate() !== Number(value.slice(8, 10))) {
      return undefined;
    }
    return `${value}:00`;
  }

  private static count(value: string): number | undefined {
    const text = value.trim();
    if (!text) return 0;
    const count = Number(text);
    return /^\d+$/.test(text) && Number.isSafeInteger(count) && count <= 10000 ? count : undefined;
  }
}
