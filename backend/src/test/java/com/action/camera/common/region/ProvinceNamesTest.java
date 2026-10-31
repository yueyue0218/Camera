package com.action.camera.common.region;

import org.junit.jupiter.api.Test;
import java.util.List;
import static org.assertj.core.api.Assertions.*;

class ProvinceNamesTest {
    @Test void completeUniqueCatalogue() {
        assertThat(ProvinceNames.ALL).hasSize(34);
        assertThat(ProvinceNames.ALL.stream().map(ProvinceNames.Province::code).distinct()).hasSize(34);
        assertThat(ProvinceNames.ALL.stream().filter(p -> p.name().endsWith("省"))).hasSize(23);
        assertThat(ProvinceNames.ALL.stream().filter(p -> p.name().endsWith("自治区"))).hasSize(5);
        assertThat(ProvinceNames.ALL.stream().filter(p -> p.name().endsWith("市"))).hasSize(4);
        assertThat(ProvinceNames.ALL.stream().filter(p -> p.name().endsWith("特别行政区"))).hasSize(2);
    }
    @Test void normalizeKnownAliasesWithoutDefaultingUnknownValues() {
        for (String alias : List.of("JS", "js", "南京", "南京市", "NJ", "江苏", "江苏省", "320102")) {
            assertThat(ProvinceNames.normalize(alias)).isEqualTo("JS");
            assertThat(ProvinceNames.matches(alias, "江苏省")).isTrue();
        }
        assertThat(ProvinceNames.normalize("杭州市")).isEqualTo("ZJ");
        assertThat(ProvinceNames.normalize("深圳市")).isEqualTo("GD");
        assertThat(ProvinceNames.normalize("320ABC")).isEmpty();
        assertThat(ProvinceNames.normalize("unknown")).isEmpty();
        assertThat(ProvinceNames.query(" ")).isNull();
        assertThat(ProvinceNames.query("unknown")).isEqualTo("unknown");
        assertThat(ProvinceNames.codeOrOriginal("unknown")).isEqualTo("unknown");
        assertThat(ProvinceNames.matches("unknown", "JS")).isFalse();
        assertThatThrownBy(() -> ProvinceNames.requireCode("unknown")).hasMessageContaining("省级地区");
    }
}
