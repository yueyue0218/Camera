package com.action.camera.application;

import com.action.camera.common.ErrorCode;
import com.action.camera.common.JwtUtil;
import com.action.camera.common.exception.BusinessException;
import com.action.camera.domain.User;
import com.action.camera.dto.LoginResponse;
import com.action.camera.dto.UserBriefResponse;
import com.action.camera.dto.UserProfileResponse;
import com.action.camera.repository.UserRepository;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class UserService {

    private final UserRepository userRepository;
    private final VerificationCodeService codeService;
    private final JwtUtil jwtUtil;
    private final BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder();

    public UserService(UserRepository userRepository,
                       VerificationCodeService codeService,
                       JwtUtil jwtUtil) {
        this.userRepository = userRepository;
        this.codeService = codeService;
        this.jwtUtil = jwtUtil;
    }

    @Transactional
    public void register(String email, String code, String password, String nickname) {
        codeService.verify(email, code);

        String studentNo = email.substring(0, 9);

        if (userRepository.existsByStudentNo(studentNo)) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "该学号已注册");
        }

        String passwordHash = passwordEncoder.encode(password);

        User user = new User();
        user.setStudentNo(studentNo);
        user.setPasswordHash(passwordHash);
        user.setNickname(nickname);
        user.setSchool("南京大学");

        userRepository.save(user);
    }

    public LoginResponse login(String studentNo, String password) {
        User user = userRepository.findByStudentNo(studentNo)
                .orElseThrow(() -> new BusinessException(ErrorCode.VALIDATION_ERROR, "学号或密码错误"));

        if (!"ACTIVE".equals(user.getStatus())) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "账号已被禁用");
        }

        if (!passwordEncoder.matches(password, user.getPasswordHash())) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "学号或密码错误");
        }

        String token = jwtUtil.generateToken(user.getId());
        return new LoginResponse(token, user.getId(), user.getNickname());
    }

    /** GET /users/me：返回当前用户完整资料 */
    public UserProfileResponse getMyProfile(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new BusinessException(ErrorCode.VALIDATION_ERROR, "用户不存在"));

        UserProfileResponse resp = new UserProfileResponse();
        resp.setId(user.getId());
        resp.setStudentNo(user.getStudentNo());
        resp.setNickname(user.getNickname());
        resp.setSchool(user.getSchool());
        resp.setGender(user.getGender());
        resp.setCityCode(user.getCityCode());
        resp.setBio(user.getBio());
        resp.setAvatarFileId(user.getAvatarFileId());
        resp.setCurrentRole(user.getCurrentRole());
        resp.setStatus(user.getStatus());
        resp.setCreditScore(user.getCreditScore());
        resp.setCreatedAt(user.getCreatedAt());
        return resp;
    }

    /** GET /users/{id}/brief：返回任意用户简要信息 */
    public UserBriefResponse getUserBrief(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new BusinessException(ErrorCode.VALIDATION_ERROR, "用户不存在"));
        return new UserBriefResponse(user.getId(), user.getNickname(), user.getAvatarFileId());
    }
}
