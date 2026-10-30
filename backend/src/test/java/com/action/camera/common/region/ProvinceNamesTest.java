package com.action.camera.common.region;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import static org.assertj.core.api.Assertions.assertThat;

class ProvinceNamesTest {
    @ParameterizedTest
    @ValueSource(strings={"南京","南京市","苏州","苏州市","NJ","320100","江苏","江苏省"})
    void locatedAndLegacyRegionsNormalizeToTheSameProvince(String region) {
        assertThat(ProvinceNames.normalize(region)).isEqualTo("江苏省");
    }
    @Test void queryAliasesAreSeparateValuesRatherThanPipeJoinedStrings() {
        assertThat(ProvinceNames.lowerCode("江苏省")).isEqualTo("320000");
        assertThat(ProvinceNames.upperCode("江苏省")).isEqualTo("329999");
        assertThat(ProvinceNames.queryAliases("江苏省")).contains("南京","南京市","苏州","苏州市","nj","js","江苏省");
        assertThat(ProvinceNames.queryAliases("浙江省")).contains("杭州","杭州市","宁波","宁波市");
        assertThat(ProvinceNames.queryAliases("江苏省")).noneMatch(value -> value.contains("|"));
    }
    @Test void unknownRegionsRetainExactMatchingSemantics() {
        assertThat(ProvinceNames.normalize("  Custom Campus ")).isEqualTo("custom campus");
        assertThat(ProvinceNames.queryAliases("Custom Campus")).containsExactly("custom campus");
        assertThat(ProvinceNames.queryAliases("南京")).containsExactly("南京");
    }
}
