package com.action.camera.servicepackage.controller;

import com.action.camera.common.Result;
import com.action.camera.common.page.PageResult;
import com.action.camera.common.security.CurrentUser;
import com.action.camera.common.security.CurrentUserProvider;
import com.action.camera.servicepackage.dto.ServicePackageCardDto;
import com.action.camera.servicepackage.dto.ServicePackageIntentState;
import org.springframework.web.bind.annotation.PathVariable;
import com.action.camera.servicepackage.service.ServicePackageService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class ServicePackageInterestController {

    private final ServicePackageService servicePackageService;
    private final CurrentUserProvider currentUserProvider;

    public ServicePackageInterestController(ServicePackageService servicePackageService,
                                            CurrentUserProvider currentUserProvider) {
        this.servicePackageService = servicePackageService;
        this.currentUserProvider = currentUserProvider;
    }

    @GetMapping("/service-packages/{serviceId}/intent-state")
    public Result<ServicePackageIntentState> getIntentState(@PathVariable Long serviceId,
                                                            HttpServletRequest request) {
        return Result.success(servicePackageService.getIntentState(serviceId,
                currentUserProvider.getCurrentUser(request)));
    }

    @GetMapping("/me/service-package-interests")
    public Result<PageResult<ServicePackageCardDto>> listMyInterests(@RequestParam(defaultValue = "1") int page,
                                                                     @RequestParam(defaultValue = "10") int size,
                                                                     @RequestParam(required = false) String timeTag,
                                                                     HttpServletRequest httpRequest) {
        CurrentUser currentUser = currentUserProvider.getCurrentUser(httpRequest);
        return Result.success(servicePackageService.listMyInterests(currentUser, page, size, timeTag));
    }
}
