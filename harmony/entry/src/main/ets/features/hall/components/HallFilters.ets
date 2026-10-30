import { promptAction } from '@kit.ArkUI';
import { LocationFailure, ProvinceLocation } from '../../../common/location/ProvinceLocation';
import { common } from '@kit.AbilityKit';
import { HallChannel } from '../HallUiModels';
import { HallFilterState } from '../HallFilterState';
import { HallFilterOption, HallFilterOptions } from '../HallFilterOptions';
import { PortraTheme } from '../../../theme/PortraTheme';

@Component
export struct HallFilters {
  @Prop @Watch('close') channel: HallChannel = HallChannel.SHOWCASES;
  @Prop filters: HallFilterState = new HallFilterState();
  @Prop cities: string[] = [];
  @Prop styles: string[] = [];
  onChange?: (value: HallFilterState) => void;
  @State private openField: number = -1;
  @State private dateOptions: HallFilterOption[] = [];
  private readonly labels: string[] = ['地区', '风格', '价格', '时间'];

  @State private locating: boolean = false;
  private locationGeneration: number = 0;
  aboutToDisappear(): void { this.locationGeneration++; }
  private async locate(usePermissionSettings: boolean = false): Promise<void> {
    if (this.locating) { return; }
    const generation = ++this.locationGeneration;
    const channel = this.channel;
    const filters = this.filters;
    this.locating = true;
    try {
      const context = this.getUIContext().getHostContext() as common.UIAbilityContext;
      if (usePermissionSettings) { await ProvinceLocation.authorizeOnSettings(context); }
      const region = await ProvinceLocation.locate(context);
      if (generation !== this.locationGeneration || channel !== this.channel || filters !== this.filters) { return; }
      const next = this.filters.copy(); next.city = region.province;
      this.onChange?.(next); this.close();
    } catch (error) {
      if (generation === this.locationGeneration) { this.showLocationFailure(error); }
    } finally { this.locating = false; }
  }
  private showLocationFailure(error: Object): void {
    const failure = error as LocationFailure;
    if (failure instanceof LocationFailure && failure.permissionSettingsRequired) {
      AlertDialog.show({ title: '允许大致位置权限',
        message: '系统不再弹出首次授权窗口。你可以在接下来的系统权限设置中允许大致位置；拒绝后仍可手动选择地区。',
        primaryButton: { value: '手动选择', action: () => {} },
        secondaryButton: { value: '权限设置', action: () => this.locate(true) } });
    } else if (failure instanceof LocationFailure && failure.phase === 'switch') {
      AlertDialog.show({ title: '开启系统位置服务',
        message: '应用的位置权限与手机的位置服务总开关相互独立。请在手机系统设置中找到“位置”或“定位服务”并自行开启，返回后再次点击定位；也可继续手动选择。',
        primaryButton: { value: '继续手动选择', action: () => {} },
        secondaryButton: { value: '知道了', action: () => {} } });
    } else { promptAction.showToast({ message: failure.message || '定位失败，可手动选择' }); }
  }
  private confirmLocation(): void {
    if (this.locating) { return; }
    if (ProvinceLocation.authorized(this.getUIContext().getHostContext() as common.UIAbilityContext)) {
      this.locate(); return;
    }
    AlertDialog.show({ title: '使用当前位置筛选',
      message: '将申请前台大致位置权限，并由系统解析省级地区。Portra 不上传或保存精确坐标，不将定位结果公开到个人资料；你也可以手动选择。',
      primaryButton: { value: '手动选择', action: () => {} },
      secondaryButton: { value: '同意并定位', action: () => this.locate() } });
  }
  private close(): void { this.openField = -1; }
  private toggle(field: number): void {
    this.dateOptions = HallFilterOptions.dates();
    this.openField = this.openField === field ? -1 : field;
  }
  private options(field: number): HallFilterOption[] {
    if (field === 0) { return HallFilterOptions.cities(this.cities); }
    if (field === 1) { return HallFilterOptions.styles(this.styles); }
    if (field === 2) { return HallFilterOptions.prices(); }
    return this.dateOptions;
  }
  private selected(field: number, option: HallFilterOption): boolean {
    if (field === 0) { return this.filters.city === option.value; }
    if (field === 1) { return this.filters.style === option.value; }
    if (field === 2) { return this.filters.minYuan === option.min && this.filters.maxYuan === option.max; }
    return this.filters.date === option.value;
  }
  private active(field: number): boolean {
    if (field === 0) { return this.filters.city.length > 0; }
    if (field === 1) { return this.filters.style.length > 0; }
    if (field === 2) { return this.filters.minYuan.length > 0 || this.filters.maxYuan.length > 0; }
    return this.filters.date.length > 0;
  }
  @Builder
  private Menu(field: number) {
    Column() {
      Scroll() {
        Column() {
          ForEach(this.options(field), (option: HallFilterOption) => {
            Button(`${option.label}${this.selected(field, option) ? '  ✓' : ''}`)
              .width('100%').constraintSize({ minHeight: 44 }).fontSize(14)
              .fontColor(this.selected(field, option) ? PortraTheme.primary : PortraTheme.primaryText)
              .backgroundColor(this.selected(field, option) ? PortraTheme.primarySoft : Color.Transparent)
              .borderRadius(8)
              .onClick(() => { this.close(); this.onChange?.(HallFilterOptions.choose(this.filters, field, option)); })
          }, (option: HallFilterOption) => option.value)
        }.width('100%')
      }.constraintSize({ maxHeight: 280 }).width('100%').scrollBar(BarState.Auto)
      if (field === 0) {
        Row() {
          Button({ type: ButtonType.Normal }) {
            Text(this.locating ? '正在获取地区…' : '定位当前地区')
              .fontSize(14).fontColor(PortraTheme.primary).width(152).height(38)
              .textAlign(TextAlign.Center).backgroundColor(PortraTheme.primarySoft).borderRadius(19)
          }.width(160).height(48).padding(0).backgroundColor(Color.Transparent)
            .enabled(!this.locating).onClick(() => this.confirmLocation())
        }.width('100%').justifyContent(FlexAlign.Center).margin({ top: 4, bottom: 4 })
      }
      Divider().color(PortraTheme.border)
      Button('重置全部筛选').width('100%').height(44).fontSize(12)
        .fontColor(PortraTheme.secondaryText).backgroundColor(Color.Transparent)
        .onClick(() => { this.close(); this.onChange?.(new HallFilterState()); })
    }.width(220).constraintSize({ maxWidth: '90%' }).padding(8).backgroundColor(PortraTheme.surface)
  }
  build() {
    Row({ space: 4 }) {
      ForEach(this.labels, (label: string, index: number) => {
        Button(`${label}${this.active(index) ? ' ·' : ''} ${this.openField === index ? '▴' : '▾'}`)
          .layoutWeight(1).height(32).padding(0).fontSize(PortraTheme.fontBodySmall)
          .fontColor(this.active(index) || this.openField === index ? PortraTheme.primary : PortraTheme.secondaryText)
          .backgroundColor(this.active(index) ? PortraTheme.primarySoft : PortraTheme.surface)
          .borderRadius(PortraTheme.radiusPill)
          .onClick(() => this.toggle(index))
          .bindMenu(this.openField === index, this.Menu(index), { placement: Placement.Bottom,
            onDisappear: () => { if (this.openField === index) { this.close(); } } })
      })
    }.width('100%').height(32).flexShrink(0).alignItems(VerticalAlign.Center).clip(true)
  }
}
