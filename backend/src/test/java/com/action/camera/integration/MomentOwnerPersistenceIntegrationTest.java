package com.action.camera.integration;

import com.action.camera.support.TestAuthTokens;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** Each HTTP request commits independently; subsequent reads cannot reuse a test transaction. */
@SpringBootTest(properties = {
    "spring.http.client.factory=simple",
    "spring.datasource.url=jdbc:h2:mem:moment_owner_persistence;MODE=MySQL;DATABASE_TO_LOWER=TRUE;NON_KEYWORDS=CURRENT_ROLE;DB_CLOSE_DELAY=-1"
})
@AutoConfigureMockMvc
@ActiveProfiles("smoke")
class MomentOwnerPersistenceIntegrationTest {
    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;
    @Autowired TestAuthTokens tokens;
    @Autowired ObjectMapper json;
    private String author;
    private String peer;

    @BeforeEach void setup() throws Exception {
        author = login(9843101L);
        peer = login(9843102L);
    }
    private String login(long id) throws Exception {
        jdbc.update("merge into users(id,nickname,current_role,status,created_at,updated_at) key(id) values(?,?,'CUSTOMER','ACTIVE',current_timestamp,current_timestamp)", id, "moment-test");
        String bearer = "Bearer " + tokens.generateToken(id);
        mvc.perform(put("/privacy/consent").header("Authorization", bearer).contentType(MediaType.APPLICATION_JSON)
            .content(json.writeValueAsString(Map.of("status", "GRANTED", "privacyPolicyVersion", "2026-10-29-v1",
                "crossBorderConsentVersion", "2026-10-29-v1", "installationId", "moment-persistence-test", "acceptedAtEpochMs", System.currentTimeMillis()))))
            .andExpect(jsonPath("$.code").value(200));
        return bearer;
    }
    private long create() throws Exception {
        String body = mvc.perform(post("/moments").header("Authorization", author).contentType(MediaType.APPLICATION_JSON)
            .content(json.writeValueAsString(Map.of("title", "原题", "content", "原文", "imageDataList", List.of("image-a", "image-b"), "mentions", List.of("@保留")))))
            .andExpect(jsonPath("$.code").value(200)).andReturn().getResponse().getContentAsString();
        return json.readTree(body).path("data").path("momentId").asLong();
    }
    private void update(long id, Map<String, Object> payload) throws Exception {
        mvc.perform(put("/moments/{id}", id).header("Authorization", author).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(payload)))
            .andExpect(jsonPath("$.code").value(200));
    }
    @Test void editsCommitTextAlbumOrderAndMentionsAcrossRequests() throws Exception {
        long id = create();
        jdbc.update("update users set current_role='PROVIDER' where id=9843101");
        update(id, Map.of("title", "新题", "content", "新文", "imageDataList", List.of("image-c", "image-d"), "mentions", List.of("@新提及")));
        mvc.perform(get("/moments/{id}", id).header("Authorization", author))
            .andExpect(jsonPath("$.data.title").value("新题")).andExpect(jsonPath("$.data.content").value("新文"))
            .andExpect(jsonPath("$.data.imageDataList[0]").value("image-c")).andExpect(jsonPath("$.data.imageDataList[1]").value("image-d"))
            .andExpect(jsonPath("$.data.mentions[0]").value("@新提及"));
        assertThat(jdbc.queryForObject("select title from moment_posts where id=?", String.class, id)).isEqualTo("新题");
    }
    @Test void omittedAlbumAndMentionsPreserveExistingValues() throws Exception {
        long id = create();
        update(id, Map.of("title", "仅改文字", "content", "更新"));
        mvc.perform(get("/moments/{id}", id).header("Authorization", author))
            .andExpect(jsonPath("$.data.imageDataList.length()").value(2))
            .andExpect(jsonPath("$.data.mentions[0]").value("@保留"));
    }
    @Test void explicitEmptyAlbumIsSavedAndDoesNotReturnLegacyCover() throws Exception {
        long id = create();
        update(id, Map.of("title", "纯文字", "content", "已移除照片", "imageDataList", List.of(), "mentions", List.of()));
        mvc.perform(get("/moments/{id}", id).header("Authorization", author))
            .andExpect(jsonPath("$.data.imageDataList.length()").value(0)).andExpect(jsonPath("$.data.mentions.length()").value(0));
        assertThat(jdbc.queryForObject("select count(*) from moment_images where moment_id=?", Integer.class, id)).isZero();
    }
    @Test void deletionCommitsAndRemainsAbsentFromFeedProfileAndInteractions() throws Exception {
        long id = create();
        mvc.perform(put("/moments/{id}/favorite", id).header("Authorization", peer)).andExpect(jsonPath("$.code").value(200));
        mvc.perform(delete("/moments/{id}", id).header("Authorization", peer)).andExpect(jsonPath("$.code").value(40301));
        mvc.perform(delete("/moments/{id}", id).header("Authorization", author)).andExpect(jsonPath("$.code").value(200));
        assertThat(jdbc.queryForObject("select status from moment_posts where id=?", String.class, id)).isEqualTo("DELETED");
        mvc.perform(get("/moments/{id}", id).header("Authorization", author)).andExpect(jsonPath("$.data.status").value("DELETED"));
        mvc.perform(get("/moments/{id}", id).header("Authorization", peer)).andExpect(jsonPath("$.code").value(40401));
        for (String path : List.of("/moments", "/moments/profile?authorId=9843101&authorRole=CUSTOMER", "/moments/me/interactions?interaction=FAVORITED")) {
            String body = mvc.perform(get(path).header("Authorization", peer)).andExpect(jsonPath("$.code").value(200)).andReturn().getResponse().getContentAsString();
            assertThat(json.readTree(body).path("data").findValues("momentId")).noneMatch(value -> value.asLong() == id);
        }
    }
}
