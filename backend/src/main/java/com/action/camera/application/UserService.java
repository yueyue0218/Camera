package com.action.camera.application;

import com.action.camera.common.ErrorCode;
import com.action.camera.common.JwtUtil;
import com.action.camera.common.exception.BusinessException;
import com.action.camera.common.security.UserRole;
import com.action.camera.credit.service.CreditSnapshotService;
import com.action.camera.domain.User;
import com.action.camera.dto.LoginResponse;
import com.action.camera.dto.SwitchRoleResponse;
import com.action.camera.dto.UpdateProfileRequest;
import com.action.camera.dto.UserBriefResponse;
import com.action.camera.dto.UserProfileResponse;
import com.action.camera.provider.entity.ProviderProfile;
import com.action.camera.provider.mapper.ProviderProfileMapper;
import com.action.camera.repository.UserRepository;
import com.action.camera.repository.UserRoleBindingRepository;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class UserService {

    private final UserRepository userRepository;
    private final VerificationCodeService codeService;
    private final JwtUtil jwtUtil;
    private final ProviderProfileMapper providerProfileMapper;
    private final IpLocationService ipLocationService;
    private final UserRoleBindingRepository userRoleBindingRepository;
    private final CreditSnapshotService creditSnapshotService;
    private final BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder();

    public UserService(UserRepository userRepository,
                       VerificationCodeService codeService,
                       JwtUtil jwtUtil,
                       ProviderProfileMapper providerProfileMapper,
                       IpLocationService ipLocationService,
                       UserRoleBindingRepository userRoleBindingRepository,
                       CreditSnapshotService creditSnapshotService) {
        this.userRepository = userRepository;
        this.codeService = codeService;
        this.jwtUtil = jwtUtil;
        this.providerProfileMapper = providerProfileMapper;
        this.ipLocationService = ipLocationService;
        this.userRoleBindingRepository = userRoleBindingRepository;
        this.creditSnapshotService = creditSnapshotService;
    }

    @Transactional
    public void register(String email, String code, String password, String nickname, String role) {
        codeService.verify(email, code);

        String studentNo = email.substring(0, 9);

        if (userRepository.existsByStudentNo(studentNo)) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "该学号已注册");
        }

        User user = new User();
        user.setStudentNo(studentNo);
        user.setPasswordHash(passwordEncoder.encode(password));
        user.setNickname(nickname);
        user.setSchool("南京大学");
        user.setCurrentRole(role);
        userRepository.save(user);

        if ("PROVIDER".equals(role)) {
            ensureProviderProfile(user.getId());
        }
    }

    @Transactional
    public LoginResponse login(String studentNo, String password, String role, String clientIp) {
        User user = userRepository.findByStudentNo(studentNo)
                .orElseThrow(() -> new BusinessException(ErrorCode.VALIDATION_ERROR, "学号或密码错误"));

        if (!"ACTIVE".equals(user.getStatus())) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "账号已被禁用");
        }

        if (!passwordEncoder.matches(password, user.getPasswordHash())) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "学号或密码错误");
        }

        UserRole requestedRole = UserRole.parse(role, null);
        UserRole currentRole = UserRole.parse(user.getCurrentRole(), UserRole.CUSTOMER);
        if (requestedRole == UserRole.ADMIN || currentRole == UserRole.ADMIN) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "管理员账号需通过专用入口登录");
        }

        boolean dirty = false;
        if (!requestedRole.name().equals(user.getCurrentRole())) {
            user.setCurrentRole(requestedRole.name());
            dirty = true;
        }

        // 最大努力更新 IP 归属地
        try {
            String province = ipLocationService.resolveProvince(clientIp);
            if (province != null && !province.equals(user.getCityCode())) {
                user.setCityCode(province);
                dirty = true;
            }
        } catch (Exception ignored) {}

        if (dirty) {
            userRepository.save(user);
        }

        if (requestedRole == UserRole.PROVIDER) {
            ensureProviderProfile(user.getId());
        }

        String token = jwtUtil.generateToken(user.getId());
        return new LoginResponse(
                token,
                user.getId(),
                user.getNickname(),
                requestedRole.name(),
                hasAdminPermission(user)
        );
    }

    @Transactional(readOnly = true)
    public LoginResponse adminLogin(String studentNo, String password) {
        User user = userRepository.findByStudentNo(studentNo)
                .orElseThrow(() -> new BusinessException(ErrorCode.VALIDATION_ERROR, "学号或密码错误"));

        if (!"ACTIVE".equals(user.getStatus())) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "账号已被禁用");
        }

        if (!passwordEncoder.matches(password, user.getPasswordHash())) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "学号或密码错误");
        }

        if (!hasAdminPermission(user)) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "当前账号没有管理员权限");
        }

        String token = jwtUtil.generateToken(user.getId());
        return new LoginResponse(token, user.getId(), user.getNickname(), UserRole.ADMIN.name(), true);
    }

    private boolean hasAdminPermission(User user) {
        return UserRole.ADMIN.name().equals(user.getCurrentRole())
                || userRoleBindingRepository.existsByUserIdAndRole(user.getId(), UserRole.ADMIN.name());
    }

    private void ensureProviderProfile(Long userId) {
        long exists = providerProfileMapper.selectCount(
                new LambdaQueryWrapper<ProviderProfile>().eq(ProviderProfile::getUserId, userId)
        );
        if (exists == 0) {
            ProviderProfile profile = new ProviderProfile();
            profile.setUserId(userId);
            providerProfileMapper.insert(profile);
        }
    }

    /** GET /users/me：返回当前用户完整资料（含双身份字段） */
    public UserProfileResponse getMyProfile(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new BusinessException(ErrorCode.VALIDATION_ERROR, "用户不存在"));

        ProviderProfile pp = providerProfileMapper.selectOne(
                new LambdaQueryWrapper<ProviderProfile>().eq(ProviderProfile::getUserId, userId)
        );

        UserProfileResponse resp = new UserProfileResponse();
        resp.setId(user.getId());
        resp.setStudentNo(user.getStudentNo());
        resp.setNickname(user.getNickname());
        resp.setSchool(user.getSchool());
        resp.setGender(user.getGender());
        resp.setGenderVisible(user.getGenderVisible());
        resp.setBirthday(user.getBirthday());
        resp.setBirthdayVisible(user.getBirthdayVisible());
        resp.setLocationDisplay(user.getLocationDisplay());
        resp.setLocationVisible(user.getLocationVisible());
        resp.setCityCode(user.getCityCode());
        resp.setBio(user.getBio());
        resp.setAvatarFileId(user.getAvatarFileId());
        resp.setCurrentRole(user.getCurrentRole());
        resp.setStatus(user.getStatus());
        resp.setCreditScore(creditSnapshotService.getDisplayCreditScore(userId));
        resp.setCreatedAt(user.getCreatedAt());
        resp.setCustomerNickname(user.getNickname());
        resp.setCustomerAvatarFileId(user.getAvatarFileId());
        resp.setCustomerBio(user.getBio());
        resp.setProviderNickname(pp != null ? pp.getDisplayName() : null);
        resp.setProviderAvatarFileId(pp != null && pp.getProviderAvatarFileId() != null
                ? pp.getProviderAvatarFileId()
                : user.getAvatarFileId());
        resp.setProviderBio(pp != null ? pp.getBio() : null);
        return resp;
    }

    /** GET /users/{id}/brief：返回任意用户简要信息 */
    public UserBriefResponse getUserBrief(Long userId) {
        return getUserBrief(userId, null);
    }

    public UserBriefResponse getUserBrief(Long userId, String role) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new BusinessException(ErrorCode.VALIDATION_ERROR, "用户不存在"));
        ProviderProfile providerProfile = providerProfileMapper.selectOne(
                new LambdaQueryWrapper<ProviderProfile>().eq(ProviderProfile::getUserId, userId)
        );
        boolean providerRole = "PROVIDER".equalsIgnoreCase(role)
                || (role == null && providerProfile != null && providerProfile.getProviderAvatarFileId() != null);
        if (providerRole && providerProfile != null) {
            Long avatarFileId = providerProfile.getProviderAvatarFileId() != null
                    ? providerProfile.getProviderAvatarFileId()
                    : user.getAvatarFileId();
            String nickname = providerProfile.getDisplayName() != null && !providerProfile.getDisplayName().isBlank()
                    ? providerProfile.getDisplayName()
                    : user.getNickname();
            return new UserBriefResponse(user.getId(), nickname, avatarFileId);
        }
        return new UserBriefResponse(user.getId(), user.getNickname(), user.getAvatarFileId());
    }

    /** POST /users/me/role：切换当前用户角色（仅允许 CUSTOMER/PROVIDER） */
    @Transactional
    public SwitchRoleResponse switchRole(Long userId, String targetRoleStr) {
        if (targetRoleStr == null || targetRoleStr.isBlank()) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "role 不能为空");
        }
        UserRole targetRole = UserRole.parse(targetRoleStr, null);
        if (targetRole == UserRole.ADMIN) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "不允许切换为 ADMIN");
        }

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "用户不存在"));

        if (targetRole.name().equals(user.getCurrentRole())) {
            return new SwitchRoleResponse(user.getId(), user.getCurrentRole(), user.getNickname());
        }

        user.setCurrentRole(targetRole.name());
        userRepository.save(user);
        return new SwitchRoleResponse(user.getId(), user.getCurrentRole(), user.getNickname());
    }

    @Transactional
    public void updateMyProfile(Long userId, UpdateProfileRequest req) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "用户不存在"));
        if ("PROVIDER".equals(req.getRole())) {
            ensureProviderProfile(userId);
            ProviderProfile pp = providerProfileMapper.selectOne(
                    new LambdaQueryWrapper<ProviderProfile>().eq(ProviderProfile::getUserId, userId)
            );
            if (req.getNickname() != null && !req.getNickname().isBlank()) {
                pp.setDisplayName(req.getNickname().trim());
            }
            if (req.getBio() != null) {
                pp.setBio(req.getBio().trim());
            }
            if (req.getAvatarFileId() != null) {
                pp.setProviderAvatarFileId(req.getAvatarFileId());
                user.setAvatarFileId(req.getAvatarFileId());
            }
            providerProfileMapper.updateById(pp);
            userRepository.save(user);
        } else {
            if (req.getNickname() != null && !req.getNickname().isBlank()) {
                user.setNickname(req.getNickname().trim());
            }
            if (req.getBio() != null) {
                user.setBio(req.getBio().trim());
            }
            if (req.getAvatarFileId() != null) {
                user.setAvatarFileId(req.getAvatarFileId());
            }
            if (req.getCityCode() != null && !req.getCityCode().isBlank()) {
                user.setCityCode(req.getCityCode().trim());
            }
            if (req.getGender() != null) {
                user.setGender(req.getGender().isBlank() ? null : req.getGender().trim());
            }
            if (req.getGenderVisible() != null) {
                user.setGenderVisible(req.getGenderVisible());
            }
            if (req.getBirthday() != null) {
                user.setBirthday(req.getBirthday().isBlank() ? null : req.getBirthday().trim());
            }
            if (req.getBirthdayVisible() != null) {
                user.setBirthdayVisible(req.getBirthdayVisible());
            }
            if (req.getLocationDisplay() != null) {
                user.setLocationDisplay(req.getLocationDisplay().trim());
            }
            if (req.getLocationVisible() != null) {
                user.setLocationVisible(req.getLocationVisible());
            }
            userRepository.save(user);
        }
    }
}
