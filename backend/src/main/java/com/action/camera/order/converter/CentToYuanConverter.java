package com.action.camera.order.converter;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

import java.math.BigDecimal;
import java.math.RoundingMode;

/**
 * Keeps Java service code in cents while persisting DECIMAL yuan values required by P3 SQL.
 */
@Converter
public class CentToYuanConverter implements AttributeConverter<Long, BigDecimal> {

    private static final BigDecimal ONE_HUNDRED = BigDecimal.valueOf(100);

    @Override
    public BigDecimal convertToDatabaseColumn(Long attribute) {
        if (attribute == null) {
            return null;
        }
        return BigDecimal.valueOf(attribute)
                .divide(ONE_HUNDRED, 2, RoundingMode.UNNECESSARY);
    }

    @Override
    public Long convertToEntityAttribute(BigDecimal dbData) {
        if (dbData == null) {
            return null;
        }
        return dbData
                .multiply(ONE_HUNDRED)
                .setScale(0, RoundingMode.UNNECESSARY)
                .longValueExact();
    }
}
