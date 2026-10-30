package com.action.camera.common.region;

import java.util.Locale;

/** Compatibility for legacy city values; unknown names retain exact-match semantics. */
public final class ProvinceNames {
    private ProvinceNames() {}
    public static String normalize(String value) {
        if (value == null) return "";
        String key = value.trim().toLowerCase(Locale.ROOT);
        if (key.matches("[0-9]{6}")) {
            switch (key.substring(0, 2)) {
                case "11": return "北京市";
                case "12": return "天津市";
                case "13": return "河北省";
                case "14": return "山西省";
                case "15": return "内蒙古自治区";
                case "21": return "辽宁省";
                case "22": return "吉林省";
                case "23": return "黑龙江省";
                case "31": return "上海市";
                case "32": return "江苏省";
                case "33": return "浙江省";
                case "34": return "安徽省";
                case "35": return "福建省";
                case "36": return "江西省";
                case "37": return "山东省";
                case "41": return "河南省";
                case "42": return "湖北省";
                case "43": return "湖南省";
                case "44": return "广东省";
                case "45": return "广西壮族自治区";
                case "46": return "海南省";
                case "50": return "重庆市";
                case "51": return "四川省";
                case "52": return "贵州省";
                case "53": return "云南省";
                case "54": return "西藏自治区";
                case "61": return "陕西省";
                case "62": return "甘肃省";
                case "63": return "青海省";
                case "64": return "宁夏回族自治区";
                case "65": return "新疆维吾尔自治区";
                case "71": return "台湾省";
                case "81": return "香港特别行政区";
                case "82": return "澳门特别行政区";
                default: break;
            }
        }
        return switch (key) {
            case "bj", "北京市", "北京" -> "北京市";
            case "tj", "天津市", "天津" -> "天津市";
            case "he", "河北省", "河北", "石家庄", "唐山", "保定", "河北市", "石家庄市", "唐山市", "保定市" -> "河北省";
            case "sx", "山西省", "山西", "太原", "大同", "山西市", "太原市", "大同市" -> "山西省";
            case "nm", "内蒙古自治区", "内蒙古", "呼和浩特", "包头", "内蒙古市", "呼和浩特市", "包头市" -> "内蒙古自治区";
            case "ln", "辽宁省", "辽宁", "沈阳", "大连", "辽宁市", "沈阳市", "大连市" -> "辽宁省";
            case "jl", "吉林省", "吉林", "长春", "吉林市", "长春市", "吉林市市" -> "吉林省";
            case "hl", "黑龙江省", "黑龙江", "哈尔滨", "黑龙江市", "哈尔滨市" -> "黑龙江省";
            case "sh", "上海市", "上海" -> "上海市";
            case "js", "江苏省", "江苏", "南京", "苏州", "无锡", "常州", "镇江", "扬州", "泰州", "南通", "盐城", "淮安", "宿迁", "徐州", "连云港", "nj", "江苏市", "南京市", "苏州市", "无锡市", "常州市", "镇江市", "扬州市", "泰州市", "南通市", "盐城市", "淮安市", "宿迁市", "徐州市", "连云港市", "nj市" -> "江苏省";
            case "zj", "浙江省", "浙江", "杭州", "宁波", "温州", "嘉兴", "湖州", "绍兴", "金华", "衢州", "舟山", "台州", "丽水", "浙江市", "杭州市", "宁波市", "温州市", "嘉兴市", "湖州市", "绍兴市", "金华市", "衢州市", "舟山市", "台州市", "丽水市" -> "浙江省";
            case "ah", "安徽省", "安徽", "合肥", "芜湖", "安徽市", "合肥市", "芜湖市" -> "安徽省";
            case "fj", "福建省", "福建", "福州", "厦门", "泉州", "福建市", "福州市", "厦门市", "泉州市" -> "福建省";
            case "jx", "江西省", "江西", "南昌", "九江", "江西市", "南昌市", "九江市" -> "江西省";
            case "sd", "山东省", "山东", "济南", "青岛", "烟台", "山东市", "济南市", "青岛市", "烟台市" -> "山东省";
            case "ha", "河南省", "河南", "郑州", "洛阳", "河南市", "郑州市", "洛阳市" -> "河南省";
            case "hb", "湖北省", "湖北", "武汉", "宜昌", "湖北市", "武汉市", "宜昌市" -> "湖北省";
            case "hn", "湖南省", "湖南", "长沙", "株洲", "湘潭", "湖南市", "长沙市", "株洲市", "湘潭市" -> "湖南省";
            case "gd", "广东省", "广东", "广州", "深圳", "珠海", "佛山", "东莞", "中山", "惠州", "广东市", "广州市", "深圳市", "珠海市", "佛山市", "东莞市", "中山市", "惠州市" -> "广东省";
            case "gx", "广西壮族自治区", "广西", "南宁", "桂林", "柳州", "广西市", "南宁市", "桂林市", "柳州市" -> "广西壮族自治区";
            case "hi", "海南省", "海南", "海口", "三亚", "海南市", "海口市", "三亚市" -> "海南省";
            case "cq", "重庆市", "重庆" -> "重庆市";
            case "sc", "四川省", "四川", "成都", "绵阳", "四川市", "成都市", "绵阳市" -> "四川省";
            case "gz", "贵州省", "贵州", "贵阳", "遵义", "贵州市", "贵阳市", "遵义市" -> "贵州省";
            case "yn", "云南省", "云南", "昆明", "大理", "丽江", "云南市", "昆明市", "大理市", "丽江市" -> "云南省";
            case "xz", "西藏自治区", "西藏", "拉萨", "西藏市", "拉萨市" -> "西藏自治区";
            case "sn", "陕西省", "陕西", "西安", "咸阳", "陕西市", "西安市", "咸阳市" -> "陕西省";
            case "gs", "甘肃省", "甘肃", "兰州", "甘肃市", "兰州市" -> "甘肃省";
            case "qh", "青海省", "青海", "西宁", "青海市", "西宁市" -> "青海省";
            case "nx", "宁夏回族自治区", "宁夏", "银川", "宁夏市", "银川市" -> "宁夏回族自治区";
            case "xj", "新疆维吾尔自治区", "新疆", "乌鲁木齐", "新疆市", "乌鲁木齐市" -> "新疆维吾尔自治区";
            case "tw", "台湾省", "台湾", "台北", "台湾市", "台北市" -> "台湾省";
            case "hk", "香港特别行政区", "香港", "香港市" -> "香港特别行政区";
            case "mo", "澳门特别行政区", "澳门", "澳门市" -> "澳门特别行政区";
            default -> key;
        };
    }
    public static boolean matches(String stored, String selected) {
        if (selected == null) return true;
        String target = normalize(selected);
        // Province menu broadens matching; legacy city queries keep their exact meaning.
        return stored != null && (stored.trim().equalsIgnoreCase(selected.trim()) ||
                isProvince(selected) && normalize(stored).equals(target));
    }
    private static boolean isProvince(String value) {
        return switch (value.trim().toLowerCase(Locale.ROOT)) {
            case "bj", "北京市", "tj", "天津市", "he", "河北省", "sx", "山西省", "nm", "内蒙古自治区", "ln", "辽宁省", "jl", "吉林省", "hl", "黑龙江省", "sh", "上海市", "js", "江苏省", "zj", "浙江省", "ah", "安徽省", "fj", "福建省", "jx", "江西省", "sd", "山东省", "ha", "河南省", "hb", "湖北省", "hn", "湖南省", "gd", "广东省", "gx", "广西壮族自治区", "hi", "海南省", "cq", "重庆市", "sc", "四川省", "gz", "贵州省", "yn", "云南省", "xz", "西藏自治区", "sn", "陕西省", "gs", "甘肃省", "qh", "青海省", "nx", "宁夏回族自治区", "xj", "新疆维吾尔自治区", "tw", "台湾省", "hk", "香港特别行政区", "mo", "澳门特别行政区" -> true;
            default -> false;
        };
    }
    public static java.util.List<String> queryAliases(String selected) {
        if (selected == null) return java.util.List.of("");
        if (!isProvince(selected)) return java.util.List.of(selected.trim().toLowerCase(Locale.ROOT));
        return switch (normalize(selected)) {
            case "北京市" -> java.util.List.of("bj","北京市","北京");
            case "天津市" -> java.util.List.of("tj","天津市","天津");
            case "河北省" -> java.util.List.of("he","河北省","河北","石家庄","唐山","保定","河北市","石家庄市","唐山市","保定市");
            case "山西省" -> java.util.List.of("sx","山西省","山西","太原","大同","山西市","太原市","大同市");
            case "内蒙古自治区" -> java.util.List.of("nm","内蒙古自治区","内蒙古","呼和浩特","包头","内蒙古市","呼和浩特市","包头市");
            case "辽宁省" -> java.util.List.of("ln","辽宁省","辽宁","沈阳","大连","辽宁市","沈阳市","大连市");
            case "吉林省" -> java.util.List.of("jl","吉林省","吉林","长春","吉林市","长春市","吉林市市");
            case "黑龙江省" -> java.util.List.of("hl","黑龙江省","黑龙江","哈尔滨","黑龙江市","哈尔滨市");
            case "上海市" -> java.util.List.of("sh","上海市","上海");
            case "江苏省" -> java.util.List.of("js","江苏省","江苏","南京","苏州","无锡","常州","镇江","扬州","泰州","南通","盐城","淮安","宿迁","徐州","连云港","nj","江苏市","南京市","苏州市","无锡市","常州市","镇江市","扬州市","泰州市","南通市","盐城市","淮安市","宿迁市","徐州市","连云港市","nj市");
            case "浙江省" -> java.util.List.of("zj","浙江省","浙江","杭州","宁波","温州","嘉兴","湖州","绍兴","金华","衢州","舟山","台州","丽水","浙江市","杭州市","宁波市","温州市","嘉兴市","湖州市","绍兴市","金华市","衢州市","舟山市","台州市","丽水市");
            case "安徽省" -> java.util.List.of("ah","安徽省","安徽","合肥","芜湖","安徽市","合肥市","芜湖市");
            case "福建省" -> java.util.List.of("fj","福建省","福建","福州","厦门","泉州","福建市","福州市","厦门市","泉州市");
            case "江西省" -> java.util.List.of("jx","江西省","江西","南昌","九江","江西市","南昌市","九江市");
            case "山东省" -> java.util.List.of("sd","山东省","山东","济南","青岛","烟台","山东市","济南市","青岛市","烟台市");
            case "河南省" -> java.util.List.of("ha","河南省","河南","郑州","洛阳","河南市","郑州市","洛阳市");
            case "湖北省" -> java.util.List.of("hb","湖北省","湖北","武汉","宜昌","湖北市","武汉市","宜昌市");
            case "湖南省" -> java.util.List.of("hn","湖南省","湖南","长沙","株洲","湘潭","湖南市","长沙市","株洲市","湘潭市");
            case "广东省" -> java.util.List.of("gd","广东省","广东","广州","深圳","珠海","佛山","东莞","中山","惠州","广东市","广州市","深圳市","珠海市","佛山市","东莞市","中山市","惠州市");
            case "广西壮族自治区" -> java.util.List.of("gx","广西壮族自治区","广西","南宁","桂林","柳州","广西市","南宁市","桂林市","柳州市");
            case "海南省" -> java.util.List.of("hi","海南省","海南","海口","三亚","海南市","海口市","三亚市");
            case "重庆市" -> java.util.List.of("cq","重庆市","重庆");
            case "四川省" -> java.util.List.of("sc","四川省","四川","成都","绵阳","四川市","成都市","绵阳市");
            case "贵州省" -> java.util.List.of("gz","贵州省","贵州","贵阳","遵义","贵州市","贵阳市","遵义市");
            case "云南省" -> java.util.List.of("yn","云南省","云南","昆明","大理","丽江","云南市","昆明市","大理市","丽江市");
            case "西藏自治区" -> java.util.List.of("xz","西藏自治区","西藏","拉萨","西藏市","拉萨市");
            case "陕西省" -> java.util.List.of("sn","陕西省","陕西","西安","咸阳","陕西市","西安市","咸阳市");
            case "甘肃省" -> java.util.List.of("gs","甘肃省","甘肃","兰州","甘肃市","兰州市");
            case "青海省" -> java.util.List.of("qh","青海省","青海","西宁","青海市","西宁市");
            case "宁夏回族自治区" -> java.util.List.of("nx","宁夏回族自治区","宁夏","银川","宁夏市","银川市");
            case "新疆维吾尔自治区" -> java.util.List.of("xj","新疆维吾尔自治区","新疆","乌鲁木齐","新疆市","乌鲁木齐市");
            case "台湾省" -> java.util.List.of("tw","台湾省","台湾","台北","台湾市","台北市");
            case "香港特别行政区" -> java.util.List.of("hk","香港特别行政区","香港","香港市");
            case "澳门特别行政区" -> java.util.List.of("mo","澳门特别行政区","澳门","澳门市");
            default -> java.util.List.of(selected.trim().toLowerCase(Locale.ROOT));
        };
    }
    public static String lowerCode(String selected) { return prefix(selected) + "0000"; }
    public static String upperCode(String selected) { return prefix(selected) + "9999"; }
    private static String prefix(String selected) {
        if (selected == null || !isProvince(selected)) return "unsupported";
        return switch (normalize(selected)) {
            case "北京市" -> "11";
            case "天津市" -> "12";
            case "河北省" -> "13";
            case "山西省" -> "14";
            case "内蒙古自治区" -> "15";
            case "辽宁省" -> "21";
            case "吉林省" -> "22";
            case "黑龙江省" -> "23";
            case "上海市" -> "31";
            case "江苏省" -> "32";
            case "浙江省" -> "33";
            case "安徽省" -> "34";
            case "福建省" -> "35";
            case "江西省" -> "36";
            case "山东省" -> "37";
            case "河南省" -> "41";
            case "湖北省" -> "42";
            case "湖南省" -> "43";
            case "广东省" -> "44";
            case "广西壮族自治区" -> "45";
            case "海南省" -> "46";
            case "重庆市" -> "50";
            case "四川省" -> "51";
            case "贵州省" -> "52";
            case "云南省" -> "53";
            case "西藏自治区" -> "54";
            case "陕西省" -> "61";
            case "甘肃省" -> "62";
            case "青海省" -> "63";
            case "宁夏回族自治区" -> "64";
            case "新疆维吾尔自治区" -> "65";
            case "台湾省" -> "71";
            case "香港特别行政区" -> "81";
            case "澳门特别行政区" -> "82";
            default -> "unsupported";
        };
    }

}
