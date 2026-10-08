import { AppClient } from '../app/AppClient';
import { PortraPageHeading } from '../common/components/PortraPageHeading';
import { CreateDemandPayload } from '../model/ApiModels';
import { PortraError } from '../network/ErrorMapper';
import { PortraTheme } from '../theme/PortraTheme';

@Component
export struct PublishPage {
  @State private title: string = '';
  @State private city: string = '';
  @State private place: string = '';
  @State private description: string = '';
  @State private minBudget: string = '';
  @State private maxBudget: string = '';
  @State private time: string = '';
  @State private submitting: boolean = false;
  @State private errorMessage: string = '';
  private readonly appClient: AppClient = AppClient.shared;
  onBack?: () => void;
  onPublished?: (demandId: number) => void;

  private parseBudget(value: string): number | undefined {
    if (value.trim().length === 0) {
      return undefined;
    }
    const amount = Number(value.trim());
    const cents = Math.round(amount * 100);
    return Number.isFinite(amount) && amount >= 0 && Number.isSafeInteger(cents) &&
      cents <= 2147483647 ? cents : undefined;
  }

  private async publish(): Promise<void> {
    if (this.submitting) {
      return;
    }
    const min = this.parseBudget(this.minBudget);
    const max = this.parseBudget(this.maxBudget);
    if (!this.title.trim() || !this.city.trim() || !this.place.trim() || !this.time.trim()) {
      this.errorMessage = '请填写标题、城市、地点和时间';
      return;
    }
    if ((this.minBudget.trim() && min === undefined) || (this.maxBudget.trim() && max === undefined) ||
      (min !== undefined && max !== undefined && min > max)) {
      this.errorMessage = '请检查预算金额';
      return;
    }
    const payload: CreateDemandPayload = {
      scene: this.title.trim(), cityCode: this.city.trim(), location: this.place.trim(),
      timeDescription: this.time.trim(), description: this.description.trim(),
      budgetMinCent: min, budgetMaxCent: max
    };
    this.submitting = true;
    this.errorMessage = '';
    try {
      const demand = await this.appClient.apiService.createDemand(payload);
      if (!Number.isSafeInteger(demand.demandId) || demand.demandId <= 0) {
        throw new Error('发布结果缺少需求编号');
      }
      this.onPublished?.(demand.demandId);
    } catch (error) {
      this.errorMessage = (error as PortraError).message || '发布失败，请重试';
    } finally {
      this.submitting = false;
    }
  }

  @Builder
  private SectionTitle(number: string, title: string) {
    Row({ space: 9 }) {
      Text(number)
        .fontSize(11)
        .fontColor(PortraTheme.primary)
        .fontWeight(FontWeight.Bold)
      Text(title)
        .fontSize(17)
        .fontWeight(FontWeight.Bold)
        .fontColor(PortraTheme.primaryText)
    }
    .width('100%')
    .padding({ top: 6, bottom: 6 })
  }

  @Builder
  private FieldLabel(label: string) {
    Text(label)
      .fontSize(12)
      .fontColor(PortraTheme.secondaryText)
      .width('100%')
  }

