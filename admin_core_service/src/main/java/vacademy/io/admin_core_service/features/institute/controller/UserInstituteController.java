package vacademy.io.admin_core_service.features.institute.controller;


import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import vacademy.io.admin_core_service.features.institute.service.UserInstituteService;
import vacademy.io.common.institute.dto.InstituteIdAndNameDTO;
import vacademy.io.common.institute.dto.InstituteInfoDTO;

import java.util.List;

@RestController
@RequestMapping("/admin-core-service/institute/v1")
public class UserInstituteController {

    @Autowired
    private UserInstituteService instituteService;

    @PostMapping("/internal/create")
    public ResponseEntity<InstituteIdAndNameDTO> registerUserInstitutes(@RequestBody InstituteInfoDTO request) {

        InstituteIdAndNameDTO institutes =  instituteService.saveInstitute(request);
        return ResponseEntity.ok(institutes);
    }
}
