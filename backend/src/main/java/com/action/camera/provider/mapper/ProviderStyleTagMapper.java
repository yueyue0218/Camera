package com.action.camera.provider.mapper;

import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Param;

import java.util.List;

public interface ProviderStyleTagMapper {

    @Delete("DELETE FROM provider_style_tags WHERE provider_profile_id = #{profileId}")
    void deleteByProfileId(@Param("profileId") Long profileId);

    @Insert({
        "<script>",
        "INSERT INTO provider_style_tags (provider_profile_id, tag_id) VALUES ",
        "<foreach collection='tagIds' item='tagId' separator=','>",
        "(#{profileId}, #{tagId})",
        "</foreach>",
        "</script>"
    })
    void batchInsert(@Param("profileId") Long profileId, @Param("tagIds") List<Long> tagIds);
}
