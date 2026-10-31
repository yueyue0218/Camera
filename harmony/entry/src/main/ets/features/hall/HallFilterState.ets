import { ProvinceCatalog } from '../../common/region/ProvinceCatalog';
import { DemandListQuery, ServicePackageListQuery } from '../../model/ApiModels';

export class HallFilterState {
  city: string = '';
  style: string = '';
  minYuan: string = '';
  maxYuan: string = '';
  date: string = '';

  copy(): HallFilterState {
    const value = new HallFilterState();
    value.city = this.city;
    value.style = this.style;
    value.minYuan = this.minYuan;
    value.maxYuan = this.maxYuan;
    value.date = this.date;
    return value;
  }

  validate(): string {
    if (this.city && !ProvinceCatalog.code(this.city)) { return '请选择有效的省级地区'; }
    for (const amount of [this.minYuan, this.maxYuan]) {
      if (amount.length > 0 && (!/^\d+(\.\d{1,2})?$/.test(amount) ||
        Number(amount) * 100 > 2147483647)) {
        return '请输入有效金额，最多保留两位小数';
      }
    }
    if (this.minYuan.length > 0 && this.maxYuan.length > 0 && Number(this.minYuan) > Number(this.maxYuan)) {
      return '最低金额不能高于最高金额';
    }
    if (this.date.length > 0) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(this.date)) { return '日期格式为 YYYY-MM-DD'; }
      const parsed = new Date(`${this.date}T00:00:00Z`);
      if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== this.date) {
        return '请选择有效日期';
      }
    }
    return '';
  }

  private cents(value: string): number | undefined {
    return value.length === 0 ? undefined : Math.round(Number(value) * 100);
  }

  serviceQuery(page: number, size: number, seed: string): ServicePackageListQuery {
    return { page: page, size: size, sort: 'recommend', feedSeed: seed,
      cityCode: this.city ? ProvinceCatalog.requireCode(this.city) : undefined, style: this.style, minPriceCent: this.cents(this.minYuan),
      maxPriceCent: this.cents(this.maxYuan), availableDate: this.date };
  }

  demandQuery(page: number, size: number, seed: string): DemandListQuery {
    return { page: page, size: size, status: 'OPEN', sort: 'latest', feedSeed: seed,
      cityCode: this.city ? ProvinceCatalog.requireCode(this.city) : undefined, styleTag: this.style, minBudgetCent: this.cents(this.minYuan),
      maxBudgetCent: this.cents(this.maxYuan), expectedDate: this.date };
  }
}
