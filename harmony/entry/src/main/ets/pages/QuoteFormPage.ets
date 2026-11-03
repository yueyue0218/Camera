import { KeyboardAvoidMode } from '@kit.ArkUI';
import { AppClient } from '../app/AppClient';
import { PortraPageHeading } from '../common/components/PortraPageHeading';
import { PortraLoading } from '../common/components/PortraLoading';
import { QuoteDraftStore } from '../features/conversation/QuoteDraftStore';
import { QuoteDraft, QuoteWorkflow } from '../features/conversation/QuoteWorkflow';
import { CreateQuotePayload, QuoteSummary } from '../model/ApiModels';
import { PortraError } from '../network/ErrorMapper';
import { PortraTheme } from '../theme/PortraTheme';

@Component
export struct QuoteFormPage {
  @Prop conversationId: number = 0;
  @Prop quoteId: number = 0;
  @State private draft: QuoteDraft = QuoteWorkflow.empty();
  @State private original: string = '';
  @State private userId: number = 0;
  @State private busy: boolean = false;
  @State private ready: boolean = false;
  @State private errorMessage: string = '';
  @State private confirmDiscard: boolean = false;
  private readonly api = AppClient.shared.apiService;
  private requestVersion: number = 0;
  private draftTimer: number = -1;
  private finished: boolean = false;
  private loadedSessionVersion: number = -1;
  private previousKeyboardAvoidMode?: KeyboardAvoidMode;
  onBack?: () => void;
  onSaved?: () => void;

  aboutToAppear(): void {
    this.previousKeyboardAvoidMode = this.getUIContext().getKeyboardAvoidMode();
    this.getUIContext().setKeyboardAvoidMode(KeyboardAvoidMode.RESIZE);
    if (this.ready && this.loadedSessionVersion === AppClient.shared.sessionManager.getSessionVersion()) return;
    this.load();
  }

  aboutToDisappear(): void {
    if (this.previousKeyboardAvoidMode !== undefined) {
      this.getUIContext().setKeyboardAvoidMode(this.previousKeyboardAvoidMode);
      this.previousKeyboardAvoidMode = undefined;
    }
    this.requestVersion++;
    if (this.draftTimer >= 0) clearTimeout(this.draftTimer);
    this.draftTimer = -1;
    if (!this.finished && this.userId > 0 && JSON.stringify(this.draft) !== this.original) {
      QuoteDraftStore.write(this.userId, this.conversationId, this.quoteId, this.draft);
    }
  }

  private async load(): Promise<void> {
    const version = ++this.requestVersion;
    this.errorMessage = '';
    try {
      const session = await this.api.currentSession();
      if (version !== this.requestVersion) return;
      if (this.userId !== session.userId) {
        this.draft = QuoteWorkflow.empty();
        this.ready = false;
      }
      this.userId = session.userId;
      if (this.quoteId > 0) {
        const quotes = await this.api.listQuotes(this.conversationId);
        if (version !== this.requestVersion) return;
        const quote = quotes.find((item: QuoteSummary) => item.quotationId === this.quoteId);
        if (quote === undefined || !QuoteWorkflow.canEdit(quote, this.userId)) {
          this.errorMessage = '这份报价已无法修改';
          return;
        }
        this.draft = QuoteWorkflow.fromQuote(quote);
      }
      this.original = JSON.stringify(this.draft);
      const saved = QuoteDraftStore.read(this.userId, this.conversationId, this.quoteId);
      if (saved !== undefined) this.draft = saved;
      this.loadedSessionVersion = AppClient.shared.sessionManager.getSessionVersion();
      this.ready = true;
    } catch (error) {
      if (version === this.requestVersion) this.errorMessage = (error as PortraError).message || '暂时无法打开报价';
    }
  }

  private update(draft: QuoteDraft): void {
    this.draft = draft;
    this.errorMessage = '';
    if (this.draftTimer >= 0) clearTimeout(this.draftTimer);
    this.draftTimer = setTimeout(() => {
      if (!this.finished && this.userId > 0) {
        QuoteDraftStore.write(this.userId, this.conversationId, this.quoteId, this.draft);
      }
      this.draftTimer = -1;
    }, 300);
  }

