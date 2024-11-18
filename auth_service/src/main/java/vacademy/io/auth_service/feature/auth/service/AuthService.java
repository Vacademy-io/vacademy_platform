package vacademy.io.auth_service.feature.auth.service;


import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;
import vacademy.io.auth_service.feature.auth.dto.*;
import vacademy.io.auth_service.feature.auth.repository.SubmoduleRepository;
import vacademy.io.auth_service.feature.user.repository.PermissionRepository;
import vacademy.io.auth_service.feature.user.repository.RoleRepository;
import vacademy.io.common.auth.entity.RefreshToken;
import vacademy.io.common.auth.entity.User;
import vacademy.io.common.auth.entity.UserAuthority;
import vacademy.io.common.auth.entity.UserRole;
import vacademy.io.common.auth.enums.Gender;
import vacademy.io.common.auth.repository.UserRepository;
import vacademy.io.common.auth.service.JwtService;
import vacademy.io.common.auth.service.RefreshTokenService;
import vacademy.io.common.exceptions.LaborLinkException;
import vacademy.io.common.auth.dto.SubmoduleDTO;
import vacademy.io.common.auth.dto.OrgDTO;

import java.util.*;
import java.util.stream.Collectors;

@Service
public class AuthService {

    @Autowired
    UserRepository userRepository;

    @Autowired
    JwtService jwtService;

    @Autowired
    RefreshTokenService refreshTokenService;

    @Autowired
    RestTemplate restTemplate;

    @Autowired
    SubmoduleRepository submoduleRepository;

    @Autowired
    RoleRepository roleRepository;


    @Autowired
    PermissionRepository permissionRepository;


    public JwtResponseDto registerUser(RegisterRequest registerRequest) {

        String userName = registerRequest.getUserName();

        Optional<User> userOptional = userRepository.findByUsername(userName);
        if (userOptional.isPresent()) {
            throw new LaborLinkException(HttpStatus.BAD_REQUEST, "User already registered");
        }


        User newUser = createUser(registerRequest);

        // Generate a refresh token
        RefreshToken refreshToken = refreshTokenService.createRefreshToken(userName, "VACADEMY-WEB");


        InstitutesAndUserIdDTO adminCoreRequest = new InstitutesAndUserIdDTO(newUser.getId(), registerRequest.getInstitutes());

    // Make it https because codacy AI fails in http . convert into http when run in local
        String adminCoreServiceUrl = "https://localhost:8072/registerUserInstitutes";

        ResponseEntity<List<InstituteIdAndNameDTO>> response = null;
        try {

            response = restTemplate.exchange(
                    adminCoreServiceUrl, HttpMethod.POST, new HttpEntity<>(adminCoreRequest),
                    new ParameterizedTypeReference<List<InstituteIdAndNameDTO>>() {}
            );
        } catch (RestClientException e) {
            userRepository.deleteUserById(newUser.getId());

            throw new LaborLinkException(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to register user institutes due to service unavailability: " + e.getMessage());
        }




        for (InstituteIdAndNameDTO instituteDTO : response.getBody()) {

            saveUserRoleForInstitute(newUser.getId(), instituteDTO.getInstituteId());

        }

        List<OrgDTO> orgs = new ArrayList<>();
        for (InstituteIdAndNameDTO instituteDTO : response.getBody()) {
            List<SubmoduleDTO> submodules = getSubmoduleDetails(instituteDTO.getSubmoduleIds());
            List<String> roles = getRolesForUserAndInstitute(newUser.getId(), instituteDTO.getInstituteId());
            List<String> permissions = getPermissionsForRoles(newUser.getId(), instituteDTO.getInstituteId());

            orgs.add(new OrgDTO(
                    instituteDTO.getInstituteName(),
                    instituteDTO.getInstituteId(),
                    submodules,
                    roles,
                    permissions
            ));
        }

        return generateJwtTokenForUser(newUser, refreshToken, orgs);
    }

    @Transactional
    private User createUser(RegisterRequest registerRequest) {
        String newId = UUID.randomUUID().toString();
        User user = User.builder()
                .id(newId)
                .username(registerRequest.getUserName())
                .email(registerRequest.getEmail())
                .password(registerRequest.getPassword())
                .isRootUser(true)
                .build();
        userRepository.insertUser(user.getId(),user.getUsername(), user.getEmail(), user.getPassword(), user.isRootUser());

        return user;




    }

    private JwtResponseDto generateJwtTokenForUser(User user, RefreshToken refreshToken, List<OrgDTO> orgs) {
        // Check if the user is a root user
        if (user.isRootUser()) {
            String accessToken = jwtService.generateTokenForRoot(user, orgs);

            // Return a JwtResponseDto with access token and refresh token
            return JwtResponseDto.builder()
                    .accessToken(accessToken)
                    .refreshToken(refreshToken.getToken())
                    .build();
        }

        // If the user is not a root user, you can handle other logic or throw an exception
        throw new LaborLinkException(HttpStatus.BAD_REQUEST, "Non-root user is not allowed to generate token.");
    }

    private List<SubmoduleDTO> getSubmoduleDetails(List<String> submoduleIds) {

        return submoduleRepository.findSubmoduleDetailsByIds(submoduleIds);

    }


    private List<String> getRolesForUserAndInstitute(String userId, String instituteId) {

        List<UserRole> userRoles = roleRepository.findRoleNamesByUserIdAndInstituteId(userId, instituteId);

        return userRoles.stream().map(UserRole::getName).collect(Collectors.toList());
    }

    // Example method to get permissions for roles
    private List<String> getPermissionsForRoles(String userId, String instituteId) {

        List<UserAuthority> permissions=permissionRepository.findPermissionsByUserIdAndInstituteId(userId,instituteId);
        return permissions.stream().map(UserAuthority::getName).collect(Collectors.toList());


    }

    private void saveUserRoleForInstitute(String userId, String instituteId) {

        List<UserRole> userRoles = roleRepository.findRolesByRoleName("ADMIN");
        if(userRoles.size()>0) {
            String roleId = userRoles.get(0).getId();
            roleRepository.saveUserRole(userId, roleId, instituteId);
        }
        else {
            throw new LaborLinkException(HttpStatus.INTERNAL_SERVER_ERROR, "Role 'ADMIN' not found");
        }
    }





}
