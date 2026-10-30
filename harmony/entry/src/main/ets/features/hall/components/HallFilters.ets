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
