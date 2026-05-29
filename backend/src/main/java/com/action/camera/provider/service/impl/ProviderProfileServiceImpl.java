package com.action.camera.provider.service.impl;

import com.action.camera.common.ErrorCode;
import com.action.camera.common.exception.BusinessException;
import com.action.camera.provider.dto.ProviderProfilePublicVO;
import com.action.camera.provider.dto.ProviderProfileUpdateDTO;
import com.action.camera.provider.entity.ProviderProfile;
import com.action.camera.provider.mapper.ProviderProfileMapper;
import com.action.camera.provider.mapper.ProviderStyleTagMapper;
import com.action.camera.provider.service.ProviderProfileService;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class ProviderProfileServiceImpl implements ProviderProfileService {

    private final ProviderProfileMapper providerProfileMapper;
    private final ProviderStyleTagMapper providerStyleTagMapper;

    public ProviderProfileServiceImpl(ProviderProfileMapper providerProfileMapper,
                                      ProviderStyleTagMapper providerStyleTagMapper) {
        this.providerProfileMapper = providerProfileMapper;
        this.providerStyleTagMapper = providerStyleTagMapper;
    }

    @Override
    @Transactional
    public void updateProfile(Long currentUserId, ProviderProfileUpdateDTO dto) {
        ProviderProfile profile = providerProfileMapper.selectOne(
                new LambdaQueryWrapper<ProviderProfile>()
                        .eq(ProviderProfile::getUserId, currentUserId)
        );
        if (profile == null) {
            throw new BusinessException(ErrorCode.NOT_FOUND, "摄影师主页不存在，请先以摄影师身份登录以初始化主页");
        }

        if (dto.getDisplayName() != null)  profile.setDisplayName(dto.getDisplayName());
        if (dto.getBio() != null)           profile.setBio(dto.getBio());
        if (dto.getCityCode() != null)      profile.setCityCode(dto.getCityCode());
        if (dto.getCityArea() != null)      profile.setCityArea(dto.getCityArea());
        if (dto.getPriceMin() != null)      profile.setPriceMin(dto.getPriceMin());
        if (dto.getPriceMax() != null)      profile.setPriceMax(dto.getPriceMax());
        if (dto.getAcceptingOrders() != null) profile.setAcceptingOrders(dto.getAcceptingOrders());
        if (dto.getAge() != null)           profile.setAge(dto.getAge());
        if (dto.getEquipment() != null)     profile.setEquipment(dto.getEquipment());
        providerProfileMapper.updateById(profile);

        if (dto.getStyleTagIds() != null) {
            providerStyleTagMapper.deleteByProfileId(profile.getId());
            if (!dto.getStyleTagIds().isEmpty()) {
                providerStyleTagMapper.batchInsert(profile.getId(), dto.getStyleTagIds());
            }
        }
    }

    @Override
    public ProviderProfilePublicVO getPublicProfile(Long providerUserId) {
        ProviderProfilePublicVO vo = providerProfileMapper.selectPublicProfile(providerUserId);
        if (vo == null) {
            throw new BusinessException(ErrorCode.NOT_FOUND, "摄影师主页不存在");
        }
        // 过滤无风格标签时 LEFT JOIN 产生的 null 元素
        if (vo.getStyleTags() != null) {
            vo.setStyleTags(vo.getStyleTags().stream().filter(t -> t != null).toList());
        }
        return vo;
    }
}
