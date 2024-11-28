package vacademy.io.auth_service.feature.user.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import vacademy.io.auth_service.feature.user.dto.RoleDTO;
import vacademy.io.common.auth.entity.Role;
import vacademy.io.common.auth.repository.RoleRepository;
import vacademy.io.common.exceptions.UserNotFoundException;

import java.util.List;
import java.util.stream.Collectors;

@Service
public class RoleService {

    @Autowired
    RoleRepository roleRepository;


}
