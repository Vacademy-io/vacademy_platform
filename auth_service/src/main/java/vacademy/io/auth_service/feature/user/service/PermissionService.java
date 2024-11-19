package vacademy.io.auth_service.feature.user.service;


import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import vacademy.io.auth_service.feature.user.dto.PermissionDTO;
import vacademy.io.auth_service.feature.user.repository.PermissionRepository;
import vacademy.io.common.auth.entity.UserAuthority;
import vacademy.io.common.exceptions.RoleNotFoundException;
import vacademy.io.common.exceptions.UserNotFoundException;

import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class PermissionService {


    @Autowired
    PermissionRepository permissionRepository;

    public List<PermissionDTO> getPermissionsByUserId(String userId) {

        if (!ifUserExist(userId)) {
            throw new UserNotFoundException("User with Id " + userId + " not found");
        }
        List<UserAuthority> permissions = permissionRepository.findPermissionsByUserId(userId);

        return permissions.stream()
                .map(permission -> new PermissionDTO(permission.getId(), permission.getName(), permission.getTag()
                ))
                .collect(Collectors.toList());
    }

    public List<PermissionDTO> getPermissionsByListOfRoleId(List<String> roleId) {

        if (roleId.size() == 0) {
            return new ArrayList<>();
        }
        for (String role : roleId) {
            if (!ifRoleExist(role)) {
                throw new RoleNotFoundException("Role with Id " + role + " not found");
            }
        }
        List<UserAuthority> permissions = permissionRepository.findPermissionsByListOfRoleId(roleId);

        return permissions.stream()
                .map(permission -> new PermissionDTO(permission.getId(), permission.getName(), permission.getTag()
                ))
                .collect(Collectors.toList());
    }

    public List<PermissionDTO> getAllPermissionsWithTag() {
        List<UserAuthority> permissions = permissionRepository.findAllPermissionsWithTag();

        return permissions.stream()
                .map(permission -> new PermissionDTO(permission.getId(), permission.getName(), permission.getTag()
                ))
                .collect(Collectors.toList());
    }

    public boolean ifUserExist(String userId) {

        return permissionRepository.existsByUserId(userId);
    }

    public boolean ifRoleExist(String roleId) {

        return permissionRepository.existsByRoleId(roleId);
    }
}
