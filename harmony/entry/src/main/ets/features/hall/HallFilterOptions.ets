import { HallFilterState } from './HallFilterState';
import { ProvinceCatalog, ProvinceOption } from '../../common/region/ProvinceCatalog';

export class HallFilterOption {
  label: string;
  value: string;
  min: string;
  max: string;
  constructor(label: string, value: string, min: string = '', max: string = '') {
    this.label = label; this.value = value; this.min = min; this.max = max;
  }
}

export class HallFilterOptions {
  static cities(_observed: string[] = []): HallFilterOption[] {
    return [new HallFilterOption('不限地区', ''), ...ProvinceCatalog.all.map((p: ProvinceOption) => new HallFilterOption(p.name, p.code))];
  }
  static cityLabel(value: string): string { return ProvinceCatalog.display(value); }
  static styleLabel(value: string): string { return value; }
  static styles(_tags: string[] = []): HallFilterOption[] {
    const presets: string[] = ['日系清新', '胶片复古', '情绪人像', '自然光', '校园写真',
      '韩系写真', '港风复古', '电影感', '法式浪漫', '森系写真', '街头纪实', '氛围感', '清冷风', '甜美少女', '古风汉服'];
    return [new HallFilterOption('不限风格', ''), ...presets.map((tag: string) => new HallFilterOption(tag, tag))];
  }

  static prices(): HallFilterOption[] {
    return [new HallFilterOption('不限价格', ''),
      new HallFilterOption('100 元以下', 'under100', '', '99.99'),
      new HallFilterOption('100～300 元', '100to300', '100', '300'),
      new HallFilterOption('300～500 元', '300to500', '300', '500'),
      new HallFilterOption('500～1000 元', '500to1000', '500', '1000'),
      new HallFilterOption('1000 元以上', 'over1000', '1000', '')];
  }

  static dates(now: Date = new Date()): HallFilterOption[] {
    const result: HallFilterOption[] = [new HallFilterOption('不限时间', '')];
    for (let offset = 0; offset < 14; offset++) {
      const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset, 12);
      const value = `${day.getFullYear()}-${(day.getMonth() + 1).toString().padStart(2, '0')}-${day.getDate().toString().padStart(2, '0')}`;
      result.push(new HallFilterOption(`${offset === 0 ? '今天 · ' : offset === 1 ? '明天 · ' : ''}${value}`, value));
    }
    return result;
  }

  static choose(current: HallFilterState, field: number, option: HallFilterOption): HallFilterState {
    const next = current.copy();
    if (field === 0) { next.city = option.value; }
    if (field === 1) { next.style = option.value; }
    if (field === 2) { next.minYuan = option.min; next.maxYuan = option.max; }
    if (field === 3) { next.date = option.value; }
    return next;
  }
}
