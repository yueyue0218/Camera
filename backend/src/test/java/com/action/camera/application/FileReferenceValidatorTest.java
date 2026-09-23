package com.action.camera.application;

import com.action.camera.common.exception.BusinessException;
import com.action.camera.domain.FileRecord;
import com.action.camera.repository.FileRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Arrays;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class FileReferenceValidatorTest {

    @Mock
    private FileRepository fileRepository;

    private FileReferenceValidator validator;

    @BeforeEach
    void setUp() {
        validator = new FileReferenceValidator(fileRepository);
    }

    @Test
    void reportsEveryMissingIdAfterOneBatchLookup() {
        when(fileRepository.findAllById(List.of(11L, 12L, 13L)))
                .thenReturn(List.of(record(11L), record(13L)));

        assertThatThrownBy(() -> validator.requireExisting(
                List.of(11L, 12L, 13L), "referenceFileIds"))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("referenceFileIds")
                .hasMessageContaining("12");

        verify(fileRepository, times(1)).findAllById(any());
    }

    @Test
    void deduplicatesWithoutChangingLookupOrderAndSkipsNullOrEmptyCollections() {
        when(fileRepository.findAllById(List.of(13L, 11L)))
                .thenReturn(List.of(record(11L), record(13L)));

        validator.requireExisting(Arrays.asList(13L, null, 11L, 13L), "portfolioIds");
        validator.requireExisting(null, "portfolioIds");
        validator.requireExisting(List.of(), "portfolioIds");

        verify(fileRepository, times(1)).findAllById(List.of(13L, 11L));
        verify(fileRepository, never()).findById(any());
    }

    private FileRecord record(Long id) {
        FileRecord record = new FileRecord();
        record.setId(id);
        return record;
    }
}
