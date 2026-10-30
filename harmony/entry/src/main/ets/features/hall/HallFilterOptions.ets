import { HallFilterState } from './HallFilterState';
import { HallTextFormatter } from './HallUiModels';

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
  // Keep legacy region codes; city names are exact backend values, not province aliases.
  static cities(observed: string[]): HallFilterOption[] {
    const options: HallFilterOption[] = [new HallFilterOption('不限地区', ''),
      new HallFilterOption('北京', 'BJ'),
      new HallFilterOption('天津', 'TJ'),
      new HallFilterOption('河北', 'HE'),
      new HallFilterOption('山西', 'SX'),
      new HallFilterOption('内蒙古', 'NM'),
      new HallFilterOption('辽宁', 'LN'),
      new HallFilterOption('吉林', 'JL'),
      new HallFilterOption('黑龙江', 'HL'),
      new HallFilterOption('上海', 'SH'),
      new HallFilterOption('江苏', 'JS'),
      new HallFilterOption('浙江', 'ZJ'),
      new HallFilterOption('安徽', 'AH'),
      new HallFilterOption('福建', 'FJ'),
      new HallFilterOption('江西', 'JX'),
      new HallFilterOption('山东', 'SD'),
      new HallFilterOption('河南', 'HA'),
      new HallFilterOption('湖北', 'HB'),
      new HallFilterOption('湖南', 'HN'),
      new HallFilterOption('广东', 'GD'),
      new HallFilterOption('广西', 'GX'),
      new HallFilterOption('海南', 'HI'),
      new HallFilterOption('重庆', 'CQ'),
      new HallFilterOption('四川', 'SC'),
      new HallFilterOption('贵州', 'GZ'),
      new HallFilterOption('云南', 'YN'),
      new HallFilterOption('西藏', 'XZ'),
      new HallFilterOption('陕西', 'SN'),
      new HallFilterOption('甘肃', 'GS'),
      new HallFilterOption('青海', 'QH'),
      new HallFilterOption('宁夏', 'NX'),
      new HallFilterOption('新疆', 'XJ'),
      new HallFilterOption('香港', 'HK'),
      new HallFilterOption('澳门', 'MO'),
      new HallFilterOption('台湾', 'TW')];
    options.slice(1).forEach((option: HallFilterOption) => { option.label += '（旧地区）'; });
    ['南京', '北京', '上海', '天津', '重庆', '杭州', '苏州', '成都', '广州', '深圳', '武汉', '西安'].forEach((city: string) => {
      options.push(new HallFilterOption(city, city));
      options.push(new HallFilterOption(city + '市（城市名）', city + '市'));
    });
    ['320100', '320500', '310000', '330100'].forEach((code: string) => {
      options.push(new HallFilterOption(HallTextFormatter.city(code) + '（历史编码）', code));
    });
    observed.forEach((code: string) => {
      if (code.length > 0 && !options.some((item: HallFilterOption) => item.value === code)) {
        const label = HallTextFormatter.city(code);
        options.push(new HallFilterOption(/[\u3400-\u9fff]/.test(label) ? label : '历史地区（' + code + '）', code));
      }
    });
    return options;
  }

  static cityLabel(value: string): string {
    return HallFilterOptions.cities([value]).find((option: HallFilterOption) => option.value === value)?.label ?? value;
  }

  static styleLabel(value: string): string {
    return value === '复古港风' ? '港风复古（历史标签）' : value;
  }

  static styles(tags: string[]): HallFilterOption[] {
    // Creation DTOs accept free styleTags; both repositories match a complete tag, not an alias.
    const presets: string[] = ['日系清新', '胶片复古', '情绪人像', '自然光', '校园写真',
      '韩系写真', '港风复古', '电影感', '法式浪漫', '森系写真', '街头纪实', '氛围感',
      '清冷风', '甜美少女', '古风汉服', '日系清透', '胶片感', '毕业纪念', '复古港风', '其他'];
    const values: string[] = presets.slice();
    tags.forEach((tag: string) => {
      const value = tag.trim();
      if (value.length > 0 && !values.some((item: string) => item.toLowerCase() === value.toLowerCase())) {
        values.push(value);
      }
    });
    return [new HallFilterOption('不限风格', ''), ...values.map((tag: string) => new HallFilterOption(HallFilterOptions.styleLabel(tag), tag))];
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
