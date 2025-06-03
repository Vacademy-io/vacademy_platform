package vacademy.io.common.auth.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import vacademy.io.common.auth.dto.EditUserPermissionRequestDTO;
import vacademy.io.common.auth.entity.UserPermission;
import vacademy.io.common.auth.repository.UserPermissionRepository;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;

@Service
public class UserPermissionService {

    @Autowired
    private UserPermissionRepository userPermissionRepository;

    public String updateUserPermission(EditUserPermissionRequestDTO editUserPermissionRequestDTO) {
        Set<String>toRemove = editUserPermissionRequestDTO.getRemovedPermissionIds();
        Set<String>toAdd = editUserPermissionRequestDTO.getAddedPermissionIds();
        userPermissionRepository.deleteByUserIdAndPermissionIds(editUserPermissionRequestDTO.getUserId(), toRemove);
        List<UserPermission>userPermissions = new ArrayList<>();
        for (String permissionId : toAdd) {
            UserPermission userPermission = new UserPermission();
            userPermission.setUserId(editUserPermissionRequestDTO.getUserId());
            userPermission.setPermissionId(permissionId);
            userPermission.setInstituteId(editUserPermissionRequestDTO.getInstituteId());
            userPermissions.add(userPermission);
        }
        userPermissionRepository.saveAll(userPermissions);
        return "success";
    }

    public List<String> getUserPermissions(String userId) {
        return userPermissionRepository.findByUserId(userId).stream().map(UserPermission::getPermissionId).toList();
    }

}
