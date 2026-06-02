package com.action.camera.demand;

import com.action.camera.common.exception.BusinessException;
import com.action.camera.common.security.CurrentUser;
import com.action.camera.common.security.MockCurrentUserProvider;
import com.action.camera.common.security.UserRole;
import com.action.camera.demand.controller.DemandController;
import com.action.camera.demand.domain.DemandResponseStatus;
import com.action.camera.demand.domain.DemandStatus;
import com.action.camera.demand.dto.AcceptDemandResponseResult;
import com.action.camera.demand.dto.CreateDemandRequest;
import com.action.camera.demand.dto.CreateDemandResponseRequest;
import com.action.camera.demand.dto.DemandDto;
import com.action.camera.demand.dto.DemandResponseDto;
import com.action.camera.demand.repository.DemandRepository;
import com.action.camera.demand.repository.DemandResponseRepository;
import com.action.camera.demand.service.DemandService;
import com.action.camera.message.model.CreateConversationCommand;
import com.action.camera.message.model.CreateConversationResult;
import com.action.camera.message.service.ConversationService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.time.LocalDate;
import java.util.Arrays;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

@SpringBootTest
@TestPropertySource(properties = {
        "spring.datasource.url=jdbc:h2:mem:demand_handoff_test;MODE=MySQL;DATABASE_TO_LOWER=TRUE;CASE_INSENSITIVE_IDENTIFIERS=TRUE;NON_KEYWORDS=CURRENT_ROLE;DB_CLOSE_DELAY=-1",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "spring.jpa.properties.hibernate.dialect=org.hibernate.dialect.H2Dialect"
})
class DemandConversationHandoffTest {

    private static final CurrentUser CUSTOMER = new CurrentUser(1001L, UserRole.CUSTOMER);
    private static final CurrentUser OTHER_CUSTOMER = new CurrentUser(1002L, UserRole.CUSTOMER);
    private static final CurrentUser PROVIDER = new CurrentUser(2001L, UserRole.PROVIDER);
    private static final CurrentUser OTHER_PROVIDER = new CurrentUser(2002L, UserRole.PROVIDER);

    @MockBean
    private ConversationService conversationService;

    @Autowired
    private DemandRepository demandRepository;

    @Autowired
    private DemandResponseRepository responseRepository;

    @Autowired
    private DemandService demandService;

    @BeforeEach
    void setUp() {
        responseRepository.deleteAll();
        demandRepository.deleteAll();
    }

    @Test
    void customerCanPublishOpenDemand() {
        DemandDto demand = demandService.createDemand(CUSTOMER, demandRequest());

        assertThat(demand.getDemandId()).isNotNull();
        assertThat(demand.getStatus()).isEqualTo(DemandStatus.OPEN.name());
        assertThat(demandRepository.findById(demand.getDemandId())).isPresent();
        assertThat(demandRepository.findById(demand.getDemandId()).orElseThrow().getStatus())
                .isEqualTo(DemandStatus.OPEN);
    }

    @Test
    void providerResponseCreatesPendingDemandResponseWithoutConversation() {
        DemandDto demand = demandService.createDemand(CUSTOMER, demandRequest());

        DemandResponseDto response = demandService.respondToDemand(
                demand.getDemandId(),
                PROVIDER,
                responseRequest("I can cover this shoot.")
        );

        assertThat(response.getResponseId()).isNotNull();
        assertThat(response.getStatus()).isEqualTo(DemandResponseStatus.PENDING_CUSTOMER_ACCEPT.name());
        assertThat(demandRepository.findById(demand.getDemandId()).orElseThrow().getResponseCount())
                .isEqualTo(1);
        verify(conversationService, never()).createConversationWithInitialMessage(any());
    }

    @Test
    void customerAcceptingResponseCreatesDemandResponseConversationAndReturnsConversationId() {
        DemandDto demand = demandService.createDemand(CUSTOMER, demandRequest());
        DemandResponseDto accepted = demandService.respondToDemand(
                demand.getDemandId(),
                PROVIDER,
                responseRequest("Available with natural light.")
        );
        DemandResponseDto rejected = demandService.respondToDemand(
                demand.getDemandId(),
                OTHER_PROVIDER,
                responseRequest("Available with studio lights.")
        );
        when(conversationService.createConversationWithInitialMessage(any(CreateConversationCommand.class)))
                .thenReturn(new CreateConversationResult(9001L));

        AcceptDemandResponseResult result = demandService.acceptResponse(
                demand.getDemandId(),
                accepted.getResponseId(),
                CUSTOMER
        );

        assertThat(result.getConversationId()).isEqualTo(9001L);
        assertThat(result.getConversationSourceType()).isEqualTo(ConversationService.SOURCE_TYPE_DEMAND_RESPONSE);
        assertThat(result.getSourceId()).isEqualTo(accepted.getResponseId());
        assertThat(demandRepository.findById(demand.getDemandId()).orElseThrow().getStatus())
                .isEqualTo(DemandStatus.MATCHED);
        assertThat(responseRepository.findById(accepted.getResponseId()).orElseThrow().getStatus())
                .isEqualTo(DemandResponseStatus.ACCEPTED);
        assertThat(responseRepository.findById(rejected.getResponseId()).orElseThrow().getStatus())
                .isEqualTo(DemandResponseStatus.REJECTED);

        ArgumentCaptor<CreateConversationCommand> commandCaptor =
                ArgumentCaptor.forClass(CreateConversationCommand.class);
        verify(conversationService, times(1)).createConversationWithInitialMessage(commandCaptor.capture());
        CreateConversationCommand command = commandCaptor.getValue();
        assertThat(command.getCustomerId()).isEqualTo(CUSTOMER.getUserId());
        assertThat(command.getProviderId()).isEqualTo(PROVIDER.getUserId());
        assertThat(command.getInitiatorId()).isEqualTo(CUSTOMER.getUserId());
        assertThat(command.getSourceType()).isEqualTo(ConversationService.SOURCE_TYPE_DEMAND_RESPONSE);
        assertThat(command.getSourceId()).isEqualTo(accepted.getResponseId());
        assertThat(command.getInitialMessage()).isNotBlank();
    }

