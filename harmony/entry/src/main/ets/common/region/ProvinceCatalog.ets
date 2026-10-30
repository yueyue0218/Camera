export class ProvinceOption {
  code: string; prefix: string; name: string; aliases: string[];
  constructor(code: string, prefix: string, name: string, aliases: string[]) {
    this.code = code; this.prefix = prefix; this.name = name; this.aliases = aliases;
  }
}

/** Fixed province catalogue; aliases are compatibility data, never menu entries. */
export class ProvinceCatalog {
  static readonly all: ProvinceOption[] = [
    new ProvinceOption('BJ', '11', '北京市', ["北京"]),
    new ProvinceOption('TJ', '12', '天津市', ["天津"]),
    new ProvinceOption('HE', '13', '河北省', ["河北", "石家庄", "唐山", "保定"]),
    new ProvinceOption('SX', '14', '山西省', ["山西", "太原", "大同"]),
    new ProvinceOption('NM', '15', '内蒙古自治区', ["内蒙古", "呼和浩特", "包头"]),
    new ProvinceOption('LN', '21', '辽宁省', ["辽宁", "沈阳", "大连"]),
    new ProvinceOption('JL', '22', '吉林省', ["吉林", "长春", "吉林市"]),
    new ProvinceOption('HL', '23', '黑龙江省', ["黑龙江", "哈尔滨"]),
    new ProvinceOption('SH', '31', '上海市', ["上海"]),
    new ProvinceOption('JS', '32', '江苏省', ["江苏", "南京", "苏州", "无锡", "常州", "镇江", "扬州", "泰州", "南通", "盐城", "淮安", "宿迁", "徐州", "连云港", "NJ"]),
    new ProvinceOption('ZJ', '33', '浙江省', ["浙江", "杭州", "宁波", "温州", "嘉兴", "湖州", "绍兴", "金华", "衢州", "舟山", "台州", "丽水"]),
    new ProvinceOption('AH', '34', '安徽省', ["安徽", "合肥", "芜湖"]),
    new ProvinceOption('FJ', '35', '福建省', ["福建", "福州", "厦门", "泉州"]),
    new ProvinceOption('JX', '36', '江西省', ["江西", "南昌", "九江"]),
    new ProvinceOption('SD', '37', '山东省', ["山东", "济南", "青岛", "烟台"]),
    new ProvinceOption('HA', '41', '河南省', ["河南", "郑州", "洛阳"]),
    new ProvinceOption('HB', '42', '湖北省', ["湖北", "武汉", "宜昌"]),
    new ProvinceOption('HN', '43', '湖南省', ["湖南", "长沙", "株洲", "湘潭"]),
    new ProvinceOption('GD', '44', '广东省', ["广东", "广州", "深圳", "珠海", "佛山", "东莞", "中山", "惠州"]),
    new ProvinceOption('GX', '45', '广西壮族自治区', ["广西", "南宁", "桂林", "柳州"]),
    new ProvinceOption('HI', '46', '海南省', ["海南", "海口", "三亚"]),
    new ProvinceOption('CQ', '50', '重庆市', ["重庆"]),
    new ProvinceOption('SC', '51', '四川省', ["四川", "成都", "绵阳"]),
    new ProvinceOption('GZ', '52', '贵州省', ["贵州", "贵阳", "遵义"]),
    new ProvinceOption('YN', '53', '云南省', ["云南", "昆明", "大理", "丽江"]),
    new ProvinceOption('XZ', '54', '西藏自治区', ["西藏", "拉萨"]),
    new ProvinceOption('SN', '61', '陕西省', ["陕西", "西安", "咸阳"]),
    new ProvinceOption('GS', '62', '甘肃省', ["甘肃", "兰州"]),
    new ProvinceOption('QH', '63', '青海省', ["青海", "西宁"]),
    new ProvinceOption('NX', '64', '宁夏回族自治区', ["宁夏", "银川"]),
    new ProvinceOption('XJ', '65', '新疆维吾尔自治区', ["新疆", "乌鲁木齐"]),
    new ProvinceOption('TW', '71', '台湾省', ["台湾", "台北"]),
    new ProvinceOption('HK', '81', '香港特别行政区', ["香港"]),
    new ProvinceOption('MO', '82', '澳门特别行政区', ["澳门"]),
  ];
  static normalize(value: string): string {
    const text = value.trim();
    const match = ProvinceCatalog.all.find((p: ProvinceOption) => p.code === text.toUpperCase() || p.name === text ||
      (/^\d{6}$/.test(text) && text.startsWith(p.prefix)) ||
      p.aliases.some((alias: string) => alias === text || (alias + '市') === text));
    return match?.name ?? '';
  }
}