  private field(name: string, value: string): void {
    this.update(QuoteWorkflow.withField(this.draft, name, value));
  }

  private dateValue(name: string): string {
    return name === 'shootStart' ? this.draft.shootStart :
      name === 'shootEnd' ? this.draft.shootEnd : this.draft.delivery;
  }

  private chooseDate(name: string): void {
    this.getUIContext().showDatePickerDialog({ selected: QuoteWorkflow.selectedDate(this.draft, name),
      showTime: true, useMilitaryTime: true,
      onDateAccept: (date: Date) => {
        this.update(QuoteWorkflow.withSelectedDate(this.draft, name, date));
        if (this.userId > 0) QuoteDraftStore.write(this.userId, this.conversationId, this.quoteId, this.draft);
      } });
  }

  private close(): void {
    if (!this.busy && JSON.stringify(this.draft) !== this.original) this.confirmDiscard = true;
    else this.onBack?.();
  }

  private async save(): Promise<void> {
    if (this.busy || !this.ready) return;
    let payload: CreateQuotePayload;
    try {
      payload = QuoteWorkflow.payload(this.conversationId, this.draft);
    } catch (error) {
      this.errorMessage = (error as Error).message;
      return;
    }
    this.busy = true;
    this.errorMessage = '';
    const version = this.requestVersion;
    try {
      if (this.quoteId > 0) await this.api.updateQuote(this.quoteId, payload);
      else await this.api.createQuote(payload);
      this.finished = true;
      if (this.draftTimer >= 0) clearTimeout(this.draftTimer);
      QuoteDraftStore.clear(this.userId, this.conversationId, this.quoteId);
      if (version === this.requestVersion) this.onSaved?.();
    } catch (error) {
      if (version === this.requestVersion) this.errorMessage = (error as PortraError).businessCode === 40902 ?
        '已有待确认的报价，请先查看' : (error as PortraError).message || '报价暂未保存';
    } finally {
      this.busy = false;
    }
  }

  @Builder
  private Field(label: string, value: string, hint: string, inputType: InputType,
    onChange: (text: string) => void) {
    Column({ space: 6 }) {
      Text(label).fontSize(13).fontColor(PortraTheme.secondaryText)
      TextInput({ text: value, placeholder: hint })
        .type(inputType)
        .height(48).enabled(this.ready).backgroundColor(PortraTheme.surface).borderRadius(6)
        .onChange(onChange)
    }.alignItems(HorizontalAlign.Start).width('100%')
  }

  @Builder
  private DateField(label: string, name: string) {
    Column({ space: 6 }) {
      Text(label).fontSize(13).fontColor(PortraTheme.secondaryText)
      Row() {
        Text(this.dateValue(name) ? this.dateValue(name).replace(/^(\d{4})-(\d{2})-(\d{2}) /, '$1年$2月$3日  ') : '')
          .fontSize(15).fontColor(PortraTheme.primaryText).layoutWeight(1)
        Image($r('app.media.ic_calendar')).width(20).height(20)
      }.height(48).width('100%').padding({ left: 14, right: 14 }).borderRadius(6)
        .backgroundColor(PortraTheme.surface).onClick(() => { if (this.ready) this.chooseDate(name); })
    }.alignItems(HorizontalAlign.Start).width('100%')
  }

  @Builder
  private LongField(label: string, value: string, hint: string, name: string) {
    Column({ space: 6 }) {
      Text(label).fontSize(13).fontColor(PortraTheme.secondaryText)
      TextArea({ text: value, placeholder: hint }).height(92)
        .enabled(this.ready).backgroundColor(PortraTheme.surface).borderRadius(6)
        .onChange((text: string) => this.field(name, text))
    }.alignItems(HorizontalAlign.Start).width('100%')
  }