  build() {
    Column() {
      PortraPageHeading({ title: '发布需求', eyebrow: 'CREATE / REQUEST', onBack: this.onBack })
      Scroll() {
        Column({ space: 16 }) {
          Column({ space: 6 }) {
            Text('一次好拍摄，从想法开始')
              .fontSize(21)
              .fontWeight(FontWeight.Bold)
              .fontColor(PortraTheme.primaryText)
            Text('把时间、地点和期待的画面说清楚。')
              .fontSize(13)
              .fontColor(PortraTheme.secondaryText)
          }
          .width('100%')
          .alignItems(HorizontalAlign.Start)
          .padding({ bottom: 4 })

          this.SectionTitle('01', '基础信息')
          Column({ space: 9 }) {
            this.FieldLabel('拍摄主题')
            TextInput({ text: this.title, placeholder: '例如：想拍一组毕业照' })
              .height(48)
              .backgroundColor(PortraTheme.surface)
              .border({ width: 1, color: PortraTheme.border })
              .borderRadius(8)
              .padding({ left: 14, right: 14 })
              .onChange((value: string) => this.title = value)
            this.FieldLabel('城市')
            TextInput({ text: this.city, placeholder: '填写拍摄城市' })
              .height(48)
              .backgroundColor(PortraTheme.surface)
              .border({ width: 1, color: PortraTheme.border })
              .borderRadius(8)
              .padding({ left: 14, right: 14 })
              .onChange((value: string) => this.city = value)
            this.FieldLabel('具体地点')
            TextInput({ text: this.place, placeholder: '例如：学校、街区或公园' })
              .height(48)
              .backgroundColor(PortraTheme.surface)
              .border({ width: 1, color: PortraTheme.border })
              .borderRadius(8)
              .padding({ left: 14, right: 14 })
              .onChange((value: string) => this.place = value)
          }
          .width('100%')

          this.SectionTitle('02', '拍摄想法')
          Column({ space: 9 }) {
            this.FieldLabel('补充说明')
            TextArea({ text: this.description, placeholder: '氛围、人数、服装或其他想法' })
              .height(112)
              .backgroundColor(PortraTheme.surface)
              .border({ width: 1, color: PortraTheme.border })
              .borderRadius(8)
              .padding(14)
              .onChange((value: string) => this.description = value)
          }
          .width('100%')

          this.SectionTitle('03', '预算与时间')
          Row({ space: 10 }) {
            Column({ space: 8 }) {
              this.FieldLabel('预算下限（元）')
              TextInput({ text: this.minBudget, placeholder: '最低预算' })
                .type(InputType.Number)
                .height(48)
                .backgroundColor(PortraTheme.surface)
                .border({ width: 1, color: PortraTheme.border })
                .borderRadius(8)
                .padding({ left: 14, right: 14 })
                .onChange((value: string) => this.minBudget = value)
            }
            .layoutWeight(1)
            Column({ space: 8 }) {
              this.FieldLabel('预算上限（元）')
              TextInput({ text: this.maxBudget, placeholder: '最高预算' })
                .type(InputType.Number)
                .height(48)
                .backgroundColor(PortraTheme.surface)
                .border({ width: 1, color: PortraTheme.border })
                .borderRadius(8)
                .padding({ left: 14, right: 14 })
                .onChange((value: string) => this.maxBudget = value)
            }
            .layoutWeight(1)
          }
          .width('100%')
          Column({ space: 9 }) {
            this.FieldLabel('拍摄时间')
            TextInput({ text: this.time, placeholder: '例如：本周六下午 / 时间可协商' })
              .height(48)
              .backgroundColor(PortraTheme.surface)
              .border({ width: 1, color: PortraTheme.border })
              .borderRadius(8)
              .padding({ left: 14, right: 14 })
              .onChange((value: string) => this.time = value)
          }
          .width('100%')

          this.SectionTitle('04', '参考风格')
          Column() {
            Text('暂无参考图')
              .fontSize(12)
              .fontColor(PortraTheme.secondaryText)
          }
          .width(108)
          .height(98)
          .justifyContent(FlexAlign.Center)
          .backgroundColor(PortraTheme.pageBackgroundDeep)
          .borderRadius(8)

          Text('内容不会在离开页面后保存')
            .fontSize(11)
            .fontColor(PortraTheme.mutedText)
            .width('100%')
            .margin({ top: 8 })
        }
        .width('100%')
        .alignItems(HorizontalAlign.Start)
        .padding({ left: 20, right: 20, top: 18, bottom: 28 })
      }
      .layoutWeight(1)
      .scrollBar(BarState.Off)

      Column({ space: 6 }) {
        if (this.errorMessage.length > 0) {
          Text(this.errorMessage).fontSize(12).fontColor(PortraTheme.danger).width('100%')
        }
        Button(this.submitting ? '发布中…' : '发布需求')
          .width('100%')
          .height(48)
          .fontSize(15)
          .fontColor(PortraTheme.white)
          .backgroundColor(PortraTheme.primary)
          .enabled(!this.submitting)
          .borderRadius(8)
          .onClick(() => this.publish())
      }
      .width('100%')
      .padding({ left: 20, right: 20, top: 12, bottom: 20 })
      .backgroundColor(PortraTheme.surface)
    }
    .width('100%')
    .height('100%')
    .backgroundColor(PortraTheme.pageBackground)
  }
}
