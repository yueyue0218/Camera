import { DemandSummary, ServicePackageSummary } from '../../../model/ApiModels';
import { PortraAvatar } from '../../../common/components/PortraAvatar';
import { PortraImage } from '../../../common/components/PortraImage';
import { PortraTheme } from '../../../theme/PortraTheme';
import { HallTextFormatter } from '../HallUiModels';

@Component
export struct PortraPublishBanner {
  @Prop role: string = '';
  @Prop roleLoading: boolean = false;
  @Prop roleError: string = '';
  onPublish?: () => void;
  onRetryRole?: () => void;

  build() {
    Column() {
      if (this.roleLoading) {
        Text('正在确认当前身份')
          .width('100%').fontSize(PortraTheme.fontHero).fontWeight(FontWeight.Bold).fontColor('#18150D')
        Text('正在同步账号权限，请稍候')
          .width('100%').fontSize(PortraTheme.fontBodySmall).fontColor('#776525')
          .margin({ top: PortraTheme.spacingXs })
        Button('确认中…').height(36).enabled(false).margin({ top: PortraTheme.spacingMd })
      } else if (this.roleError.length > 0) {
        Text('暂时无法确认身份')
          .width('100%').fontSize(PortraTheme.fontHero).fontWeight(FontWeight.Bold).fontColor('#18150D')
        Text(this.roleError)
          .width('100%').fontSize(PortraTheme.fontBodySmall).fontColor('#776525')
          .margin({ top: PortraTheme.spacingXs }).maxLines(2)
        Button('重试读取身份')
          .height(36).padding({ left: 15, right: 15 }).fontSize(13)
          .fontColor(PortraTheme.white).backgroundColor(PortraTheme.primary)
          .borderRadius(PortraTheme.radiusPill).margin({ top: PortraTheme.spacingMd })
          .alignSelf(ItemAlign.Start).onClick(() => this.onRetryRole?.())
      } else {
        Text(this.role === 'PROVIDER' ? '展示作品，开始接单' : this.role === 'CUSTOMER' ? '想拍，现在就开始' : '登录，开启拍摄之旅')
          .width('100%').fontSize(PortraTheme.fontHero).fontWeight(FontWeight.Bold)
          .fontColor('#18150D').maxLines(2)
        Text(this.role === 'PROVIDER' ? '发布摄影橱窗，让约拍用户找到你' : this.role === 'CUSTOMER' ? '找到合适的摄影师，分享你的拍摄灵感' : '登录后确认身份，继续浏览公开内容')
          .width('100%').fontSize(PortraTheme.fontBodySmall).fontColor('#776525')
          .margin({ top: PortraTheme.spacingXs }).maxLines(2)
        Button(this.role === 'PROVIDER' ? '发布摄影橱窗' : this.role === 'CUSTOMER' ? '发布拍摄需求' : '登录后发布')
          .height(36).padding({ left: 15, right: 15 }).fontSize(13).fontWeight(FontWeight.Medium)
          .fontColor(PortraTheme.white).backgroundColor(PortraTheme.primary)
          .borderRadius(PortraTheme.radiusPill).margin({ top: PortraTheme.spacingMd })
          .alignSelf(ItemAlign.Start).onClick(() => this.onPublish?.())
      }
    }
    .width('100%')
    .constraintSize({ minHeight: 132 })
    .padding(PortraTheme.spacingXl)
    .justifyContent(FlexAlign.Center)
    .alignItems(HorizontalAlign.Start)
    .backgroundColor('#F2CF58')
    .borderRadius(PortraTheme.radiusLg)
    .border({ width: 1, color: '#1A9A7C26' })
  }
}

@Component
export struct ShowcaseCard {
  @Prop item: ServicePackageSummary;
  onOpenAuthor?: (userId: number, role: string) => void;
  onOpen?: (serviceId: number) => void;

  private coverSource(): string {
    if ((this.item.coverImage?.trim() ?? '').length > 0) {
      return this.item.coverImage as string;
    }
    if (this.item.images !== undefined && this.item.images.length > 0) {
      return this.item.images[0];
    }
    return '';
  }