    @Test
    void nonOwnerCustomerCannotAcceptResponseOrCreateConversation() {
        DemandDto demand = demandService.createDemand(CUSTOMER, demandRequest());
        DemandResponseDto response = demandService.respondToDemand(
                demand.getDemandId(),
                PROVIDER,
                responseRequest("Available.")
        );

        assertThatThrownBy(() -> demandService.acceptResponse(
                demand.getDemandId(),
                response.getResponseId(),
                OTHER_CUSTOMER
        )).isInstanceOf(BusinessException.class);

        assertThat(demandRepository.findById(demand.getDemandId()).orElseThrow().getStatus())
                .isEqualTo(DemandStatus.OPEN);
        assertThat(responseRepository.findById(response.getResponseId()).orElseThrow().getStatus())
                .isEqualTo(DemandResponseStatus.PENDING_CUSTOMER_ACCEPT);
        verify(conversationService, never()).createConversationWithInitialMessage(any());
    }

    @Test
    void matchedDemandCannotAcceptAnotherPendingResponseOrCreateDuplicateConversation() {
        DemandDto demand = demandService.createDemand(CUSTOMER, demandRequest());
        DemandResponseDto first = demandService.respondToDemand(
                demand.getDemandId(),
                PROVIDER,
                responseRequest("First response.")
        );
        DemandResponseDto second = demandService.respondToDemand(
                demand.getDemandId(),
                OTHER_PROVIDER,
                responseRequest("Second response.")
        );
        when(conversationService.createConversationWithInitialMessage(any(CreateConversationCommand.class)))
                .thenReturn(new CreateConversationResult(9001L));
        demandService.acceptResponse(demand.getDemandId(), first.getResponseId(), CUSTOMER);

        assertThatThrownBy(() -> demandService.acceptResponse(
                demand.getDemandId(),
                second.getResponseId(),
                CUSTOMER
        )).isInstanceOf(BusinessException.class);

        assertThat(demandRepository.findById(demand.getDemandId()).orElseThrow().getStatus())
                .isEqualTo(DemandStatus.MATCHED);
        assertThat(responseRepository.findById(first.getResponseId()).orElseThrow().getStatus())
                .isEqualTo(DemandResponseStatus.ACCEPTED);
        assertThat(responseRepository.findById(second.getResponseId()).orElseThrow().getStatus())
                .isEqualTo(DemandResponseStatus.REJECTED);
        verify(conversationService, times(1)).createConversationWithInitialMessage(any());
    }

    @Test
    void demandControllerDoesNotCreateConversationDirectly() {
        List<String> fieldTypes = Arrays.stream(DemandController.class.getDeclaredFields())
                .map(field -> field.getType().getSimpleName())
                .toList();

        assertThat(fieldTypes)
                .contains("DemandService")
                .doesNotContain("ConversationService", "MessageService", "ConversationRepository");
    }

    @Test
    void invitationEndpointsAreNotMappedAndCannotCreateResponsesOrConversations() throws Exception {
        DemandDto demand = demandService.createDemand(CUSTOMER, demandRequest());
        MockMvc mockMvc = MockMvcBuilders
                .standaloneSetup(new DemandController(demandService, new MockCurrentUserProvider()))
                .build();

        List<MockHttpServletRequestBuilder> invitationRequests = List.of(
                post("/demands/{demandId}/invitations", demand.getDemandId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"),
                get("/demands/invitations/received"),
                get("/demands/invitations/sent"),
                post("/demands/invitations/{invitationId}/accept", 7001L),
                post("/demands/invitations/{invitationId}/reject", 7001L)
        );

        for (MockHttpServletRequestBuilder request : invitationRequests) {
            int status = mockMvc.perform(request
                            .header("X-User-Id", CUSTOMER.getUserId())
                            .header("X-User-Role", CUSTOMER.getRole().name()))
                    .andReturn()
                    .getResponse()
                    .getStatus();
            assertThat(status).isBetween(400, 499);
            assertThat(status).isNotEqualTo(200);
        }
        assertThat(responseRepository.findByDemandId(demand.getDemandId())).isEmpty();
        verify(conversationService, never()).createConversationWithInitialMessage(any());
    }

    private CreateDemandRequest demandRequest() {
        CreateDemandRequest request = new CreateDemandRequest();
        request.setScene("GRADUATION");
        request.setCityCode("NJ");
        request.setLocation("NJU campus");
        request.setExpectedDate(LocalDate.of(2026, 7, 1));
        request.setTimeSlot("AFTERNOON");
        request.setBudgetMinCent(30000);
        request.setBudgetMaxCent(60000);
        request.setStyleTags(List.of("natural", "campus"));
        request.setDescription("Graduation portrait demand.");
        request.setReferenceFileIds(List.of(11L, 12L));
        return request;
    }

    private CreateDemandResponseRequest responseRequest(String message) {
        CreateDemandResponseRequest request = new CreateDemandResponseRequest();
        request.setProviderProfileId(PROVIDER.getUserId());
        request.setMessage(message);
        request.setExpectedPriceCent(39900);
        return request;
    }
}
