package com.action.camera.demand.controller;

import com.action.camera.common.Result;
import com.action.camera.common.page.PageResult;
import com.action.camera.common.security.CurrentUserProvider;
import com.action.camera.demand.dto.DemandInterestDto;
import com.action.camera.demand.service.DemandInterestService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.bind.annotation.*;

@RestController
public class DemandInterestController {
    private final DemandInterestService service;
    private final CurrentUserProvider currentUser;
    public DemandInterestController(DemandInterestService service, CurrentUserProvider currentUser) {
        this.service = service; this.currentUser = currentUser;
    }
    @PostMapping("/demands/{demandId}/interest")
    public Result<DemandInterestDto> add(@PathVariable Long demandId, HttpServletRequest request) {
        return Result.success(service.add(demandId, currentUser.getCurrentUser(request)));
    }
    @DeleteMapping("/demands/{demandId}/interest")
    public Result<Void> remove(@PathVariable Long demandId, HttpServletRequest request) {
        service.remove(demandId, currentUser.getCurrentUser(request)); return Result.success(null);
    }
    @GetMapping("/demands/{demandId}/interest")
    public Result<DemandInterestDto> state(@PathVariable Long demandId, HttpServletRequest request) {
        return Result.success(service.state(demandId, currentUser.getCurrentUser(request)));
    }
    @GetMapping("/me/demand-interests")
    public Result<PageResult<DemandInterestDto>> list(@RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int size, HttpServletRequest request) {
        return Result.success(service.list(currentUser.getCurrentUser(request), page, size));
    }
}
