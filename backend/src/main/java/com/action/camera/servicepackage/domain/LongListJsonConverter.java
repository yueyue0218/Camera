package com.action.camera.servicepackage.domain;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

import java.util.List;

@Converter
public class LongListJsonConverter implements AttributeConverter<List<Long>, String> {

    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final TypeReference<List<Long>> TYPE = new TypeReference<>() {
    };

    @Override
    public String convertToDatabaseColumn(List<Long> attribute) {
        try {
            return MAPPER.writeValueAsString(attribute == null ? List.of() : attribute);
        } catch (Exception e) {
            throw new IllegalArgumentException("Cannot serialize long list", e);
        }
    }

    @Override
    public List<Long> convertToEntityAttribute(String dbData) {
        if (dbData == null || dbData.isBlank()) {
            return List.of();
        }
        try {
            return MAPPER.readValue(dbData, TYPE);
        } catch (Exception e) {
            throw new IllegalArgumentException("Cannot deserialize long list", e);
        }
    }
}
