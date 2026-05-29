package com.action.camera.order.converter;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.junit.jupiter.api.Assertions.assertEquals;

class CentToYuanConverterAmountTest {

    private final CentToYuanConverter converter = new CentToYuanConverter();

    @Test
    void shouldConvertCentsToYuanDecimal() {
        BigDecimal yuan = converter.convertToDatabaseColumn(39900L);

        assertEquals(new BigDecimal("399.00"), yuan);
    }

    @Test
    void shouldConvertYuanDecimalBackToCents() {
        Long cents = converter.convertToEntityAttribute(new BigDecimal("399.00"));

        assertEquals(39900L, cents);
    }
}