  private isFavorited(): boolean {
    return this.item.isFavorited === true || this.item.favoritedByCurrentUser === true;
  }

  build() {
    Column() {
      Stack({ alignContent: Alignment.TopStart }) {
        PortraImage({
          source: this.coverSource(),
          fileId: this.item.coverPortfolioId ?? this.item.portfolioIds?.[0] ?? 0,
          imageWidth: '100%',
          imageHeight: 190,
          cornerRadius: 0,
          fallbackText: 'PORTRA',
          contentDescription: `${HallTextFormatter.nonEmpty(this.item.title, '摄影橱窗')}封面`
        })

        Row() {
          Text(HallTextFormatter.city(this.item.cityCode))
            .fontSize(PortraTheme.fontCaption)
            .fontWeight(FontWeight.Medium)
            .fontColor(PortraTheme.white)
            .padding({ left: 9, right: 9, top: 5, bottom: 5 })
            .backgroundColor('#66211F22')
            .borderRadius(PortraTheme.radiusPill)
          Blank()
          Stack({ alignContent: Alignment.Center }) {
            Image(this.isFavorited() ? $r('app.media.ic_heart_filled') : $r('app.media.ic_heart'))
              .width(17)
              .height(17)
              .accessibilityText(this.isFavorited() ? '已收藏' : '未收藏')
          }
            .width(32)
            .height(32)
            .backgroundColor('#55211F22')
            .borderRadius(PortraTheme.radiusPill)
        }
        .width('100%')
        .padding(10)

        Row() {
          Blank()
          Text(HallTextFormatter.price(this.item.priceRange, this.item.basePriceCent))
            .fontSize(13)
            .fontWeight(FontWeight.Medium)
            .fontColor('#211B08')
            .padding({ left: 8, right: 8, top: 6, bottom: 6 })
            .backgroundColor('#F2F7C933')
            .borderRadius(PortraTheme.radiusPill)
            .constraintSize({ maxWidth: 116 })
            .maxLines(1)
            .textOverflow({ overflow: TextOverflow.Ellipsis })
        }
        .width('100%')
        .height('100%')
        .padding(10)
        .alignItems(VerticalAlign.Bottom)
      }
      .width('100%')
      .height(190)

      Column({ space: PortraTheme.spacingSm }) {
        Text(HallTextFormatter.nonEmpty(this.item.title, '摄影橱窗'))
          .width('100%')
          .fontSize(PortraTheme.fontBody)
          .fontWeight(FontWeight.Medium)
          .fontColor(PortraTheme.primaryText)
          .maxLines(2)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
        Row({ space: 7 }) {
          PortraAvatar({
            source: this.item.photographerAvatarUrl ?? '',
            fileId: this.item.photographerAvatarFileId ?? 0,
            displayName: this.item.photographerNickname ?? '',
            avatarSize: 26
          })
          Text(HallTextFormatter.nonEmpty(this.item.photographerNickname, '摄影师'))
            .layoutWeight(1)
            .fontSize(PortraTheme.fontBodySmall)
            .fontColor(PortraTheme.secondaryText)
            .maxLines(1)
            .textOverflow({ overflow: TextOverflow.Ellipsis })
        }
        .onTouch((event: TouchEvent) => event.stopPropagation())
        .onClick(() => { const id = this.item.providerId ?? this.item.photographerId ?? 0; if (id > 0) { this.onOpenAuthor?.(id, 'PROVIDER'); } })
        .width('100%')
        .padding({ top: 6 })
        .border({ width: { top: 1 }, color: '#13211F24' })
      }
      .width('100%')
      .constraintSize({ minHeight: 78 })
      .padding({ left: 10, right: 10, top: 10, bottom: 9 })
      .alignItems(HorizontalAlign.Start)
    }
    .width('100%')
    .backgroundColor(PortraTheme.surface)
    .borderRadius(20)
    .clip(true)
    .border({ width: 1, color: PortraTheme.border })
    .shadow({ radius: 12, color: '#12512D2A', offsetY: 5 })
    .onClick(() => this.onOpen?.(this.item.serviceId))
  }
}

