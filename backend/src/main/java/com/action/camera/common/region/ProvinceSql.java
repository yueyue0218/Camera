package com.action.camera.common.region;

/** Identical predicates in data and count queries, before pagination. Bind all input. */
public final class ProvinceSql {
    private ProvinceSql() {}
    public static final String DEMAND = """
        (:cityCode is null or lower(trim(d.city_code)) in (:#{T(com.action.camera.common.region.ProvinceNames).queryAliases(#cityCode)})
          or (trim(d.city_code) regexp '^[0-9]{6}$' and substring(trim(d.city_code), 1, 2) = :#{T(com.action.camera.common.region.ProvinceNames).prefix(#cityCode)}))
        """;
    public static final String SERVICE = """
        (:cityCode is null or lower(trim(sp.city_code)) in (:#{T(com.action.camera.common.region.ProvinceNames).queryAliases(#cityCode)})
          or (trim(sp.city_code) regexp '^[0-9]{6}$' and substring(trim(sp.city_code), 1, 2) = :#{T(com.action.camera.common.region.ProvinceNames).prefix(#cityCode)}))
        """;
}
