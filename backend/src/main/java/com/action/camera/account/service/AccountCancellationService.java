package com.action.camera.account.service;

import com.action.camera.account.domain.AccountCancellationRequest;
import com.action.camera.account.domain.AccountCancellationStatus;
import com.action.camera.account.dto.AccountCancellationResponse;
import com.action.camera.account.repository.AccountCancellationRequestRepository;
import com.action.camera.common.ErrorCode;
import com.action.camera.common.exception.BusinessException;
import com.action.camera.domain.User;
import com.action.camera.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Optional;

@Service
public class AccountCancellationService {

    private final AccountCancellationRequestRepository requestRepository;
    private final UserRepository userRepository;

    public AccountCancellationService(AccountCancellationRequestRepository requestRepository,
                                      UserRepository userRepository) {
        this.requestRepository = requestRepository;
        this.userRepository = userRepository;
    }

    @Transactional(readOnly = true)
    public AccountCancellationResponse getStatus(Long userId) {
        return requestRepository.findByUserId(userId)
                .map(this::toResponse)
                .orElseGet(() -> new AccountCancellationResponse(
                        null, "NOT_REQUESTED", null, null, null, null, null));
    }

    @Transactional
    public AccountCancellationResponse request(Long userId, String reason) {
        User user = userRepository.findByIdForUpdate(userId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "用户不存在"));
        if ("DELETED".equals(user.getStatus())) {
            throw new BusinessException(ErrorCode.STATUS_CONFLICT, "账号已经注销");
        }

        Optional<AccountCancellationRequest> existing = requestRepository.findByUserId(userId);
        if (existing.isPresent()) {
            AccountCancellationRequest request = existing.get();
            if (request.getStatus() != AccountCancellationStatus.REJECTED) {
                return toResponse(request);
            }
            request.setStatus(AccountCancellationStatus.PENDING);
            request.setReason(normalizeReason(reason));
            request.setRequestedAt(LocalDateTime.now());
            request.setProcessedAt(null);
            request.setResolutionNote(null);
            return toResponse(requestRepository.save(request));
        }

        AccountCancellationRequest request = new AccountCancellationRequest();
        request.setUserId(userId);
        request.setStatus(AccountCancellationStatus.PENDING);
        request.setReason(normalizeReason(reason));
        return toResponse(requestRepository.save(request));
    }

    private String normalizeReason(String reason) {
        if (reason == null || reason.isBlank()) {
            return null;
        }
        String normalized = reason.trim();
        if (normalized.length() > 500) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "注销原因不能超过500个字符");
        }
        return normalized;
    }

    private AccountCancellationResponse toResponse(AccountCancellationRequest request) {
        return new AccountCancellationResponse(
                request.getId(),
                request.getStatus().name(),
                request.getReason(),
                request.getRequestedAt(),
                request.getUpdatedAt(),
                request.getProcessedAt(),
                request.getResolutionNote());
    }
}
