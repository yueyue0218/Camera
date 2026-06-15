package com.action.camera.dto;

public class UpdateProfileRequest {

    private String nickname;
    private String bio;
    private String availability;
    private String role;
    private Long avatarFileId;
    private String cityCode;

    public String getNickname() { return nickname; }
    public void setNickname(String nickname) { this.nickname = nickname; }

    public String getBio() { return bio; }
    public void setBio(String bio) { this.bio = bio; }

    public String getAvailability() { return availability; }
    public void setAvailability(String availability) { this.availability = availability; }

    public String getRole() { return role; }
    public void setRole(String role) { this.role = role; }

    public Long getAvatarFileId() { return avatarFileId; }
    public void setAvatarFileId(Long avatarFileId) { this.avatarFileId = avatarFileId; }

    public String getCityCode() { return cityCode; }
    public void setCityCode(String cityCode) { this.cityCode = cityCode; }
}
