package vacademy.io.auth_service.feature.user.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import vacademy.io.common.auth.repository.RoleRepository;

@Service
public class RoleService {

    @Autowired
    RoleRepository roleRepository;


}
