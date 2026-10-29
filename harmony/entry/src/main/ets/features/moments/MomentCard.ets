import { PortraAvatar } from '../../common/components/PortraAvatar';
import { PortraImage } from '../../common/components/PortraImage';
import { MomentSummary } from '../../model/ApiModels';
import { PortraTheme } from '../../theme/PortraTheme';
import { MomentFeedFormatter } from './MomentFeedModels';

@Component
export struct MomentCard {
  @Prop item: MomentSummary;
  @Prop favoriteBusy: boolean = false;
  onToggleFavorite?: (item: MomentSummary) => void;

  private imageSource(): string {
    const images = MomentFeedFormatter.images(this.item);
    return images.length > 0 ? images[0] : '';
  }

  private imageCount(): number {
    return MomentFeedFormatter.images(this.item).length;
  }

  build() {
    Column({ space: PortraTheme.spacingMd }) {
      Row({ space: PortraTheme.spacingMd }) {
        PortraAvatar({ displayName: MomentFeedFormatter.author(this.item), avatarSize: 40 })
        Column({ space: 3 }) {
          Text(MomentFeedFormatter.author(this.item))
            .fontSize(PortraTheme.fontBody)
            .fontWeight(FontWeight.Medium)
            .fontColor(PortraTheme.primaryText)
            .maxLines(1)
            .textOverflow({ overflow: TextOverflow.Ellipsis })
          Text(MomentFeedFormatter.time(this.item.createdAt))
            .fontSize(PortraTheme.fontCaption)
            .fontColor(PortraTheme.mutedText)
        }
        .layoutWeight(1)
        .alignItems(HorizontalAlign.Start)
        Text(`No. ${this.item.momentId}`)
          .fontSize(PortraTheme.fontCaption)
          .fontColor(PortraTheme.mutedText)
      }
      .width('100%')

      Text(MomentFeedFormatter.title(this.item))
        .width('100%')
        .fontSize(PortraTheme.fontTitle)
        .fontWeight(FontWeight.Bold)
        .fontColor(PortraTheme.primaryText)
        .maxLines(2)
        .textOverflow({ overflow: TextOverflow.Ellipsis })

      Text(MomentFeedFormatter.content(this.item))
        .width('100%')
        .fontSize(PortraTheme.fontBody)
        .fontColor(PortraTheme.secondaryText)
        .lineHeight(21)
        .maxLines(5)
        .textOverflow({ overflow: TextOverflow.Ellipsis })

      if (this.imageSource().length > 0) {
        Stack({ alignContent: Alignment.BottomEnd }) {
          PortraImage({
            source: this.imageSource(),
            imageWidth: '100%',
            imageHeight: 210,
            cornerRadius: PortraTheme.radiusMd,
            fallbackText: '动态图片暂不可用',
            contentDescription: `${MomentFeedFormatter.title(this.item)}图片`,
            allowInlineData: true
          })
          if (this.imageCount() > 1) {
            Text(`共 ${this.imageCount()} 张`)
              .fontSize(PortraTheme.fontCaption)
              .fontColor(PortraTheme.white)
              .padding({ left: 9, right: 9, top: 5, bottom: 5 })
              .margin(10)
              .backgroundColor('#88242529')
              .borderRadius(PortraTheme.radiusPill)
          }
        }
        .width('100%')
        .height(210)
      }

      if (MomentFeedFormatter.mentions(this.item).length > 0) {
        Text(MomentFeedFormatter.mentions(this.item))
          .width('100%')
          .fontSize(PortraTheme.fontBodySmall)
          .fontColor(PortraTheme.primary)
          .maxLines(2)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
      }

      Row({ space: PortraTheme.spacingXl }) {
        Text(`喜欢 ${this.item.likeCount}`)
          .fontSize(PortraTheme.fontBodySmall)
          .fontColor(this.item.likedByCurrentUser ? PortraTheme.danger : PortraTheme.secondaryText)
        if (this.onToggleFavorite !== undefined) {
          Button(this.favoriteBusy ? '处理中' :
            `${this.item.favoritedByCurrentUser ? '已收藏' : '收藏'} ${this.item.favoriteCount}`)
            .height(32)
            .fontSize(PortraTheme.fontBodySmall)
            .fontColor(this.item.favoritedByCurrentUser ? PortraTheme.primary : PortraTheme.secondaryText)
            .backgroundColor(this.item.favoritedByCurrentUser ? PortraTheme.primarySoft : Color.Transparent)
            .borderRadius(PortraTheme.radiusPill)
            .enabled(!this.favoriteBusy)
            .onClick(() => this.onToggleFavorite?.(this.item))
        } else {
          Text(`收藏 ${this.item.favoriteCount}`)
            .fontSize(PortraTheme.fontBodySmall)
            .fontColor(this.item.favoritedByCurrentUser ? PortraTheme.primary : PortraTheme.secondaryText)
        }
        Blank()
        Text(this.item.authorRole === 'PROVIDER' ? '摄影师动态' : '约拍记录')
          .fontSize(PortraTheme.fontCaption)
          .fontColor(PortraTheme.secondaryText)
          .padding({ left: 8, right: 8, top: 4, bottom: 4 })
          .backgroundColor(PortraTheme.primarySoft)
          .borderRadius(PortraTheme.radiusPill)
      }
      .width('100%')
      .padding({ top: PortraTheme.spacingSm })
      .border({ width: { top: 1 }, color: PortraTheme.border })
    }
    .width('100%')
    .padding(PortraTheme.spacingLg)
    .alignItems(HorizontalAlign.Start)
    .backgroundColor(PortraTheme.surface)
    .borderRadius(PortraTheme.radiusLg)
    .border({ width: 1, color: PortraTheme.border })
    .shadow({ radius: 10, color: '#10512D2A', offsetY: 4 })
  }
}
