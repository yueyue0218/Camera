package com.action.camera.integration;

import com.action.camera.support.TestAuthTokens;
import com.action.camera.demand.repository.DemandRepository;
import com.action.camera.servicepackage.repository.ServicePackageRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.http.MediaType;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = "spring.http.client.factory=simple")
@AutoConfigureMockMvc
@ActiveProfiles("smoke")
@Transactional
class ProvinceRegionContractIntegrationTest {
    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;
    @Autowired TestAuthTokens tokens;
    @Autowired ObjectMapper json;
    @Autowired DemandRepository demands;
    @Autowired ServicePackageRepository services;

    private String user(long id, String role) {
        jdbc.update("insert into users(id,nickname,current_role,status,created_at,updated_at) values(?,?,?,'ACTIVE',current_timestamp,current_timestamp)", id, "region-contract", role);
        return "Bearer " + tokens.generateToken(id);
    }
    @Test void demandManualSelectionPublishesEditsAndFiltersCanonicalProvince() throws Exception {
        String bearer = user(9832101L,"CUSTOMER");
        String payload = """
          {"scene":"人像","cityCode":"南京市","location":"校园","timeDescription":"时间可协商","description":"省级地区契约测试","budgetMinCent":10000,"budgetMaxCent":20000}
          """;
        String body = mvc.perform(post("/demands").header("Authorization",bearer).contentType(MediaType.APPLICATION_JSON).content(payload))
            .andExpect(status().isOk()).andExpect(jsonPath("$.code").value(200)).andExpect(jsonPath("$.data.cityCode").value("JS"))
            .andReturn().getResponse().getContentAsString();
        long id=json.readTree(body).path("data").path("demandId").asLong();
        assertThat(demands.findById(id).orElseThrow().getCityCode()).isEqualTo("JS");
        mvc.perform(get("/demands").param("cityCode","江苏省").param("sort","latest").param("size","1"))
            .andExpect(jsonPath("$.data.total").value(1)).andExpect(jsonPath("$.data.records[0].cityCode").value("JS"));
        mvc.perform(get("/demands").param("cityCode","JS").param("sort","recommend"))
            .andExpect(jsonPath("$.data.total").value(1));
        mvc.perform(put("/demands/{id}",id).header("Authorization",bearer).contentType(MediaType.APPLICATION_JSON)
            .content(payload.replace("南京市","杭州市"))).andExpect(jsonPath("$.data.cityCode").value("ZJ"));
        mvc.perform(get("/demands").param("cityCode","JS").param("sort","latest")).andExpect(jsonPath("$.data.total").value(0));
        mvc.perform(post("/demands").header("Authorization",bearer).contentType(MediaType.APPLICATION_JSON)
            .content(payload.replace("南京市","unknown"))).andExpect(jsonPath("$.code").value(40001));
    }
    @Test void showcaseManualSelectionPublishesAndFiltersCanonicalProvince() throws Exception {
        String bearer=user(9832102L,"PROVIDER");
        // Public image compatibility field: synthetic HTTPS asset, never a production upload.
        String payload="""
          {"title":"地区契约橱窗","cityCode":"深圳市","scene":"人像","serviceArea":"校园","images":["https://example.com/test.jpg"],"basePriceCent":10000,"durationMinutes":60,"originalCount":10,"refinedCount":2,"deliveryDays":3,"timeDescription":"时间可协商"}
          """;
        String body=mvc.perform(post("/service-packages").header("Authorization",bearer).contentType(MediaType.APPLICATION_JSON).content(payload))
            .andExpect(jsonPath("$.code").value(200)).andReturn().getResponse().getContentAsString();
        long id=json.readTree(body).path("data").path("serviceId").asLong();
        assertThat(services.findById(id).orElseThrow().getCityCode()).isEqualTo("GD");
        mvc.perform(get("/service-packages").param("cityCode","广东省").param("sort","latest").param("size","1"))
            .andExpect(jsonPath("$.data.total").value(1)).andExpect(jsonPath("$.data.records[0].cityCode").value("GD"));
        mvc.perform(get("/service-packages").param("cityCode","GD").param("sort","recommend"))
            .andExpect(jsonPath("$.data.total").value(1));
        mvc.perform(put("/service-packages/{id}",id).header("Authorization",bearer).contentType(MediaType.APPLICATION_JSON)
            .content(payload.replace("深圳市","南京"))).andExpect(jsonPath("$.data.cityCode").value("JS"));
        mvc.perform(get("/service-packages").param("cityCode","GD").param("sort","latest")).andExpect(jsonPath("$.data.total").value(0));
    }
}
