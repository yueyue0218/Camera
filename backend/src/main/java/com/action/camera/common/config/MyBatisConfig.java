package com.action.camera.common.config;

import com.baomidou.mybatisplus.extension.plugins.MybatisPlusInterceptor;
import org.mybatis.spring.annotation.MapperScan;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
@MapperScan({
        "com.action.camera.certification.mapper",
        "com.action.camera.provider.mapper"
})
public class MyBatisConfig {

    /**
     * MyBatis-Plus 3.5.9+ 分页由 MybatisPlusInterceptor 内置处理，
     * 无需再单独添加 PaginationInnerInterceptor。
     */
    @Bean
    public MybatisPlusInterceptor mybatisPlusInterceptor() {
        return new MybatisPlusInterceptor();
    }
}
