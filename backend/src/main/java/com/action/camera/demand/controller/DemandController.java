package com.action.camera.demand.controller;

import com.action.camera.common.Result;
import com.action.camera.common.page.PageResult;
import com.action.camera.common.security.CurrentUser;
import com.action.camera.common.security.MockCurrentUserProvider;
import com.action.camera.demand.dto.AcceptDemandResponseResult;
import com.action.camera.demand.dto.AcceptedDemandResponseSnapshot;
import com.action.camera.demand.dto.CreateDemandRequest;
import com.action.camera.demand.dto.CreateDemandResponseRequest;
import com.action.camera.demand.dto.DemandDto;
import com.action.camera.demand.dto.DemandResponseDto;
import com.action.camera.demand.service.DemandService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
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
                                                     @RequestParam(required = false) Integer maxBudgetCent,
                                                     @RequestParam(required = false) String timeTag) {
        return Result.success(demandService.listDemands(page, size, cityCode, scene, status,
                expectedDate, styleTag, minBudgetCent, maxBudgetCent, timeTag));
    }

    @GetMapping("/me/history")
    public Result<List<DemandDto>> listMyDemandHistory(HttpServletRequest httpRequest) {
        CurrentUser currentUser = currentUserProvider.getCurrentUser(httpRequest);
        return Result.success(demandService.listMyDemandHistory(currentUser));
    }

    @GetMapping("/{demandId}")
    public Result<DemandDto> getDemand(@PathVariable Long demandId,
                                       HttpServletRequest httpRequest) {
        CurrentUser currentUser = currentUserProvider.getCurrentUserIfPresent(httpRequest).orElse(null);
        return Result.success(demandService.getDemand(demandId, currentUser));
    }

    @PutMapping("/{demandId}")
    public Result<DemandDto> updateDemand(@PathVariable Long demandId,
                                          @RequestBody CreateDemandRequest request,
                                          HttpServletRequest httpRequest) {
        CurrentUser currentUser = currentUserProvider.getCurrentUser(httpRequest);
        return Result.success(demandService.updateDemand(demandId, currentUser, request));
    }

    @PatchMapping("/{demandId}/close")
    public Result<DemandDto> closeDemand(@PathVariable Long demandId,
                                         HttpServletRequest httpRequest) {
        CurrentUser currentUser = currentUserProvider.getCurrentUser(httpRequest);
        return Result.success(demandService.closeDemand(demandId, currentUser));
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

    @GetMapping("/{demandId}/responses")
    public Result<List<DemandResponseDto>> listResponses(@PathVariable Long demandId,
                                                         HttpServletRequest httpRequest) {
        CurrentUser currentUser = currentUserProvider.getCurrentUser(httpRequest);
        return Result.success(demandService.listResponses(demandId, currentUser));
    }

    @GetMapping("/responses/me")
    public Result<List<DemandResponseDto>> listMyResponses(HttpServletRequest httpRequest) {
        CurrentUser currentUser = currentUserProvider.getCurrentUser(httpRequest);
        return Result.success(demandService.listMyResponses(currentUser));
    }

    @GetMapping("/responses/received")
    public Result<List<DemandResponseDto>> listReceivedResponses(HttpServletRequest httpRequest) {
        CurrentUser currentUser = currentUserProvider.getCurrentUser(httpRequest);
        return Result.success(demandService.listReceivedResponses(currentUser));
    }

    @PostMapping("/{demandId}/responses/{responseId}/accept")
    public Result<AcceptDemandResponseResult> acceptResponse(@PathVariable Long demandId,
                                                             @PathVariable Long responseId,
                                                             HttpServletRequest httpRequest) {
        CurrentUser currentUser = currentUserProvider.getCurrentUser(httpRequest);
        return Result.success(demandService.acceptResponse(demandId, responseId, currentUser));
    }

    @PostMapping("/{demandId}/responses/{responseId}/reject")
    public Result<DemandResponseDto> rejectResponse(@PathVariable Long demandId,
                                                    @PathVariable Long responseId,
                                                    HttpServletRequest httpRequest) {
        CurrentUser currentUser = currentUserProvider.getCurrentUser(httpRequest);
        return Result.success(demandService.rejectResponse(demandId, responseId, currentUser));
    }

    @GetMapping("/responses/{responseId}/accepted-snapshot")
    public Result<AcceptedDemandResponseSnapshot> getAcceptedSnapshot(@PathVariable Long responseId,
                                                                      HttpServletRequest httpRequest) {
        CurrentUser currentUser = currentUserProvider.getCurrentUser(httpRequest);
        return Result.success(demandService.getAcceptedSnapshot(responseId, currentUser));
    }
}
