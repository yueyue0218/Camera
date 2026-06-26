package com.action.camera.application;

import com.action.camera.domain.User;
import com.action.camera.provider.entity.ProviderProfile;
import com.action.camera.provider.mapper.ProviderProfileMapper;
import com.action.camera.repository.UserRepository;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import org.springframework.stereotype.Service;

@Service
public class UserDisplayService {

    private final UserRepository userRepository;
    private final ProviderProfileMapper providerProfileMapper;

    public UserDisplayService(UserRepository userRepository,
                              ProviderProfileMapper providerProfileMapper) {
        this.userRepository = userRepository;
        this.providerProfileMapper = providerProfileMapper;
    }

    public String resolveDisplayName(Long userId, String roleHint) {
        if (userId == null) {
            return "Portra 用户";
        }
        User user = userRepository.findById(userId).orElse(null);
        if (user == null) {
            return "Portra 用户";
        }

        if ("PROVIDER".equalsIgnoreCase(roleHint)) {
            ProviderProfile providerProfile = providerProfileMapper.selectOne(
                    new LambdaQueryWrapper<ProviderProfile>().eq(ProviderProfile::getUserId, userId)
            );
            String providerName = trimToNull(providerProfile == null ? null : providerProfile.getDisplayName());
            if (providerName != null) {
                return providerName;
            }
        }

        String nickname = trimToNull(user.getNickname());
        if (nickname != null) {
            return nickname;
        }

        String studentNo = trimToNull(user.getStudentNo());
        if (studentNo != null) {
            return studentNo;
        }

        return "Portra 用户";
    }

    public String resolveCustomerDisplayName(Long userId) {
        return resolveDisplayName(userId, "CUSTOMER");
    }

    public String resolveProviderDisplayName(Long userId) {
        return resolveDisplayName(userId, "PROVIDER");
    }

    private String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String normalized = value.trim();
        return normalized.isEmpty() ? null : normalized;
    }
}
