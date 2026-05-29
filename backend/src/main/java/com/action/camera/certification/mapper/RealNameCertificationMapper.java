package com.action.camera.certification.mapper;

import com.action.camera.certification.entity.RealNameCertification;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import org.apache.ibatis.annotations.Param;

public interface RealNameCertificationMapper extends BaseMapper<RealNameCertification> {

    /**
     * 按状态分页查询，status 为 null 时查全部。
     * SQL 写在 RealNameCertificationMapper.xml。
     */
    IPage<RealNameCertification> selectPageByStatus(IPage<RealNameCertification> page,
                                                    @Param("status") String status);
}
