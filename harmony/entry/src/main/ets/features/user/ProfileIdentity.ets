import { PortraImage } from '../../common/components/PortraImage';

/** Shared identity presentation. Public mode accepts only public-profile fields. */
@Component
export struct ProfileIdentity {
  @Prop nickname: string = '';
  @Prop userId: number = 0;
  @Prop avatarFileId: number = 0;
  @Prop identityLine: string = '';
  @Prop showIdentityLine: boolean = true;
  @Prop bio: string = '';
  @Prop owner: boolean = false;
  @Prop creditLabel: string = '—';
  onEdit?: () => void;
  onOpenCredit?: () => void;

  build() {
    Column({ space: 0 }) {
      Row({ space: 14 }) {
        PortraImage({ fileId: this.avatarFileId, imageWidth: 76, imageHeight: 76,
          cornerRadius: 22, fallbackText: this.nickname.slice(0, 2),
          contentDescription: `${this.nickname}的头像` })
        Column({ space: 5 }) {
          Row({ space: 8 }) {
            Text(this.nickname).fontSize(20).fontWeight(FontWeight.Bold)
              .fontColor('#242529').maxLines(1).layoutWeight(1)
              .textOverflow({ overflow: TextOverflow.Ellipsis })
            if (this.owner) {
              Row({ space: 4 }) {
                Text('♢').fontSize(13).fontColor('#5E6B9F')
                Text('信用').fontSize(9.5).fontColor('#5E6B9F')
                Text(this.creditLabel).fontSize(11.5).fontWeight(FontWeight.Bold)
                  .fontColor('#1735B9')
              }.height(25).padding({ left: 7, right: 7 })
                .borderRadius(9).backgroundColor('#EEF1FF')
                .border({ width: 1, color: '#DBE1F6' })
                .onClick(() => this.onOpenCredit?.())
            }
          }.width('100%')
          Text(`UID ${this.userId}`).fontSize(10.5).fontColor('#98918B')
          if (this.showIdentityLine && this.identityLine.length > 0) {
            Text(this.identityLine).fontSize(11.5).fontColor('#68635E')
          }
        }.layoutWeight(1).alignItems(HorizontalAlign.Start)
      }.width('100%').height(76)
      if (this.bio.length > 0) {
        Text(this.bio).fontSize(12.5).lineHeight(21)
          .fontColor('#58534F').width('100%').margin({ top: 13 })
          .maxLines(2).textOverflow({ overflow: TextOverflow.Ellipsis })
      } else if (this.owner) {
        Text('还没有填写个人简介').fontSize(12.5).fontColor('#918A84')
          .margin({ top: 13 }).onClick(() => this.onEdit?.())
      }

    }.width('100%').alignItems(HorizontalAlign.Start)
      .padding({ left: 2, right: 2, top: 12 })
  }
}
