package com.action.camera.integration;
import com.action.camera.notification.repository.NotificationRepository;
import com.action.camera.notification.service.NotificationService;
import com.fasterxml.jackson.databind.JsonNode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.http.HttpHeaders;
import java.util.List;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.Mockito.doThrow;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;

/** Real H2 transactions/HTTP serialization. Admin is test-framework context only, never a live fixture. */
class ReportNotificationPrivacyTest extends ReportClosureIntegrationTest {
 @Autowired NotificationRepository notifications;
 @MockitoSpyBean NotificationService notificationService;
 @BeforeEach void clearNotices(){notifications.deleteAll();}
 private JsonNode notices(String token)throws Exception {
   return json.readTree(mvc.perform(get("/notifications").header(HttpHeaders.AUTHORIZATION,"Bearer "+token))
     .andReturn().getResponse().getContentAsString()).path("data").path("records");
 }
 @Test void successfulActionNotifiesBothAudiencesAndSerializedTargetCannotRevealReporter()throws Exception{
   long targetId=target("DEMAND"), reportId=create("DEMAND",targetId);
   resolve(reportId,"TAKE_DOWN",adminToken,200);
   JsonNode mine=notices(reporterToken),theirs=notices(ownerToken);
   assertThat(mine.size()).isEqualTo(1);assertThat(theirs.size()).isEqualTo(1);
   assertThat(mine.get(0).path("relatedId").asLong()).isEqualTo(reportId);
   JsonNode n=theirs.get(0);assertThat(n.path("type").asText()).isEqualTo("MODERATION_RESULT");
   assertThat(n.path("eventType").asText()).isEqualTo("MODERATION_RESULT");
   assertThat(n.path("actorUserId").isNull()).isTrue();assertThat(n.path("relatedType").asText()).isEqualTo("DEMAND");
   for(String field:List.of("relatedId","targetId","sourceId")){assertThat(n.path(field).asLong()).isEqualTo(targetId);}
   assertThat(n.path("sourceType").asText()).isEqualTo("DEMAND");
   assertThat(n.path("dedupeKey").asText()).matches("moderation:[0-9a-f-]{36}");
   JsonNode meta=json.readTree(n.path("metadataJson").asText());
   var keys=new java.util.ArrayList<String>();meta.fieldNames().forEachRemaining(keys::add);
   assertThat(keys).containsExactlyInAnyOrder("action","targetType","targetId");
   assertThat(n.toString()).doesNotContain("reporter","reportId","adminComment","reviewed","details");
   assertThat(n.path("navigationPath").isNull()).isTrue();
   JsonNode own=json.readTree(mvc.perform(get("/reports/my").header(HttpHeaders.AUTHORIZATION,"Bearer "+reporterToken)).andReturn().getResponse().getContentAsString()).path("data").get(0);
   assertThat(own.path("publicOutcome").asText()).isEqualTo("ACTION_TAKEN");
   assertThat(own.path("adminComment").isNull()).isTrue();assertThat(own.path("adminId").isNull()).isTrue();
   resolve(reportId,"TAKE_DOWN",adminToken,40901);assertThat(notifications.count()).isEqualTo(2);
 }
 @Test void ignoredReportRecordsFollowUpWithoutTargetNoticeOrPenalty()throws Exception{
   long id=target("DEMAND"),reportId=create("DEMAND",id);resolve(reportId,"IGNORE",adminToken,200);
   assertThat(notices(ownerToken)).isEmpty();JsonNode mine=notices(reporterToken);assertThat(mine.size()).isEqualTo(1);
   assertThat(mine.get(0).path("content").asText()).contains("已收到并记录","后续会重点关注");
   assertThat(demands.findById(id).orElseThrow().getModerationStatus().name()).isEqualTo("VISIBLE");
   JsonNode own=json.readTree(mvc.perform(get("/reports/my").header(HttpHeaders.AUTHORIZATION,"Bearer "+reporterToken)).andReturn().getResponse().getContentAsString()).path("data").get(0);
   assertThat(own.path("followUpRecorded").asBoolean()).isTrue();assertThat(own.path("publicOutcome").asText()).isEqualTo("FOLLOW_UP");
 }
 @Test void failedSecondNotificationRollsBackFirstNotificationReportAndActualAction()throws Exception{
   long id=target("DEMAND"),reportId=create("DEMAND",id);
   doThrow(new IllegalStateException("injected target notification failure")).when(notificationService)
     .createNotification(argThat(r->r!=null&&"MODERATION_RESULT".equals(r.type())));
   resolve(reportId,"TAKE_DOWN",adminToken,50001);
   assertThat(notifications.count()).isZero();assertThat(reports.findById(reportId).orElseThrow().getStatus().name()).isEqualTo("PENDING");
   assertThat(demands.findById(id).orElseThrow().getModerationStatus().name()).isEqualTo("VISIBLE");
 }
 @Test void restrictedAccountNoticePersistsButExistingAuthStillPreventsReading()throws Exception{
   long reportId=create("USER",owner.getId());resolve(reportId,"RESTRICT_USER",adminToken,200);
   assertThat(notifications.findByUserIdOrderByCreatedAtDesc(owner.getId())).hasSize(1);
   JsonNode response=json.readTree(mvc.perform(get("/notifications").header(HttpHeaders.AUTHORIZATION,"Bearer "+ownerToken)).andReturn().getResponse().getContentAsString());
   assertThat(response.path("code").asInt()).isEqualTo(40101);
 }
 @Test void ownerDetailDoesNotExposeInternalReportNote()throws Exception {
   long id=target("DEMAND"),reportId=create("DEMAND",id);resolve(reportId,"TAKE_DOWN",adminToken,200);
   JsonNode response=json.readTree(mvc.perform(get("/demands/"+id).header(HttpHeaders.AUTHORIZATION,"Bearer "+ownerToken)).andReturn().getResponse().getContentAsString());
   assertThat(response.path("code").asInt()).isEqualTo(200);
   assertThat(response.path("data").toString()).doesNotContain("reviewed");
   assertThat(reports.findById(reportId).orElseThrow().getAdminComment()).isEqualTo("reviewed");
 }

}
