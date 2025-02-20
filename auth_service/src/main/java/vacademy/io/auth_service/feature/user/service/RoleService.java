package vacademy.io.auth_service.feature.user.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.auth_service.feature.user.dto.ModifyUserRolesDTO;
import vacademy.io.common.auth.entity.Role;
import vacademy.io.common.auth.entity.User;
import vacademy.io.common.auth.entity.UserRole;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.auth.repository.RoleRepository;
import vacademy.io.common.auth.repository.UserRepository;
import vacademy.io.common.auth.repository.UserRoleRepository;
import vacademy.io.common.exceptions.VacademyException;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

@Service
public class RoleService {

    private final RoleRepository roleRepository;
    private final UserRepository userRepository;
    private final UserRoleRepository userRoleRepository;

    public RoleService(RoleRepository roleRepository, UserRepository userRepository, UserRoleRepository userRoleRepository) {
        this.roleRepository = roleRepository;
        this.userRepository = userRepository;
        this.userRoleRepository = userRoleRepository;
    }

    @Transactional
    public String addRolesToUser(ModifyUserRolesDTO addRolesToUserDTO, CustomUserDetails customUserDetails) {
        User user = getUserById(addRolesToUserDTO.getUserId());
        Iterable<Role> roles = getRolesByIds(addRolesToUserDTO.getCommaSeparatedRoleIds());

        List<UserRole> userRoles = new ArrayList<>();
        for (Role role : roles) {
            userRoles.add(createUserRole(user, role, addRolesToUserDTO.getInstituteId()));
        }

        userRoleRepository.saveAll(userRoles);
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

    private UserRole createUserRole(User user, Role role, String instituteId) {
        UserRole userRole = new UserRole();
        userRole.setUser(user);
        userRole.setRole(role);
        userRole.setInstituteId(instituteId);
        return userRole;
    }

    public String removeRolesFromUser(ModifyUserRolesDTO modifyUserRolesDTO, CustomUserDetails customUserDetails) {
        List<String> roleIds = Arrays.asList(modifyUserRolesDTO.getCommaSeparatedRoleIds().split(","));
        userRoleRepository.deleteUserRolesByUserIdAndRoleIds(modifyUserRolesDTO.getUserId(), roleIds);
        return "Roles removed successfully";
    }
}
