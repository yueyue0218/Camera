package com.action.camera.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@AllArgsConstructor
public class SwitchRoleResponse {
    private Long id;
    private String currentRole;
    private String nickname;
}
