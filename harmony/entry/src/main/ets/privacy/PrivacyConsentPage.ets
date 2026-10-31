import { PortraTheme } from '../theme/PortraTheme';
import { PortraBottomNav } from '../common/components/PortraBottomNav';
import {
  CROSS_BORDER_CONSENT_SECTIONS,
  CROSS_BORDER_CONSENT_TITLE,
  LegalDocumentKind,
  LegalSection,
  PRIVACY_POLICY_SECTIONS,
  PRIVACY_POLICY_TITLE
} from './LegalDocumentContent';

@Component
export struct PrivacyConsentPage {
  @Prop errorMessage: string = '';
  @State private privacyAccepted: boolean = false;
  @State private crossBorderAccepted: boolean = false;
  @State private activeDocument: LegalDocumentKind = LegalDocumentKind.NONE;
  onAccept?: () => void;
  onDecline?: () => void;
  onOpenPrivacyRights?: () => void;

  private canAccept(): boolean {
    return this.privacyAccepted && this.crossBorderAccepted;
  }

  private documentTitle(): string {
    return this.activeDocument === LegalDocumentKind.PRIVACY_POLICY ?
      PRIVACY_POLICY_TITLE : CROSS_BORDER_CONSENT_TITLE;
  }

  private documentSections(): LegalSection[] {
    return this.activeDocument === LegalDocumentKind.PRIVACY_POLICY ?
      PRIVACY_POLICY_SECTIONS : CROSS_BORDER_CONSENT_SECTIONS;
  }

  @Builder
  private ConsentChoice(label: string, documentTitle: string, selected: boolean,
    onSelectionChange: (selected: boolean) => void, onOpenDocument: () => void) {
    Row({ space: 12 }) {
      Checkbox({ name: label, group: 'portra-legal-consent' })
        .width(20)
        .height(20)
        .shape(CheckBoxShape.CIRCLE)
        .select(selected)
        .selectedColor(PortraTheme.primary)
        .onChange((value: boolean) => onSelectionChange(value))
        .accessibilityText(label)

      Column({ space: 5 }) {
        Text(label)
          .width('100%')
          .fontSize(13)
          .fontColor(PortraTheme.primaryText)

        Text(documentTitle)
          .width('100%')
          .fontSize(13)
          .fontWeight(FontWeight.Medium)
          .fontColor(PortraTheme.primary)
          .onClick(() => onOpenDocument())
          .accessibilityText(`查看${documentTitle}`)
      }
      .layoutWeight(1)
      .alignItems(HorizontalAlign.Start)
    }
    .width('100%')
    .padding({ top: 4, bottom: 4 })
    .alignItems(VerticalAlign.Center)
  }