  build() {
    Stack({ alignContent: Alignment.Bottom }) {
      Column() {
      PortraPageHeading({ title: this.quoteId > 0 ? '编辑报价' : '发送报价', eyebrow: '', onBack: () => this.close() })
      if (!this.ready && !this.errorMessage) {
        PortraLoading({ label: '正在打开报价' }).layoutWeight(1)
      } else if (!this.ready) {
        Column({ space: 16 }) {
          Text(this.errorMessage).fontSize(14).fontColor(PortraTheme.danger)
          Button('重新打开').onClick(() => this.load())
        }.width('100%').padding(20).layoutWeight(1)
      } else {
      Scroll() {
        Column({ space: 16 }) {
          Text('拍摄安排').fontSize(17).fontWeight(FontWeight.Bold).fontColor(PortraTheme.primaryText)
          this.DateField('开始时间', 'shootStart')
          this.DateField('结束时间', 'shootEnd')
          this.Field('拍摄地点', this.draft.location, '', InputType.Normal, (value: string) =>
            this.field('location', value))
          Divider().color(PortraTheme.border)
          Text('服务内容').fontSize(17).fontWeight(FontWeight.Bold).fontColor(PortraTheme.primaryText)
          this.Field('费用（元）', this.draft.amount, '', InputType.NUMBER_DECIMAL, (value: string) =>
            this.field('amount', value))
          this.LongField('拍摄服务', this.draft.service, '', 'service')
          this.Field('原片数量', this.draft.originals, '', InputType.Number, (value: string) =>
            this.field('originals', value))
          this.Field('精修数量', this.draft.refined, '', InputType.Number, (value: string) =>
            this.field('refined', value))
          Divider().color(PortraTheme.border)
          Text('交付约定').fontSize(17).fontWeight(FontWeight.Bold).fontColor(PortraTheme.primaryText)
          this.DateField('最晚交付', 'delivery')
          Text('图片使用').fontSize(13).fontColor(PortraTheme.secondaryText)
          Row({ space: 8 }) {
            Button('仅供个人使用').backgroundColor(this.draft.usage === 'PERSONAL_ONLY' ?
              PortraTheme.primary : PortraTheme.surface)
              .enabled(this.ready)
              .fontColor(this.draft.usage === 'PERSONAL_ONLY' ? PortraTheme.white : PortraTheme.primaryText)
              .onClick(() => this.field('usage', 'PERSONAL_ONLY'))
            Button('另行协商').backgroundColor(this.draft.usage === 'NEGOTIABLE' ?
              PortraTheme.primary : PortraTheme.surface)
              .enabled(this.ready)
              .fontColor(this.draft.usage === 'NEGOTIABLE' ? PortraTheme.white : PortraTheme.primaryText)
              .onClick(() => this.field('usage', 'NEGOTIABLE'))
          }
          this.LongField('服务条款', this.draft.terms, '', 'terms')
          this.LongField('其他约定', this.draft.contract, '', 'contract')
          this.LongField('备注', this.draft.remark, '选填', 'remark')
        }
        .alignItems(HorizontalAlign.Start).padding({ left: 20, right: 20, top: 18, bottom: 28 })
      }.align(Alignment.TopStart).layoutWeight(1).scrollBar(BarState.Off)
      }
      if (this.errorMessage) {
        Text(this.errorMessage).fontSize(12).fontColor(PortraTheme.danger).padding({ left: 20, right: 20 })
      }
      Row() {
        Button(this.busy ? '正在保存' : this.quoteId > 0 ? '保存修改' : '发送报价')
          .enabled(!this.busy && this.ready).height(48).width('100%').borderRadius(6).onClick(() => this.save())
      }.width('100%').padding({ left: 20, right: 20, top: 10, bottom: 16 })
      }.width('100%').height('100%').backgroundColor(PortraTheme.pageBackground)
      if (this.confirmDiscard) {
        Column() {
          Blank().layoutWeight(1)
          Column({ space: 14 }) {
            Text('放弃本次修改？').fontSize(17).fontWeight(FontWeight.Bold)
            Row({ space: 12 }) {
              Button('继续编辑').onClick(() => this.confirmDiscard = false)
              Button('保存草稿').onClick(() => {
                if (this.userId > 0) QuoteDraftStore.write(this.userId, this.conversationId, this.quoteId, this.draft);
                this.onBack?.();
              })
              Button('放弃修改').onClick(() => {
                this.finished = true;
                QuoteDraftStore.clear(this.userId, this.conversationId, this.quoteId);
                this.onBack?.();
              })
            }
          }.width('100%').padding(20).backgroundColor(PortraTheme.surface).borderRadius(8)
        }.width('100%').height('100%').backgroundColor('#66000000')
      }
    }.width('100%').height('100%')
  }
}
