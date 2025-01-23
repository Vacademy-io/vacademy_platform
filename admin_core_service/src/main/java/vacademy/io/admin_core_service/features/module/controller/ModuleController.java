package vacademy.io.admin_core_service.features.module.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.module.dto.ModuleDTO;
import vacademy.io.admin_core_service.features.module.service.ModuleService;
import vacademy.io.common.auth.model.CustomUserDetails;

@RestController
@RequestMapping("/admin-core-service/subject/v1")
@RequiredArgsConstructor
public class ModuleController {
    private final ModuleService moduleService;

    @PostMapping("/add-module")
    public ResponseEntity<ModuleDTO> addModule(@RequestParam String subjectId,@RequestBody ModuleDTO moduleDTO, @RequestAttribute("user")CustomUserDetails user) {
        return ResponseEntity.ok(moduleService.addModule(subjectId, moduleDTO,user));
    }

    @DeleteMapping("/delete-module")
    public ResponseEntity<String> addModule(String moduleId,@RequestAttribute("user")CustomUserDetails user) {
        return ResponseEntity.ok(moduleService.deleteModule(moduleId,user));
    }

    @PutMapping("/update-module")
    public ResponseEntity<ModuleDTO> updateModule(String moduleId,@RequestBody ModuleDTO moduleDTO,@RequestAttribute("user")CustomUserDetails user) {
        return ResponseEntity.ok(moduleService.updateModule(moduleId, moduleDTO,user));
    }
}
