package vacademy.io.auth_service.feature.user.controller;


import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.RestController;
import vacademy.io.auth_service.feature.user.service.RoleService;

@RestController
public class RoleController {

    @Autowired
    RoleService roleService;

}
