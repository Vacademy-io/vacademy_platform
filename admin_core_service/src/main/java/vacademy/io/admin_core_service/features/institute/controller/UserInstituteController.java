package vacademy.io.admin_core_service.features.institute.controller;


import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;
import vacademy.io.admin_core_service.features.institute.dto.InstituteIdAndNameDTO;
import vacademy.io.admin_core_service.features.institute.dto.InstitutesAndUserIdDTO;
import vacademy.io.admin_core_service.features.institute.service.UserInstituteService;

import java.util.List;

@RestController
public class UserInstituteController {

    @Autowired
    private UserInstituteService instituteService;


    @PostMapping("/registerUserInstitutes")
    public ResponseEntity<List<InstituteIdAndNameDTO>> registerUserInstitutes(@RequestBody InstitutesAndUserIdDTO request) {

        List<InstituteIdAndNameDTO> institutes =  instituteService.saveInstitutesAndCreateStaff(request.getUserId(), request.getInstitutes());
        return ResponseEntity.ok(institutes);
    }
}