@Component
export struct DemandCard {
  @Prop item: DemandSummary;
  onOpenAuthor?: (userId: number, role: string) => void;
  onOpen?: (demandId: number) => void;

  private firstUrl(values: (string | undefined)[]): string {
    for (let index = 0; index < values.length; index += 1) {
      const value = values[index]?.trim() ?? '';
      if (value.length > 0) {
        return value;
      }
    }
    return '';
  }

  private coverSource(): string {
    return this.firstUrl([
      this.item.imageUrl,
      this.item.coverUrl,
      this.item.thumbnailUrl,
      this.item.referenceImageUrl,
      this.item.referenceImages?.[0],
      this.item.images?.[0],
      this.item.attachmentUrls?.[0],
      this.item.referencePreviewUrls?.[0]
    ]);
  }

  private avatarSource(): string {
    return this.firstUrl([this.item.customerAvatarUrl, this.item.customerAvatar]);
  }

  build() {
    Row() {
      PortraImage({
        source: this.coverSource(),
        fileId: this.item.referenceFileIds?.[0] ?? 0,
        imageWidth: 108,
        imageHeight: 148,
        cornerRadius: 0,
        fallbackText: '暂无参考图',
        contentDescription: `${HallTextFormatter.nonEmpty(this.item.scene, '约拍需求')}参考图`
      })
      .width(108)
      .height(148)

      Column({ space: 7 }) {
        Row({ space: 7 }) {
          PortraAvatar({
            source: this.avatarSource(),
            fileId: this.item.customerAvatarFileId ?? 0,
            displayName: this.item.customerNickname ?? '',
            avatarSize: 24
          })
          Text(HallTextFormatter.nonEmpty(this.item.customerNickname, '约拍用户'))
            .layoutWeight(1)
            .fontSize(PortraTheme.fontBodySmall)
            .fontColor(PortraTheme.secondaryText)
            .maxLines(1)
            .textOverflow({ overflow: TextOverflow.Ellipsis })
          Text(HallTextFormatter.budget(this.item.budgetMinCent, this.item.budgetMaxCent))
            .fontSize(PortraTheme.fontCaption)
            .fontWeight(FontWeight.Medium)
            .fontColor(PortraTheme.primary)
            .constraintSize({ maxWidth: 96 })
            .maxLines(1)
            .textOverflow({ overflow: TextOverflow.Ellipsis })
            .padding({ left: 6, right: 6, top: 4, bottom: 4 })
            .backgroundColor(PortraTheme.accentSoft)
            .borderRadius(PortraTheme.spacingSm)
        }
        .onTouch((event: TouchEvent) => event.stopPropagation())
        .onClick(() => { if ((this.item.customerId ?? 0) > 0) { this.onOpenAuthor?.(this.item.customerId as number, 'CUSTOMER'); } })
        .width('100%')
        Text(HallTextFormatter.nonEmpty(this.item.scene, '拍摄需求'))
          .width('100%')
          .fontSize(15)
          .fontWeight(FontWeight.Medium)
          .fontColor(PortraTheme.primaryText)
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
        Text(HallTextFormatter.city(this.item.cityCode))
          .width('100%')
          .fontSize(PortraTheme.fontCaption)
          .fontColor(PortraTheme.secondaryText)
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
        Text(HallTextFormatter.nonEmpty(this.item.description, '发布者暂未填写需求说明'))
          .width('100%')
          .fontSize(PortraTheme.fontCaption)
          .fontColor(PortraTheme.secondaryText)
          .maxLines(2)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
      }
      .layoutWeight(1)
      .padding(PortraTheme.spacingMd)
      .alignItems(HorizontalAlign.Start)
    }
    .width('100%')
    .height(148)
    .backgroundColor(PortraTheme.surface)
    .borderRadius(PortraTheme.radiusMd)
    .clip(true)
    .border({ width: 1, color: PortraTheme.border })
    .onClick(() => this.onOpen?.(this.item.demandId))
  }
}
