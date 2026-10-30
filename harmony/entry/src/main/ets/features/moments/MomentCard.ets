import { MomentAuthor } from './MomentAuthor';
import { PortraImage } from '../../common/components/PortraImage';
import { MomentSummary } from '../../model/ApiModels';
import { MomentFeedFormatter } from './MomentFeedModels';
import { MomentActionButton } from './MomentActionButton';

// Web MomentCard / feed.css mobile layout, with native touch targets.
@Component
export struct MomentCard {
  @Prop item: MomentSummary;
  @Prop favoriteBusy: boolean = false;
  @Prop detailDisabled: boolean = false;
  @Prop interactionsDisabled: boolean = false;
  @Prop reportAllowed: boolean = false;
  @Prop likeBusy: boolean = false;
  @Prop likeUncertain: boolean = false;
  onToggleFavorite?: (item: MomentSummary) => void;
  onToggleLike?: (item: MomentSummary) => void;
  onOpenDetail?: (item: MomentSummary) => void;
  onOpenAuthor?: (item: MomentSummary) => void;
  onRequestReport?: (item: MomentSummary) => void;

  private imageSource(): string {
    const images = MomentFeedFormatter.images(this.item);
    return images.length > 0 ? images[0] : '';
  }

  private imageCount(): number {
    return MomentFeedFormatter.images(this.item).length;
  }

  build() {
    Column() {
      Column({ space: 8 }) {
        Row() {
          Text(`No. ${this.item.momentId.toString().padStart(6, '0')}`)
            .fontSize(10).letterSpacing(1).fontColor('#67615A')
          Blank()
          Text('PORTRA FILE')
            .fontSize(10).letterSpacing(1).fontWeight(FontWeight.Bold).fontColor('#2864C5')
            .fontWeight(FontWeight.Medium)
        }.width('100%')
        MomentAuthor({ item: this.item,
          disabled: this.interactionsDisabled || this.likeBusy || this.favoriteBusy, onOpenAuthor: this.onOpenAuthor })
      }
      .width('100%').padding({ left: 14, right: 14, top: 12, bottom: 10 })
      .alignItems(HorizontalAlign.Start).backgroundColor('#FBF7EF')
      .border({ width: { bottom: 1 }, color: '#E8E2DB' })

      Column({ space: 10 }) {
        Text(MomentFeedFormatter.title(this.item))
          .width('100%').fontSize(20).fontWeight(FontWeight.Bold).fontColor('#242529')
          .maxLines(2).textOverflow({ overflow: TextOverflow.Ellipsis })
          .onClick(() => { if (!this.detailDisabled && !this.likeBusy && !this.favoriteBusy) { this.onOpenDetail?.(this.item); } })
        Text(MomentFeedFormatter.content(this.item))
          .width('100%').fontSize(14).fontColor('#4D4943').lineHeight(22)
          .maxLines(3).textOverflow({ overflow: TextOverflow.Ellipsis })

        Stack({ alignContent: Alignment.BottomEnd }) {
          if (this.imageSource().length > 0) {
            PortraImage({ source: this.imageSource(), imageWidth: '100%', imageHeight: '100%',
              cornerRadius: 8, fallbackText: '动态图片暂不可用',
              contentDescription: `${MomentFeedFormatter.title(this.item)}图片`, allowInlineData: true })
          } else {
            Column({ space: 8 }) {
              Text('PORTRA FILE').fontSize(10).letterSpacing(2).fontColor('#B8B6AE')
              Text('暂无图片').fontSize(15).fontColor('#E8E5DD')
            }.width('100%').height('100%').justifyContent(FlexAlign.Center)
          }
          if (this.imageCount() > 1) {
            Text(`预览 ${this.imageCount()} 张`)
              .fontSize(11).fontColor(Color.White).padding(7).margin(10)
              .backgroundColor('#AA242529').borderRadius(4)
          }
        }
        .width('100%').aspectRatio(4 / 3).backgroundColor('#0E0F0C').borderRadius(8).clip(true)
        .accessibilityText(`打开动态 ${this.item.momentId} 的全屏图片`)
        .onClick(() => { if (!this.detailDisabled && !this.likeBusy && !this.favoriteBusy) { this.onOpenDetail?.(this.item); } })

        if (MomentFeedFormatter.mentions(this.item).length > 0) {
          Text(MomentFeedFormatter.mentions(this.item))
            .width('100%').fontSize(12).fontColor('#1746C5').maxLines(2)
            .textOverflow({ overflow: TextOverflow.Ellipsis })
        }
        Row({ space: 14 }) {
          MomentActionButton({ action: 'like', selected: this.item.likedByCurrentUser, count: this.item.likeCount,
            momentId: this.item.momentId, busy: this.likeBusy,
            disabled: this.likeUncertain || this.interactionsDisabled, interactive: this.onToggleLike !== undefined,
            onToggle: () => this.onToggleLike?.(this.item) })
          MomentActionButton({ action: 'favorite', selected: this.item.favoritedByCurrentUser,
            count: this.item.favoriteCount, momentId: this.item.momentId, busy: this.favoriteBusy,
            disabled: this.interactionsDisabled, interactive: this.onToggleFavorite !== undefined,
            onToggle: () => this.onToggleFavorite?.(this.item) })
          Blank()
          if (this.reportAllowed && this.onRequestReport !== undefined) {
            Button('举报').constraintSize({ minHeight: 44, minWidth: 44 })
              .padding({ left: 6, right: 6 }).fontSize(12).fontColor('#67615A')
              .backgroundColor(Color.Transparent).enabled(!this.interactionsDisabled)
              .accessibilityText(`举报动态 ${this.item.momentId}`)
              .onClick(() => this.onRequestReport?.(this.item))
          }
        }.width('100%')
      }
      .width('100%').padding({ left: 15, right: 15, top: 12, bottom: 8 })
      .alignItems(HorizontalAlign.Start)
    }
    .width('100%').alignItems(HorizontalAlign.Start).backgroundColor('#FBF7EF')
    .borderRadius(14).clip(true).border({ width: 1, color: '#E5DDD2' })
  }
}
