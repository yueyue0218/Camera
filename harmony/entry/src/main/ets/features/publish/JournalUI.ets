import { PortraAvatar } from '../../common/components/PortraAvatar';

export class JournalStyle {
  static readonly paper: string = '#F6F3EE';
  static readonly ink: string = '#26262A';
  static readonly blue: string = '#1735B9';
  static readonly line: string = '#E5DED6';
  static readonly muted: string = '#9A938C';
  static readonly surface: string = '#FFFDF9';
}

@Component
export struct JournalHeading {
  @Prop title: string = '';
  @Prop draft: boolean = false;
  onBack?: () => void;
  onDraft?: () => void;
  build() {
    Row({ space: 4 }) {
      Button('←').width(44).height(44).fontSize(24).fontColor(JournalStyle.ink)
        .backgroundColor(Color.Transparent).accessibilityText('返回').onClick(() => this.onBack?.())
      Text(this.title).layoutWeight(1).fontSize(15).fontWeight(FontWeight.Bold)
        .fontColor(JournalStyle.ink).textAlign(TextAlign.Center).maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis })
      if (this.draft) {
        Button('存草稿').width(64).height(44).padding(0).fontSize(12).fontColor(JournalStyle.blue)
          .backgroundColor(Color.Transparent).onClick(() => this.onDraft?.())
      } else { Blank().width(44) }
    }.width('100%').height(58).padding({ left: 13, right: 13 })
      .border({ width: { bottom: 1 }, color: JournalStyle.line }).backgroundColor(JournalStyle.paper)
  }
}

@Component
export struct JournalKicker {
  @Prop label: string = '镜头档案';
  @Prop right: string = 'PHOTOGRAPHY';
  build() {
    Row() {
      Text(`PORTRA / ${this.label}`).fontColor(JournalStyle.blue).fontSize(10).fontWeight(FontWeight.Bold)
      Blank()
      Text(this.right).fontSize(10).fontColor('#8A847E').letterSpacing(1)
    }.width('100%').padding({ top: 18, bottom: 12, left: 19, right: 19 })
  }
}

@Component
export struct JournalTitle {
  @Prop title: string = '';
  @Prop subtitle: string = '';
  @Prop service: boolean = true;
  build() {
    Column({ space: 7 }) {
      Text(this.service ? 'THE PHOTO JOURNAL' : 'THE SHOOT REQUEST')
        .fontSize(10).fontWeight(FontWeight.Bold).letterSpacing(1.6).fontColor(JournalStyle.blue)
      Text(this.title).fontSize(25).fontWeight(FontWeight.Bold).fontColor(JournalStyle.ink).lineHeight(34)
      if (this.subtitle) { Text(this.subtitle).fontSize(12.5).lineHeight(22).fontColor('#76716C').margin({ top: 3 }) }
    }.width('100%').alignItems(HorizontalAlign.Start).padding({ top: 20, left: 18, right: 18 })
  }
}

@Component
export struct JournalFacts {
  @Prop city: string = '';
  @Prop middleLabel: string = '拍摄风格';
  @Prop middle: string = '';
  @Prop price: string = '';
  @Prop service: boolean = true;
  @Builder
  private Cell(label: string, value: string, price: boolean) {
    Column({ space: 4 }) {
      Text(label).fontSize(10).fontColor(JournalStyle.muted)
      Text(value || '待沟通').fontSize(price ? 14 : 12).fontWeight(FontWeight.Bold)
        .fontColor(price ? JournalStyle.blue : '#343331').maxLines(2)
    }.layoutWeight(1).alignItems(HorizontalAlign.Start).padding({ left: 8, right: 8 })
  }
  build() {
    Row() {
      this.Cell('拍摄城市', this.city, false)
      Divider().vertical(true).height(34).color(JournalStyle.line)
      this.Cell(this.middleLabel, this.middle, false)
      Divider().vertical(true).height(34).color(JournalStyle.line)
      this.Cell(this.service ? '参考起价' : '预算范围', this.price, true)
    }.width('100%').padding({ top: 14, bottom: 14 }).margin({ top: 18 })
      .border({ width: { top: 1, bottom: 1 }, color: JournalStyle.line })
  }
}

@Component
export struct JournalBrief {
  @Prop styles: string = '';
  @Prop place: string = '';
  @Prop people: string = '';
  @Prop description: string = '';
  @Builder
  private Cell(label: string, value: string, weight: number) {
    Column({ space: 5 }) {
      Text(label).fontSize(10).fontColor(JournalStyle.muted)
      Text(value).fontSize(11.5).fontWeight(FontWeight.Bold).fontColor('#36332F').lineHeight(18)
    }.layoutWeight(weight).alignItems(HorizontalAlign.Start).padding({ left: 7, right: 7 })
  }
  build() {
    Column({ space: 14 }) {
      Row() {
        this.Cell('需求风格', this.styles || '待沟通', 1.23)
        Divider().vertical(true).height(36).color(JournalStyle.line)
        this.Cell('拍摄地点', this.place || '待沟通', 1)
        Divider().vertical(true).height(36).color(JournalStyle.line)
        this.Cell('参与人数', this.people || '未说明', 0.62)
      }.width('100%')
      Divider().color(JournalStyle.line)
      Column({ space: 5 }) {
        Text('需求说明').fontSize(10).fontColor(JournalStyle.muted)
        Text(this.description || '暂无需求说明').fontSize(12.5).lineHeight(23).fontColor('#66615D')
      }.width('100%').alignItems(HorizontalAlign.Start)
    }.width('100%').padding(15).margin({ top: 16 }).backgroundColor(JournalStyle.surface)
      .borderRadius(17).border({ width: 1, color: JournalStyle.line })
  }
}

