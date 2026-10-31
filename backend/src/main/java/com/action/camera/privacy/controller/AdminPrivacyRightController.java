package com.action.camera.privacy.controller;

import com.action.camera.common.Result;
import com.action.camera.common.page.PageResult;
import com.action.camera.privacy.dto.PrivacyDtos.*;
import com.action.camera.privacy.service.PrivacyRightService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

@RestController @RequestMapping("/admin/privacy-rights")
public class AdminPrivacyRightController {
    private final PrivacyRightService rights;
    public AdminPrivacyRightController(PrivacyRightService rights) { this.rights=rights; }
    @GetMapping public Result<PageResult<RightView>> list(@RequestParam(required=false) String status,
            @RequestParam(defaultValue="1") int page,@RequestParam(defaultValue="20") int size) {
        return Result.success(rights.adminList(status,page,size));
    }
    @PatchMapping("/{id}") public Result<RightView> update(@PathVariable Long id,@Valid @RequestBody RightUpdate input) {
        return Result.success(rights.resolve(id,input));
    }
}