  @Builder
  private ConsentOverview() {
    Scroll() {
      Column() {
        Text('PORTRA')
          .width('100%')
          .fontSize(16)
          .fontWeight(FontWeight.Bold)
          .fontColor(PortraTheme.primary)
          .margin({ top: 24 })

        Row()
          .width(36)
          .height(4)
          .alignSelf(ItemAlign.Start)
          .backgroundColor(PortraTheme.accent)
          .margin({ top: 7, bottom: 18 })

        Text('欢迎使用 Portra')
          .width('100%')
          .fontSize(23)
          .fontWeight(FontWeight.Bold)
          .fontColor(PortraTheme.primaryText)

        Text('请先了解我们如何处理和跨境存储您的信息')
          .width('100%')
          .fontSize(13)
          .lineHeight(20)
          .fontColor(PortraTheme.secondaryText)
          .margin({ top: 10 })

        Column({ space: 8 }) {
          Text('同意前的保护')
            .width('100%')
            .fontSize(13)
            .fontWeight(FontWeight.Bold)
            .fontColor(PortraTheme.primaryText)
          Text('不会新建设备标识，也不会发起大厅、消息和约拍等业务请求。您主动进入个人信息权利申请渠道时，仅进行必要的身份核验和申请处理。')
            .width('100%')
            .fontSize(12)
            .lineHeight(19)
            .fontColor(PortraTheme.secondaryText)
        }
        .width('100%')
        .margin({ top: 18 })

        Text('请分别确认以下两项')
          .width('100%')
          .fontSize(14)
          .fontWeight(FontWeight.Medium)
          .fontColor(PortraTheme.primaryText)
          .margin({ top: 20, bottom: 12 })

        Column({ space: 12 }) {
          this.ConsentChoice(
            '我已阅读并同意',
            '《Portra 隐私政策》',
            this.privacyAccepted,
            (selected: boolean) => this.privacyAccepted = selected,
            () => this.activeDocument = LegalDocumentKind.PRIVACY_POLICY
          )

          this.ConsentChoice(
            '我单独同意个人信息传输和存储至中国香港',
            '《个人信息出境单独同意书》',
            this.crossBorderAccepted,
            (selected: boolean) => this.crossBorderAccepted = selected,
            () => this.activeDocument = LegalDocumentKind.CROSS_BORDER_CONSENT
          )
        }
        .width('100%')

        if (this.errorMessage.length > 0) {
          Text(this.errorMessage)
            .width('100%')
            .fontSize(13)
            .lineHeight(20)
            .fontColor(PortraTheme.danger)
            .margin({ top: 14 })
        }

        Button('同意并继续')
          .width('100%')
          .height(44)
          .fontSize(16)
          .fontWeight(FontWeight.Medium)
          .fontColor(PortraTheme.white)
          .backgroundColor(this.canAccept() ? PortraTheme.primary : '#CECBC7')
          .borderRadius(PortraTheme.radius)
          .enabled(this.canAccept())
          .margin({ top: 20 })
          .onClick(() => {
            if (this.canAccept()) {
              this.onAccept?.();
            }
          })

        Button('不同意并退出')
          .width('100%')
          .height(40)
          .fontSize(14)
          .fontColor(PortraTheme.primaryText)
          .backgroundColor(Color.Transparent)
          .margin({ top: 6, bottom: 8 })
          .onClick(() => this.onDecline?.())

        Button('个人信息权利申请与联系渠道')
          .width('100%').height(44).fontSize(13).fontColor(PortraTheme.primary)
          .backgroundColor(Color.Transparent).onClick(() => this.onOpenPrivacyRights?.())
          .margin({ bottom: 20 })
      }
      .width('100%')
      .padding({ left: 24, right: 24 })
      .alignItems(HorizontalAlign.Start)
    }
    .width('86%')
    .constraintSize({ maxWidth: 420 })
    .height('84%')
    .scrollBar(BarState.Auto)
    .backgroundColor(PortraTheme.surface)
    .borderRadius(20)
    .clip(true)
    .accessibilityGroup(true)
    .accessibilityText('隐私授权弹窗，请分别确认以下两项')
  }

  // Presentation only: do not mount HallPage or start business requests before consent.
  @Builder
  private HallBackdrop() {
    Column() {
      Row() {
        Column({ space: 6 }) {
          Text('PORTRA').fontSize(24).fontWeight(FontWeight.Bold).fontColor(PortraTheme.primary)
          Row().width(36).height(4).backgroundColor(PortraTheme.accent)
        }.alignItems(HorizontalAlign.Start)
        Blank()
        Image($r('app.media.ic_search')).width(24).height(24).margin({ right: 20 })
        Image($r('app.media.ic_bell')).width(24).height(24)
      }.width('100%').padding({ left: 20, right: 20, top: 24, bottom: 24 })
      Row({ space: 28 }) {
        Column({ space: 8 }) {
          Text('摄影橱窗').fontSize(18).fontWeight(FontWeight.Bold).fontColor(PortraTheme.primaryText)
          Row().width(24).height(3).backgroundColor(PortraTheme.primary).borderRadius(2)
        }
        Text('约拍需求').fontSize(18).fontColor(PortraTheme.secondaryText)
      }.width('100%').padding({ left: 20, bottom: 12 })
      Column({ space: 14 }) {
        ForEach([0, 1, 2], (row: number) => {
          Row({ space: 12 }) {
            this.SkeletonCard()
            this.SkeletonCard()
          }.width('100%')
        }, (row: number) => row.toString())
      }.width('100%').layoutWeight(1).padding({ left: 16, right: 16 }).clip(true)
      PortraBottomNav({ selectedIndex: 0 })
    }
    .width('100%').height('100%').backgroundColor(PortraTheme.pageBackground)
    .hitTestBehavior(HitTestMode.None)
    .accessibilityLevel('no-hide-descendants')
  }

