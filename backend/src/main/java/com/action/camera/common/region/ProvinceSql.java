package com.action.camera.common.region;

/** Query-time compatibility, applied before paging and to count queries. */
public final class ProvinceSql {
    private ProvinceSql() {}
    public static final String DEMAND = """
        (:cityCode is null or lower(trim(d.city_code)) in (:#{T(com.action.camera.common.region.ProvinceNames).queryAliases(#cityCode)})
          or (length(trim(d.city_code)) = 6 and trim(d.city_code) between :#{T(com.action.camera.common.region.ProvinceNames).lowerCode(#cityCode)} and :#{T(com.action.camera.common.region.ProvinceNames).upperCode(#cityCode)}))
        """;
    public static final String SERVICE = """
        (:cityCode is null or lower(trim(sp.city_code)) in (:#{T(com.action.camera.common.region.ProvinceNames).queryAliases(#cityCode)})
          or (length(trim(sp.city_code)) = 6 and trim(sp.city_code) between :#{T(com.action.camera.common.region.ProvinceNames).lowerCode(#cityCode)} and :#{T(com.action.camera.common.region.ProvinceNames).upperCode(#cityCode)}))
        """;
}
