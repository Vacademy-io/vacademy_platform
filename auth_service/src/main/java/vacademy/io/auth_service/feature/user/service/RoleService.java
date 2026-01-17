package vacademy.io.auth_service.feature.user.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.auth_service.feature.user.dto.ModifyUserRolesDTO;
import vacademy.io.auth_service.feature.user.dto.UserRoleFilterDTO;
import vacademy.io.common.auth.dto.PagedUserWithRolesResponse;
import vacademy.io.common.auth.dto.RoleCountProjection;
import vacademy.io.common.auth.dto.UserWithRolesDTO;
import vacademy.io.common.auth.entity.Role;
import vacademy.io.common.auth.entity.User;
import vacademy.io.common.auth.entity.UserRole;
import vacademy.io.common.auth.enums.UserRoleStatus;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.auth.repository.RoleRepository;
import vacademy.io.common.auth.repository.UserRepository;
import vacademy.io.common.auth.repository.UserRoleRepository;
import vacademy.io.common.auth.service.UserService;
import vacademy.io.common.exceptions.VacademyException;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

@Service
public class RoleService {

    private final RoleRepository roleRepository;
    private final UserRepository userRepository;
    private final UserRoleRepository userRoleRepository;
    private final UserService userService;
    private final UserOperationService userOperationService;

    public RoleService(RoleRepository roleRepository, UserRepository userRepository, UserRoleRepository userRoleRepository, UserService userService,UserOperationService userOperationService) {
        this.roleRepository = roleRepository;
        this.userRepository = userRepository;
        this.userRoleRepository = userRoleRepository;
        this.userService = userService;
        this.userOperationService = userOperationService;
    }

    @Transactional
    public String addRolesToUser(ModifyUserRolesDTO addRolesToUserDTO, Optional<String> roleStatus, CustomUserDetails customUserDetails) {
        User user = getUserById(addRolesToUserDTO.getUserId());
        List<Role> roles = roleRepository.findByNameIn(addRolesToUserDTO.getRoles());

        List<UserRole> userRoles = new ArrayList<>();
        for (Role role : roles) {
            List<UserRole>userRolesList = userRoleRepository.findByUserAndStatusAndRoleName(user, UserRoleStatus.ACTIVE.name(), role.getName());
            if (userRolesList.size() > 0) {
                continue;
            }
            userRoles.add(createUserRole(user, role, roleStatus, addRolesToUserDTO.getInstituteId()));
        }

        userRoleRepository.saveAll(userRoles);
        userService.updateLastTokenUpdatedTime(List.of(addRolesToUserDTO.getUserId()));
        return "Roles added successfully";
    }

    private User getUserById(String userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new VacademyException("User not found for ID: " + userId));
    }

    private Iterable<Role> getRolesByIds(String commaSeparatedRoleIds) {
        List<String> roleIds = parseRoleIds(commaSeparatedRoleIds);
        return roleRepository.findAllById(roleIds);
    }

    private List<String> parseRoleIds(String commaSeparatedRoleIds) {
        if (commaSeparatedRoleIds == null || commaSeparatedRoleIds.trim().isEmpty()) {
            throw new VacademyException("Invalid Request. Provide role IDs.");
        }

        List<String> roleIds = new ArrayList<>();
        for (String id : commaSeparatedRoleIds.trim().split(",")) {
            roleIds.add(id.trim());
        }
        return roleIds;
    }

    private UserRole createUserRole(User user, Role role, Optional<String> userRoleStatus, String instituteId) {
        UserRole userRole = new UserRole();
        userRole.setUser(user);
        userRole.setRole(role);
        userRole.setInstituteId(instituteId);
        if (userRoleStatus.isPresent()) {
            userRole.setStatus(userRoleStatus.get());
        }
        ;
        return userRole;
    }

    public String removeRolesFromUser(ModifyUserRolesDTO modifyUserRolesDTO, CustomUserDetails customUserDetails) {
        userRoleRepository.deleteUserRolesByUserIdAndRoleNames(modifyUserRolesDTO.getUserId(), modifyUserRolesDTO.getRoles());
        return "Roles removed successfully";
    }

    public List<RoleCountProjection> geRolesCountByInstituteId(String instituteId, CustomUserDetails userDetails) {
        return userRoleRepository.getUserRoleCountsByInstituteId(instituteId);
    }

    public List<UserWithRolesDTO> getUsersByInstituteIdAndStatus(String instituteId, UserRoleFilterDTO filterDTO, CustomUserDetails customUserDetails) {
        return userService.getUsersByInstituteIdAndStatus(instituteId, filterDTO.getStatus(), filterDTO.getRoles(), customUserDetails);
    }

    public PagedUserWithRolesResponse getUsersByInstituteIdAndStatusPaged(String instituteId,
            UserRoleFilterDTO filterDTO,
            CustomUserDetails customUserDetails) {
        int pageNumber = filterDTO.getPageNumber() != null ? filterDTO.getPageNumber() : 0;
        int pageSize = filterDTO.getPageSize() != null ? filterDTO.getPageSize() : 10;
        return userService.getUsersByInstituteIdAndStatusPaged(instituteId, filterDTO.getStatus(), filterDTO.getRoles(),
                filterDTO.getName(), pageNumber, pageSize, customUserDetails);
    }

    public String updateUserRoleStatusByInstituteIdAndUserId(String newStatus, String instituteId, List<String> userIds,
            CustomUserDetails user) {
        int rowsUpdated = userRoleRepository.updateUserRoleStatusByInstituteIdAndUserId(newStatus, instituteId,
                userIds);
        if (rowsUpdated == 0) {
            throw new VacademyException("No role found to update the status!!!");
        }
        return "Status updated successfully";
    }

    public List<UserWithRolesDTO> getUsersByInstituteIdAndStatus(String instituteId, UserRoleFilterDTO filterDTO) {
        return userService.getUsersByInstituteIdAndStatus(instituteId, filterDTO.getStatus(), filterDTO.getRoles());
    }
}
