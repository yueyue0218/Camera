package com.action.camera.common.region;

import com.action.camera.common.exception.BusinessException;
import com.action.camera.common.ErrorCode;
import java.util.*;

/** Generated catalogue. Empty and unknown remain distinct at API boundaries. */
public final class ProvinceNames {
    private ProvinceNames() {}
    public record Province(String code, String prefix, String name, List<String> aliases) {}
    public static final List<Province> ALL = List.of(
        new Province("BJ", "11", "北京市", List.of("北京", "PEK", "BEIJING")),
        new Province("TJ", "12", "天津市", List.of("天津")),
        new Province("HE", "13", "河北省", List.of("河北", "石家庄", "唐山", "保定", "石家庄市", "唐山市", "保定市")),
        new Province("SX", "14", "山西省", List.of("山西", "太原", "大同", "太原市", "大同市")),
        new Province("NM", "15", "内蒙古自治区", List.of("内蒙古", "呼和浩特", "包头", "呼和浩特市", "包头市")),
        new Province("LN", "21", "辽宁省", List.of("辽宁", "沈阳", "大连", "沈阳市", "大连市")),
        new Province("JL", "22", "吉林省", List.of("吉林", "长春", "长春市")),
        new Province("HL", "23", "黑龙江省", List.of("黑龙江", "哈尔滨", "哈尔滨市")),
        new Province("SH", "31", "上海市", List.of("上海", "SHA", "SHANGHAI")),
        new Province("JS", "32", "江苏省", List.of("江苏", "南京", "苏州", "无锡", "常州", "镇江", "扬州", "泰州", "南通", "盐城", "淮安", "宿迁", "徐州", "连云港", "NJ", "连云港市", "南京市", "苏州市", "无锡市", "常州市", "镇江市", "扬州市", "泰州市", "南通市", "盐城市", "淮安市", "宿迁市", "徐州市", "NKG", "NANJING", "JIANGSU")),
        new Province("ZJ", "33", "浙江省", List.of("浙江", "杭州", "宁波", "温州", "嘉兴", "湖州", "绍兴", "金华", "衢州", "舟山", "台州", "丽水", "杭州市", "宁波市", "温州市", "嘉兴市", "湖州市", "绍兴市", "金华市", "衢州市", "舟山市", "台州市", "丽水市", "ZHEJIANG")),
        new Province("AH", "34", "安徽省", List.of("安徽", "合肥", "芜湖", "合肥市", "芜湖市")),
        new Province("FJ", "35", "福建省", List.of("福建", "福州", "厦门", "泉州", "厦门市")),
        new Province("JX", "36", "江西省", List.of("江西", "南昌", "九江", "南昌市", "九江市")),
        new Province("SD", "37", "山东省", List.of("山东", "济南", "青岛", "烟台", "济南市", "青岛市", "烟台市")),
        new Province("HA", "41", "河南省", List.of("河南", "郑州", "洛阳", "洛阳市")),
        new Province("HB", "42", "湖北省", List.of("湖北", "武汉", "宜昌", "武汉市", "宜昌市")),
        new Province("HN", "43", "湖南省", List.of("湖南", "长沙", "株洲", "湘潭", "长沙市", "株洲市", "湘潭市")),
        new Province("GD", "44", "广东省", List.of("广东", "广州", "深圳", "珠海", "佛山", "东莞", "中山", "惠州", "广州市", "深圳市", "珠海市", "佛山市", "东莞市", "中山市", "惠州市", "GUANGDONG")),
        new Province("GX", "45", "广西壮族自治区", List.of("广西", "南宁", "桂林", "柳州", "南宁市", "桂林市")),
        new Province("HI", "46", "海南省", List.of("海南", "海口", "三亚", "海口市", "三亚市")),
        new Province("CQ", "50", "重庆市", List.of("重庆")),
        new Province("SC", "51", "四川省", List.of("四川", "成都", "绵阳", "成都市", "绵阳市")),
        new Province("GZ", "52", "贵州省", List.of("贵州", "贵阳", "遵义", "贵阳市", "遵义市")),
        new Province("YN", "53", "云南省", List.of("云南", "昆明", "大理", "丽江", "昆明市", "大理市", "丽江市")),
        new Province("XZ", "54", "西藏自治区", List.of("西藏", "拉萨", "拉萨市")),
        new Province("SN", "61", "陕西省", List.of("陕西", "西安", "咸阳", "西安市", "咸阳市")),
        new Province("GS", "62", "甘肃省", List.of("甘肃", "兰州")),
        new Province("QH", "63", "青海省", List.of("青海", "西宁", "西宁市")),
        new Province("NX", "64", "宁夏回族自治区", List.of("宁夏", "银川", "银川市")),
        new Province("XJ", "65", "新疆维吾尔自治区", List.of("新疆", "乌鲁木齐", "乌鲁木齐市")),
        new Province("TW", "71", "台湾省", List.of("台湾", "台北", "台北市")),
        new Province("HK", "81", "香港特别行政区", List.of("香港")),
        new Province("MO", "82", "澳门特别行政区", List.of("澳门")));
    public static String normalize(String value) {
        if (value == null || value.isBlank()) return "";
        String key = value.trim();
        return ALL.stream().filter(p -> p.code().equalsIgnoreCase(key) || p.name().equals(key) ||
            p.aliases().stream().anyMatch(a -> a.equalsIgnoreCase(key)) ||
            key.matches("[0-9]{6}") && key.startsWith(p.prefix())).map(Province::code).findFirst().orElse("");
    }
    public static String requireCode(String value) {
        String code = normalize(value);
        if (code.isEmpty()) throw new BusinessException(ErrorCode.VALIDATION_ERROR, "请选择有效的省级地区");
        return code;
    }
    public static String codeOrOriginal(String value) {
        String code = normalize(value);
        return code.isEmpty() ? value : code;
    }
    public static String query(String value) {
        return value == null || value.isBlank() ? null : codeOrOriginal(value.trim());
    }
    public static boolean matches(String stored, String selected) {
        if (selected == null || selected.isBlank()) return true;
        String code = normalize(selected);
        return stored != null && (code.isEmpty() ? stored.trim().equalsIgnoreCase(selected.trim()) : code.equals(normalize(stored)));
    }
    public static List<String> queryAliases(String selected) {
        String code = normalize(selected);
        Optional<Province> province = ALL.stream().filter(p -> p.code().equals(code)).findFirst();
        if (province.isEmpty()) return List.of(selected == null ? "" : selected.trim().toLowerCase(Locale.ROOT));
        Province p = province.get();
        List<String> values = new ArrayList<>(p.aliases());
        values.add(p.code()); values.add(p.name());
        return values.stream().map(v -> v.toLowerCase(Locale.ROOT)).distinct().toList();
    }
    public static String prefix(String selected) {
        String code = normalize(selected);
        return ALL.stream().filter(p -> p.code().equals(code)).map(Province::prefix).findFirst().orElse("unsupported");
    }
}
