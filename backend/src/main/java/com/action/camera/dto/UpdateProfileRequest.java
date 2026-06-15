package com.action.camera.dto;

public class UpdateProfileRequest {

    private String nickname;
    private String bio;
    private String availability;
    private String role;
    private Long avatarFileId;
    private String cityCode;
    private String gender;
    private Boolean genderVisible;
    private String birthday;
    private Boolean birthdayVisible;
    private String locationDisplay;
    private Boolean locationVisible;

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

    public String getGender() { return gender; }
    public void setGender(String gender) { this.gender = gender; }

    public Boolean getGenderVisible() { return genderVisible; }
    public void setGenderVisible(Boolean genderVisible) { this.genderVisible = genderVisible; }

    public String getBirthday() { return birthday; }
    public void setBirthday(String birthday) { this.birthday = birthday; }

    public Boolean getBirthdayVisible() { return birthdayVisible; }
    public void setBirthdayVisible(Boolean birthdayVisible) { this.birthdayVisible = birthdayVisible; }

    public String getLocationDisplay() { return locationDisplay; }
    public void setLocationDisplay(String locationDisplay) { this.locationDisplay = locationDisplay; }

    public Boolean getLocationVisible() { return locationVisible; }
    public void setLocationVisible(Boolean locationVisible) { this.locationVisible = locationVisible; }
}
