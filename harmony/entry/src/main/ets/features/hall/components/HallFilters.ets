import { HallFilters as SortFilters } from './HallControls';
import { HallChannel } from '../HallUiModels';
import { HallFilterState } from '../HallFilterState';
import { RegionControl } from '../../../common/region/RegionControl';

@Component
export struct HallFilters {
  @Prop channel: HallChannel = HallChannel.SHOWCASES;
  @Prop serviceSort: string = 'recommend';
  @Prop demandSort: string = 'latest';
  @Prop filters: HallFilterState = new HallFilterState();
  onServiceSortChange?: (sort: string) => void;
  onDemandSortChange?: (sort: string) => void;
  onChange?: (filters: HallFilterState) => void;
  build() {
    Column({ space: 6 }) {
      SortFilters({ channel: this.channel, serviceSort: this.serviceSort, demandSort: this.demandSort,
        onServiceSortChange: this.onServiceSortChange, onDemandSortChange: this.onDemandSortChange })
      RegionControl({ value: this.filters.city, allowAll: true, onChange: (code: string) => {
        const next = this.filters.copy(); next.city = code; this.onChange?.(next);
      } })
    }.width('100%')
  }
}
