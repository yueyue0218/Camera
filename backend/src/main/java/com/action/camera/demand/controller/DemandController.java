package com.action.camera.demand.controller;

import com.action.camera.common.Result;
import com.action.camera.common.page.PageResult;
import com.action.camera.common.security.CurrentUser;
import com.action.camera.common.security.MockCurrentUserProvider;
import com.action.camera.demand.dto.AcceptDemandResponseResult;
import com.action.camera.demand.dto.AcceptedDemandResponseSnapshot;
import com.action.camera.demand.dto.CreateDemandInvitationRequest;
import com.action.camera.demand.dto.CreateDemandRequest;
import com.action.camera.demand.dto.CreateDemandResponseRequest;
import com.action.camera.demand.dto.DemandDto;
import com.action.camera.demand.dto.DemandInvitationDto;
import com.action.camera.demand.dto.DemandResponseDto;
import com.action.camera.demand.service.DemandService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/demands")
public class DemandController {

    private final DemandService demandService;
    private final MockCurrentUserProvider currentUserProvider;

    public DemandController(DemandService demandService, MockCurrentUserProvider currentUserProvider) {
        this.demandService = demandService;
        this.currentUserProvider = currentUserProvider;
    }

    @PostMapping
    public Result<DemandDto> createDemand(@RequestBody CreateDemandRequest request,
                                          HttpServletRequest httpRequest) {
        CurrentUser currentUser = currentUserProvider.getCurrentUser(httpRequest);
        return Result.success(demandService.createDemand(currentUser, request));
    }

    @GetMapping
    public Result<PageResult<DemandDto>> listDemands(@RequestParam(defaultValue = "1") int page,
                                                     @RequestParam(defaultValue = "10") int size,
                                                     @RequestParam(required = false) String cityCode,
                                                     @RequestParam(required = false) String scene,
                                                     @RequestParam(required = false) String status,
                                                     @RequestParam(required = false) LocalDate expectedDate,
                                                     @RequestParam(required = false) String styleTag,
                                                     @RequestParam(required = false) Integer minBudgetCent,
                                                     @RequestParam(required = false) Integer maxBudgetCent) {
        return Result.success(demandService.listDemands(page, size, cityCode, scene, status,
                expectedDate, styleTag, minBudgetCent, maxBudgetCent));
    }

    @GetMapping("/{demandId}")
    public Result<DemandDto> getDemand(@PathVariable Long demandId,
                                       HttpServletRequest httpRequest) {
        CurrentUser currentUser = currentUserProvider.getCurrentUser(httpRequest);
        return Result.success(demandService.getDemand(demandId, currentUser));
    }

    @DeleteMapping("/{demandId}")
    public Result<Void> deleteDemand(@PathVariable Long demandId,
                                     HttpServletRequest httpRequest) {
        CurrentUser currentUser = currentUserProvider.getCurrentUser(httpRequest);
        demandService.deleteDemand(demandId, currentUser);
        return Result.success(null);
    }

    @PostMapping("/{demandId}/responses")
    public Result<DemandResponseDto> respondToDemand(@PathVariable Long demandId,
                                                     @RequestBody CreateDemandResponseRequest request,
                                                     HttpServletRequest httpRequest) {
        CurrentUser currentUser = currentUserProvider.getCurrentUser(httpRequest);
        return Result.success(demandService.respondToDemand(demandId, currentUser, request));
    }

    @PostMapping("/{demandId}/invitations")
    public Result<DemandInvitationDto> createInvitation(@PathVariable Long demandId,
                                                       @RequestBody CreateDemandInvitationRequest request,
                                                       HttpServletRequest httpRequest) {
        CurrentUser currentUser = currentUserProvider.getCurrentUser(httpRequest);
        return Result.success(demandService.createInvitation(demandId, currentUser, request));
    }

    @GetMapping("/invitations/received")
    public Result<List<DemandInvitationDto>> listReceivedInvitations(HttpServletRequest httpRequest) {
        CurrentUser currentUser = currentUserProvider.getCurrentUser(httpRequest);
        return Result.success(demandService.listReceivedInvitations(currentUser));
    }

    @GetMapping("/invitations/sent")
    public Result<List<DemandInvitationDto>> listSentInvitations(HttpServletRequest httpRequest) {
        CurrentUser currentUser = currentUserProvider.getCurrentUser(httpRequest);
        return Result.success(demandService.listSentInvitations(currentUser));
    }

    @PostMapping("/invitations/{invitationId}/accept")
    public Result<AcceptDemandResponseResult> acceptInvitation(@PathVariable Long invitationId,
                                                               HttpServletRequest httpRequest) {
        CurrentUser currentUser = currentUserProvider.getCurrentUser(httpRequest);
        return Result.success(demandService.acceptInvitation(invitationId, currentUser));
    }

    @PostMapping("/invitations/{invitationId}/reject")
    public Result<DemandInvitationDto> rejectInvitation(@PathVariable Long invitationId,
                                                       HttpServletRequest httpRequest) {
        CurrentUser currentUser = currentUserProvider.getCurrentUser(httpRequest);
        return Result.success(demandService.rejectInvitation(invitationId, currentUser));
    }

    @GetMapping("/{demandId}/responses")
    public Result<List<DemandResponseDto>> listResponses(@PathVariable Long demandId,
                                                         HttpServletRequest httpRequest) {
        CurrentUser currentUser = currentUserProvider.getCurrentUser(httpRequest);
        return Result.success(demandService.listResponses(demandId, currentUser));
    }

    @PostMapping("/{demandId}/responses/{responseId}/accept")
    public Result<AcceptDemandResponseResult> acceptResponse(@PathVariable Long demandId,
                                                             @PathVariable Long responseId,
                                                             HttpServletRequest httpRequest) {
        CurrentUser currentUser = currentUserProvider.getCurrentUser(httpRequest);
        return Result.success(demandService.acceptResponse(demandId, responseId, currentUser));
    }

    @GetMapping("/responses/{responseId}/accepted-snapshot")
    public Result<AcceptedDemandResponseSnapshot> getAcceptedSnapshot(@PathVariable Long responseId,
                                                                      HttpServletRequest httpRequest) {
        CurrentUser currentUser = currentUserProvider.getCurrentUser(httpRequest);
        return Result.success(demandService.getAcceptedSnapshot(responseId, currentUser));
    }
}
