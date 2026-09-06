import { AvatarFallbackPolicy } from './ComponentPolicy';
import { PortraImage } from './PortraImage';

@Component
export struct PortraAvatar {
  @Prop source: ResourceStr = '';
  @Prop displayName: string = '';
  @Prop size: number = 48;

  build() {
    PortraImage({
      source: this.source,
      imageWidth: this.size,
      imageHeight: this.size,
      cornerRadius: this.size / 2,
      fallbackText: AvatarFallbackPolicy.label(this.displayName),
      contentDescription: this.displayName.length > 0 ? `${this.displayName}的头像` : '用户头像'
    })
  }
}
