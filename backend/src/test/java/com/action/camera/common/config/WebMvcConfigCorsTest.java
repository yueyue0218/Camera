package com.action.camera.common.config;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
class WebMvcConfigCorsTest {

    private static final String ALIYUN_FRONTEND_ORIGIN = "http://47.250.86.6";

    @Autowired
    private MockMvc mockMvc;

    @Test
    void aliyunFrontendCanPreflightConversationRequests() throws Exception {
        mockMvc.perform(options("/conversations")
                        .header("Origin", ALIYUN_FRONTEND_ORIGIN)
                        .header("Access-Control-Request-Method", "GET")
                        .header("Access-Control-Request-Headers", "x-user-id,x-user-role,authorization"))
                .andExpect(status().isOk())
                .andExpect(header().string("Access-Control-Allow-Origin", ALIYUN_FRONTEND_ORIGIN));
    }

    @Test
    void aliyunFrontendCanPreflightImageUploads() throws Exception {
        mockMvc.perform(options("/files/images/batch")
                        .header("Origin", ALIYUN_FRONTEND_ORIGIN)
                        .header("Access-Control-Request-Method", "POST")
                        .header("Access-Control-Request-Headers", "x-user-id,x-user-role,authorization"))
                .andExpect(status().isOk())
                .andExpect(header().string("Access-Control-Allow-Origin", ALIYUN_FRONTEND_ORIGIN));
    }
}