  @Builder
  private SkeletonCard() {
    Column({ space: 10 }) {
      Row().width('100%').height(118).backgroundColor(PortraTheme.pageBackgroundDeep)
      Row().width('80%').height(12).backgroundColor(PortraTheme.pageBackgroundDeep).borderRadius(4)
      Row().width('56%').height(10).backgroundColor(PortraTheme.pageBackgroundDeep).borderRadius(4)
    }.layoutWeight(1).padding({ bottom: 14 }).alignItems(HorizontalAlign.Start)
    .backgroundColor(PortraTheme.surface).borderRadius(12).clip(true)
  }

  @Builder
  private DocumentView() {
    Column() {
      Row({ space: 12 }) {
        Button('‹')
          .width(40)
          .height(40)
          .fontSize(27)
          .fontColor(PortraTheme.primaryText)
          .backgroundColor(Color.Transparent)
          .accessibilityText('返回同意页面')
          .onClick(() => this.activeDocument = LegalDocumentKind.NONE)

        Text(this.documentTitle())
          .layoutWeight(1)
          .fontSize(18)
          .fontWeight(FontWeight.Bold)
          .fontColor(PortraTheme.primaryText)
      }
      .width('100%')
      .height(64)
      .padding({ left: 12, right: 20 })
      .backgroundColor(PortraTheme.surface)
      .border({ width: { bottom: 1 }, color: PortraTheme.border })

      Scroll() {
        Column({ space: 22 }) {
          ForEach(this.documentSections(), (section: LegalSection) => {
            Column({ space: 8 }) {
              Text(section.title)
                .width('100%')
                .fontSize(16)
                .fontWeight(FontWeight.Bold)
                .fontColor(PortraTheme.primaryText)

              Text(section.body)
                .width('100%')
                .fontSize(13)
                .lineHeight(22)
                .fontColor(PortraTheme.secondaryText)
            }
            .width('100%')
            .alignItems(HorizontalAlign.Start)
          }, (section: LegalSection) => section.title)

          Button('阅读完成，返回')
            .width('100%')
            .height(48)
            .fontSize(15)
            .fontColor(PortraTheme.white)
            .backgroundColor(PortraTheme.primary)
            .borderRadius(PortraTheme.radius)
            .margin({ top: 8, bottom: 32 })
            .onClick(() => this.activeDocument = LegalDocumentKind.NONE)
        }
        .width('100%')
        .padding({ left: 24, right: 24, top: 24 })
        .alignItems(HorizontalAlign.Start)
      }
      .layoutWeight(1)
      .scrollBar(BarState.Auto)
    }
    .width('100%')
    .height('100%')
    .backgroundColor(PortraTheme.pageBackground)
  }

  build() {
    if (this.activeDocument === LegalDocumentKind.NONE) {
      Stack({ alignContent: Alignment.Center }) {
        this.HallBackdrop()
        Row().width('100%').height('100%').backgroundColor('#99000000')
          .hitTestBehavior(HitTestMode.Block)
        this.ConsentOverview()
      }.width('100%').height('100%')
    } else {
      this.DocumentView()
    }
  }
}
