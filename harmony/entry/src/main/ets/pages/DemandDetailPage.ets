import { AppClient } from '../app/AppClient';
import { PortraAvatar } from '../common/components/PortraAvatar';
import { PortraErrorView } from '../common/components/PortraErrorView';
import { PortraLoading } from '../common/components/PortraLoading';
import { PortraPageHeading } from '../common/components/PortraPageHeading';
import { HallTextFormatter } from '../features/hall/HallUiModels';
import { DemandSummary } from '../model/ApiModels';
import { PortraError } from '../network/ErrorMapper';
import { PortraTheme } from '../theme/PortraTheme';

@Component
export struct DemandDetailPage {
  @Prop demandId: number = 0;
  @State private loading: boolean = true;
  @State private demand: DemandSummary | null = null;
  @State private errorMessage: string = '';
  private readonly appClient: AppClient = AppClient.shared;
  private requestVersion: number = 0;
  onBack?: () => void;

  aboutToAppear(): void {
    this.load();
  }

  aboutToDisappear(): void {
    this.requestVersion++;
    this.appClient.apiService.cancelDemandDetail();
  }

  private async load(): Promise<void> {
    const version = ++this.requestVersion;
    this.loading = true;
    this.errorMessage = '';
    try {
      const result = await this.appClient.apiService.getDemand(this.demandId);
      if (version === this.requestVersion) {
        this.demand = result;
      }
    } catch (error) {
      if (version === this.requestVersion) {
        this.errorMessage = (error as PortraError).message || '需求加载失败';
      }
    } finally {
      if (version === this.requestVersion) {
        this.loading = false;
      }
    }
  }

  @Builder
  private Fact(label: string, value: string) {
    Column({ space: 5 }) {
      Text(label).fontSize(11).fontColor(PortraTheme.secondaryText)
      Text(value)
        .fontSize(15)
        .fontWeight(FontWeight.Medium)
        .fontColor(PortraTheme.primaryText)
        .maxLines(2)
    }
    .width('48%')
    .alignItems(HorizontalAlign.Start)
    .padding({ top: 12, bottom: 12 })
  }

  build() {
    Column() {
      PortraPageHeading({ title: '需求详情', eyebrow: 'PORTRA / REQUEST', onBack: this.onBack })
      if (this.loading) {
        PortraLoading({ label: '正在加载需求' })
      } else if (this.errorMessage.length > 0) {
        PortraErrorView({ message: this.errorMessage, onRetry: () => this.load() })
      } else if (this.demand !== null) {
        Scroll() {
          Column({ space: 18 }) {
            Row({ space: 8 }) {
              Text(this.demand.status === 'OPEN' ? '开放中' : '需求进展')
                .fontSize(11)
                .fontColor(PortraTheme.primary)
                .padding({ left: 10, right: 10, top: 5, bottom: 5 })
                .backgroundColor(PortraTheme.primarySoft)
                .borderRadius(6)
              Text(`#${this.demandId}`)
                .fontSize(11)
                .fontColor(PortraTheme.mutedText)
            }
            .width('100%')

            Text(HallTextFormatter.nonEmpty(this.demand.scene, '拍摄需求'))
              .width('100%')
              .fontSize(25)
              .fontWeight(FontWeight.Bold)
              .fontColor(PortraTheme.primaryText)
            Row({ space: 9 }) {
              PortraAvatar({ displayName: this.demand.customerNickname ?? '', avatarSize: 32 })
              Text(HallTextFormatter.nonEmpty(this.demand.customerNickname, '约拍用户'))
                .fontSize(13)
                .fontColor(PortraTheme.secondaryText)
            }
            .width('100%')

            Column() {
              Row() {
                this.Fact('预算', HallTextFormatter.budget(this.demand.budgetMinCent, this.demand.budgetMaxCent))
                this.Fact('拍摄城市', HallTextFormatter.city(this.demand.cityCode))
              }
              Row() {
                this.Fact('拍摄时间', HallTextFormatter.nonEmpty(this.demand.timeDescription,
                  HallTextFormatter.nonEmpty(this.demand.expectedDate, '待沟通')))
                this.Fact('具体地点', HallTextFormatter.nonEmpty(this.demand.location, '待沟通'))
              }
            }
            .width('100%')
            .padding({ left: 16, right: 16, top: 3, bottom: 3 })
            .backgroundColor(PortraTheme.surface)
            .borderRadius(8)
            .border({ width: 1, color: PortraTheme.border })

            Column({ space: 9 }) {
              Text('需求描述').fontSize(17).fontWeight(FontWeight.Bold).fontColor(PortraTheme.primaryText)
              Text(HallTextFormatter.nonEmpty(this.demand.description, '暂无需求描述'))
                .fontSize(14)
                .fontColor(PortraTheme.secondaryText)
                .lineHeight(23)
            }
            .width('100%')
            .alignItems(HorizontalAlign.Start)
            .padding({ top: 8, bottom: 8 })

            if ((this.demand.styleTags ?? []).length > 0) {
              Column({ space: 10 }) {
                Text('拍摄偏好').fontSize(17).fontWeight(FontWeight.Bold).fontColor(PortraTheme.primaryText)
                Flex({ direction: FlexDirection.Row, wrap: FlexWrap.Wrap }) {
                  ForEach((this.demand.styleTags ?? []).slice(0, 3), (tag: string) => {
                    Text(tag)
                      .fontSize(12)
                      .fontColor(PortraTheme.primary)
                      .padding({ left: 10, right: 10, top: 6, bottom: 6 })
                      .backgroundColor(PortraTheme.primarySoft)
                      .borderRadius(6)
                      .margin({ right: 8, bottom: 8 })
                  })
                }
                .width('100%')
              }
              .width('100%')
              .alignItems(HorizontalAlign.Start)
            }

            Text('参考风格')
              .width('100%')
              .fontSize(17)
              .fontWeight(FontWeight.Bold)
              .fontColor(PortraTheme.primaryText)
            Text((this.demand.referenceFileIds ?? []).length > 0 ?
              '参考图片暂不可查看' : '暂无参考图片')
              .width('100%')
              .height(96)
              .fontSize(13)
              .fontColor(PortraTheme.secondaryText)
              .textAlign(TextAlign.Center)
              .backgroundColor(PortraTheme.pageBackgroundDeep)
              .borderRadius(8)
          }
          .width('100%')
          .padding({ left: 20, right: 20, top: 18, bottom: 28 })
          .alignItems(HorizontalAlign.Start)
        }
        .layoutWeight(1)
        .scrollBar(BarState.Off)
      }
    }
    .width('100%')
    .height('100%')
    .backgroundColor(PortraTheme.pageBackground)
  }
}
