package com.action.camera.servicepackage.domain;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

import java.time.LocalDate;
import java.util.List;

@Converter
public class LocalDateListJsonConverter implements AttributeConverter<List<LocalDate>, String> {

    private static final ObjectMapper MAPPER = new ObjectMapper()
            .registerModule(new JavaTimeModule())
            .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);
    private static final TypeReference<List<LocalDate>> TYPE = new TypeReference<>() {
    };

    @Override
    public String convertToDatabaseColumn(List<LocalDate> attribute) {
        try {
            return MAPPER.writeValueAsString(attribute == null ? List.of() : attribute);
        } catch (Exception e) {
            throw new IllegalArgumentException("Cannot serialize date list", e);
        }
    }

    @Override
    public List<LocalDate> convertToEntityAttribute(String dbData) {
        if (dbData == null || dbData.isBlank()) {
            return List.of();
        }
        try {
            return MAPPER.readValue(dbData, TYPE);
        } catch (Exception e) {
            throw new IllegalArgumentException("Cannot deserialize date list", e);
        }
    }
}
