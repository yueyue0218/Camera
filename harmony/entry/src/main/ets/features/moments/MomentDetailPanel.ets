import { InlineImagePolicy } from '../../common/components/ComponentPolicy';
import { PortraLoading } from '../../common/components/PortraLoading';
import { MomentSummary } from '../../model/ApiModels';
import { PortraTheme } from '../../theme/PortraTheme';
import { MomentFeedFormatter } from './MomentFeedModels';
import { MomentInteractionSnapshot } from './MomentInteractions';

@Component
export struct MomentDetailPanel {
  @Prop @Watch('onStateChanged') state: MomentInteractionSnapshot = new MomentInteractionSnapshot();
  @State private imageIndex: number = 0;
  @State private imageFailed: boolean = false;
  private lastTargetId: number = 0;
  onClose?: () => void;
  onRetry?: () => void;
  onRequireLogin?: () => void;
  onToggleLike?: (item: MomentSummary) => void;
  onOpenAuthor?: (item: MomentSummary) => void;

  aboutToAppear(): void {
    this.onStateChanged();
  }

  private onStateChanged(): void {
    if (this.lastTargetId !== this.state.targetId) {
      this.imageIndex = 0;
      this.lastTargetId = this.state.targetId;
    }
    this.imageIndex = Math.max(0, Math.min(this.imageIndex, this.state.images.length - 1));
    this.imageFailed = false;
  }

  private moveImage(offset: number): void {
    this.imageIndex = Math.max(0, Math.min(this.imageIndex + offset, this.state.images.length - 1));
    this.imageFailed = false;
  }

  private toggleLike(): void {
    if (this.state.item !== undefined) {
      this.onToggleLike?.(this.state.item);
    }
  }

  private openAuthor(): void {
    if (this.state.item !== undefined) {
      this.onOpenAuthor?.(this.state.item);
    }
  }

  build() {
    Column({ space: PortraTheme.spacingMd }) {
      Row() {
        Text('动态详情')
          .fontSize(PortraTheme.fontTitle)
          .fontWeight(FontWeight.Bold)
          .fontColor(PortraTheme.primaryText)
        Blank()
        Button('关闭详情')
          .fontSize(PortraTheme.fontBodySmall)
          .fontColor(PortraTheme.primary)
          .backgroundColor(PortraTheme.primarySoft)
          .onClick(() => this.onClose?.())
      }
      .width('100%')

      if (this.state.loading) {
        PortraLoading({ label: '正在读取完整动态' })
      } else {
        Scroll() {
          Column({ space: PortraTheme.spacingMd }) {
            if (this.state.message.length > 0) {
              Text(this.state.message)
                .width('100%')
                .fontSize(PortraTheme.fontBodySmall)
                .fontColor(PortraTheme.danger)
              Button(this.state.authenticationRequired ? '去登录' : '重新读取详情')
                .enabled(this.state.likeBusyId === 0)
                .onClick(() => this.state.authenticationRequired ? this.onRequireLogin?.() : this.onRetry?.())
            }
            if (this.state.item !== undefined) {
              Text(MomentFeedFormatter.title(this.state.item))
                .width('100%')
                .fontSize(PortraTheme.fontTitle)
                .fontWeight(FontWeight.Bold)
                .fontColor(PortraTheme.primaryText)
              Text(`${MomentFeedFormatter.author(this.state.item)} · ${MomentFeedFormatter.time(this.state.item.createdAt)}`)
                .width('100%')
                .fontSize(PortraTheme.fontBodySmall)
                .fontColor(PortraTheme.secondaryText)
              Text(MomentFeedFormatter.content(this.state.item))
                .width('100%')
                .fontSize(PortraTheme.fontBody)
                .fontColor(PortraTheme.primaryText)
              if (this.onOpenAuthor !== undefined) {
                Button('查看作者主页')
                  .enabled(this.state.likeBusyId === 0)
                  .fontColor(PortraTheme.primary)
                  .backgroundColor(PortraTheme.primarySoft)
                  .onClick(() => this.openAuthor())
              }
              if (this.state.images.length > 0) {
                Stack() {
                  if (!this.imageFailed && InlineImagePolicy.accepts(this.state.images[this.imageIndex])) {
                    Image(this.state.images[this.imageIndex])
                      .width('100%')
                      .height(300)
                      .objectFit(ImageFit.Contain)
                      .accessibilityText(`动态完整图片，第 ${this.imageIndex + 1} 张，共 ${this.state.images.length} 张`)
                      .onError(() => this.imageFailed = true)
                  } else {
                    Text('该图片暂不可用')
                      .fontColor(PortraTheme.secondaryText)
                  }
                }
                .width('100%')
                .height(300)
                .backgroundColor(PortraTheme.surface)
                Row({ space: PortraTheme.spacingSm }) {
                  Button('上一张')
                    .enabled(this.imageIndex > 0)
                    .onClick(() => this.moveImage(-1))
                  Text(`${this.imageIndex + 1} / ${this.state.images.length}`)
                    .layoutWeight(1)
                    .textAlign(TextAlign.Center)
                    .fontColor(PortraTheme.primaryText)
                  Button('下一张')
                    .enabled(this.imageIndex + 1 < this.state.images.length)
                    .onClick(() => this.moveImage(1))
                }
                .width('100%')
              } else {
                Text('该动态没有图片')
                  .fontColor(PortraTheme.secondaryText)
              }
              if (MomentFeedFormatter.mentions(this.state.item).length > 0) {
                Text(MomentFeedFormatter.mentions(this.state.item))
                  .width('100%')
                  .fontColor(PortraTheme.primary)
              }
              Button(this.state.likeBusyId !== 0 ? '处理中' :
                `${this.state.item.likedByCurrentUser ? '已赞' : '点赞'} ${this.state.item.likeCount}`)
                .enabled(this.state.likeBusyId === 0 && this.state.uncertainMomentId !== this.state.targetId)
                .fontColor(PortraTheme.primary)
                .backgroundColor(PortraTheme.primarySoft)
                .onClick(() => this.toggleLike())
            }
          }
          .width('100%')
          .alignItems(HorizontalAlign.Start)
          .padding({ bottom: PortraTheme.spacing2Xl })
        }
        .width('100%')
        .layoutWeight(1)
      }
    }
    .width('100%')
    .height('100%')
    .padding(PortraTheme.spacingLg)
    .backgroundColor(PortraTheme.pageBackground)
  }
}
