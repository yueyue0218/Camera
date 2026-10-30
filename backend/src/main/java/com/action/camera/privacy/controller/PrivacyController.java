package com.action.camera.privacy.controller;

import com.action.camera.account.service.SelfAccountClosureService;
import com.action.camera.common.*;
import com.action.camera.common.page.PageResult;
import com.action.camera.privacy.dto.PrivacyDtos.*;
import com.action.camera.privacy.service.*;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

@RestController @RequestMapping("/privacy")
public class PrivacyController {
    private final PrivacyConsentService consent;
    private final PrivacyRightService rights;
    private final SelfAccountClosureService closure;
    public PrivacyController(PrivacyConsentService consent,PrivacyRightService rights,SelfAccountClosureService closure) {
        this.consent=consent; this.rights=rights; this.closure=closure;
    }
    @GetMapping("/consent") public Result<ConsentView> consent() {
        return Result.success(consent.current(UserContext.getUserId()));
    }
    @PutMapping("/consent") public Result<ConsentView> consent(@Valid @RequestBody ConsentUpdate input) {
        return Result.success(consent.update(UserContext.getUserId(),input));
    }
    @PostMapping("/rights") public Result<RightView> submit(@Valid @RequestBody RightCreate input) {
        return Result.success(rights.submit(UserContext.getUserId(),input));
    }
    @GetMapping("/rights") public Result<PageResult<RightView>> mine(@RequestParam(defaultValue="1") int page,@RequestParam(defaultValue="20") int size) {
        return Result.success(rights.mine(UserContext.getUserId(),page,size));
    }
    @PostMapping("/account-closure/code") public Result<Boolean> code(@Valid @RequestBody ClosureCode input,HttpServletRequest request) {
        closure.sendCode(UserContext.getUserId(),input,request.getRemoteAddr()); return Result.success(true);
    }
    @PostMapping("/account-closure") public Result<ClosureView> close(@Valid @RequestBody ClosureConfirm input) {
        return Result.success(closure.close(UserContext.getUserId(),input));
    }
}
