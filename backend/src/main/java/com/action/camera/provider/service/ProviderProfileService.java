package com.action.camera.provider.service;

import com.action.camera.provider.dto.ProviderProfilePublicVO;
import com.action.camera.provider.dto.ProviderProfileUpdateDTO;

public interface ProviderProfileService {

    void updateProfile(Long currentUserId, ProviderProfileUpdateDTO dto);

    ProviderProfilePublicVO getPublicProfile(Long providerUserId);
}
