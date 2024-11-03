package vacademy.io.auth_service.feature.user.service;


import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import vacademy.io.auth_service.feature.user.dto.PermissionDTO;
import vacademy.io.auth_service.feature.user.repository.PermissionRepository;

import java.util.List;
import java.util.stream.Collectors;

@Service
public class PermissionService {


    @Autowired
    PermissionRepository permissionRepository;

    public List<PermissionDTO> getAllPermissionsWithTag() {
        List<Object[]> results = permissionRepository.findAllPermissionsWithTag();
        return results.stream()
                .map(result -> new PermissionDTO((String) result[0], (String) result[1], (String) result[2]))
                .collect(Collectors.toList());
    }
}
