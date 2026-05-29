package com.action.camera.provider.mapper;

import com.action.camera.provider.dto.ProviderProfilePublicVO;
import com.action.camera.provider.entity.ProviderProfile;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Param;

public interface ProviderProfileMapper extends BaseMapper<ProviderProfile> {

    ProviderProfilePublicVO selectPublicProfile(@Param("providerUserId") Long providerUserId);
}
