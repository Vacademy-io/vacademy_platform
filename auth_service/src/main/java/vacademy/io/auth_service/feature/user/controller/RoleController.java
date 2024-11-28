package vacademy.io.auth_service.feature.user.controller;


import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;
import vacademy.io.auth_service.feature.user.dto.RoleDTO;
import vacademy.io.auth_service.feature.user.service.RoleService;

import java.util.List;

@RestController
public class RoleController {

    @Autowired
    RoleService roleService;

}
