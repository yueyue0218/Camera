import { image } from '@kit.ImageKit';
import { PhotoAuthorizationFileSummary, PhotoAuthorizationSummary } from '../../model/ApiModels';
import { PortraTheme } from '../../theme/PortraTheme';
import { AftercarePolicy } from './AftercarePolicy';

@Component
export struct PhotoAuthorizationEventCard {
  @Prop authorization: PhotoAuthorizationSummary;
  @Prop actorId: number;
  @Prop thumbnails: Map<number, image.PixelMap>;
  onOpen?: () => void;

  build() {
    Column({ space: 10 }) {
      Row() {
        Text('照片展示申请').fontSize(14).fontWeight(FontWeight.Bold)
          .fontColor(PortraTheme.primaryText).layoutWeight(1)
        Text(AftercarePolicy.authorizationStatus(this.authorization, this.actorId))
          .fontSize(11).fontColor(PortraTheme.primary)
      }.width('100%')
      Row({ space: 6 }) {
        ForEach(this.authorization.files.slice(0, 3), (file: PhotoAuthorizationFileSummary) => {
          if (this.thumbnails.has(file.fileId)) {
            Image(this.thumbnails.get(file.fileId)!)
              .width(48).height(48).objectFit(ImageFit.Contain).borderRadius(4)
          }
        }, (file: PhotoAuthorizationFileSummary) => file.fileId.toString())
        Text(`${this.authorization.files.length} 张照片`).fontSize(12)
          .fontColor(PortraTheme.secondaryText).margin({ left: 4 })
      }.width('100%')
      Text('查看申请  ›').fontSize(12).fontColor(PortraTheme.primary)
    }
    .width('100%').alignItems(HorizontalAlign.Start).padding(12)
    .backgroundColor(PortraTheme.surface).borderRadius(6)
    .border({ width: 1, color: PortraTheme.border })
    .onClick(() => this.onOpen?.())
  }
}