@Component
export struct JournalPerson {
  @Prop name: string = '';
  @Prop avatar: number = 0;
  @Prop service: boolean = true;
  onOpen?: () => void;
  build() {
    Row({ space: 11 }) {
      PortraAvatar({ fileId: this.avatar, displayName: this.name, avatarSize: 46 })
      Column({ space: 4 }) {
        Text(this.name || '未填写昵称').fontSize(14).fontWeight(FontWeight.Bold).fontColor(JournalStyle.ink)
        Text(this.service ? '摄影师 · 个人主页' : '需求方 · 个人主页').fontSize(10.5).fontColor(JournalStyle.muted)
      }.layoutWeight(1).alignItems(HorizontalAlign.Start)
      Button('去主页 ↗').fontSize(11).padding(0).height(44).fontColor(JournalStyle.blue)
        .backgroundColor(Color.Transparent).onClick(() => this.onOpen?.())
    }.width('100%').padding(12).borderRadius(16).border({ width: 1, color: JournalStyle.line })
      .backgroundColor(JournalStyle.surface).margin({ top: 16, bottom: 22 })
  }
}

@Component
export struct JournalSection {
  @Prop title: string = '';
  @Prop caption: string = '';
  build() {
    Row() {
      Text(this.title).fontSize(18).fontWeight(FontWeight.Bold).fontColor(JournalStyle.ink)
      Blank()
      Text(this.caption).fontSize(10).fontColor(JournalStyle.muted)
    }.width('100%').margin({ top: 16, bottom: 12 })
  }
}

@Component
export struct JournalRow {
  @Prop label: string = '';
  @Prop value: string = '';
  build() {
    Row({ space: 12 }) {
      Text(this.label).width(70).fontSize(12).fontColor(JournalStyle.muted)
      Text(this.value || '待沟通').layoutWeight(1).fontSize(12).lineHeight(19).fontColor('#49443F').textAlign(TextAlign.End)
    }.width('100%').padding({ top: 14, bottom: 14 }).border({ width: { bottom: 0.5 }, color: JournalStyle.line })
  }
}

@Component
export struct JournalActions {
  @Prop price: string = '';
  @Prop service: boolean = true;
  @Prop selected: boolean = false;
  @Prop actionsEnabled: boolean = true;
  @Prop notice: string = '';
  onStar?: () => void;
  onChat?: () => void;
  build() {
    Column({ space: 6 }) {
      if (this.notice) { Text(this.notice).fontSize(12).fontColor('#A44532').width('100%') }
      Row({ space: 8 }) {
        Column({ space: 3 }) {
          Text(this.service ? '参考价格' : '预算范围').fontSize(10).fontColor(JournalStyle.muted)
          Text(this.price).fontSize(this.service ? 21 : 18).fontWeight(FontWeight.Bold).fontColor(JournalStyle.blue)
            .maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis })
        }.constraintSize({ maxWidth: '40%' }).alignItems(HorizontalAlign.Start)
        Button({ type: ButtonType.Normal }) {
          Path().commands('M13 3 L16.1 9.3 L23 10.3 L18 15.2 L19.2 22.2 L13 18.9 L6.8 22.2 L8 15.2 L3 10.3 L9.9 9.3 Z')
            .width(26).height(26).fill(this.selected ? '#F5C522' : Color.Transparent)
            .stroke(this.selected ? Color.Transparent : '#35353A').strokeWidth(this.selected ? 0 : 1.65)
        }.width(38).height(46).padding(0).backgroundColor(Color.Transparent).borderRadius(0)
          .accessibilityText(this.selected ? '移出我的意向' : '加入我的意向').enabled(this.actionsEnabled).onClick(() => this.onStar?.())
        Button(this.service ? '和摄影师聊聊' : '和需求方聊聊').layoutWeight(1).height(46).padding({ left: 7, right: 7 })
          .fontSize(12).fontWeight(FontWeight.Bold).fontColor(Color.White).backgroundColor(JournalStyle.blue).borderRadius(13)
          .enabled(this.actionsEnabled).onClick(() => this.onChat?.())
      }.width('100%')
    }.width('100%').padding({ left: 14, right: 14, top: 11, bottom: 15 })
      .border({ width: { top: 1 }, color: JournalStyle.line }).backgroundColor(JournalStyle.surface)
  }
}
