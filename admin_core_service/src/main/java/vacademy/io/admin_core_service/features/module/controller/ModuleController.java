package vacademy.io.admin_core_service.features.module.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.module.dto.ModuleDTO;
import vacademy.io.admin_core_service.features.module.dto.UpdateModuleOrderDTO;
import vacademy.io.admin_core_service.features.module.service.ModuleService;
import vacademy.io.common.auth.model.CustomUserDetails;

import java.util.List;

@RestController
@RequestMapping("/admin-core-service/subject/v1")
@RequiredArgsConstructor
public class ModuleController {
    private final ModuleService moduleService;

    @PostMapping("/add-module")
    public ResponseEntity<ModuleDTO> addModule(@RequestParam String subjectId,
                                               @RequestParam String packageSessionId,
                                               @RequestBody ModuleDTO moduleDTO,
                                               @RequestAttribute("user") CustomUserDetails user) {
        return ResponseEntity.ok(
                moduleService.addModule(subjectId,
                packageSessionId,
                moduleDTO, user));
    }

    @PostMapping("/delete-module")
    public ResponseEntity<String> addModule(@RequestBody List<String> moduleIds,
                                            String subjectId,
                                            String packageSessionId,
                                            @RequestAttribute("user") CustomUserDetails user) {
        return ResponseEntity.ok(moduleService.deleteModule(moduleIds,subjectId,packageSessionId, user));
    }

    @PutMapping("/update-module")
    public ResponseEntity<ModuleDTO> updateModule(String moduleId, @RequestBody ModuleDTO moduleDTO, @RequestAttribute("user") CustomUserDetails user) {
        return ResponseEntity.ok(moduleService.updateModule(moduleId, moduleDTO, user));
    }
    /**
     * Fetches SubjectModuleMapping entities based on a list of subject IDs and module IDs.
     * @param subjectIds List of subject IDs to filter by.
     * @param moduleIds List of module IDs to filter by.
     * @return List of SubjectModuleMapping entities.
     */
    /**
     * Update the module order for a list of subject-module mappings.
     *
     * @param updateModuleOrderDTOS List of DTOs containing the subjectId, moduleId, and new moduleOrder.
     * @return Message indicating whether the update was successful.
     */
    @PostMapping("/update-module-order")
    public String updateModuleOrder(@RequestBody List<UpdateModuleOrderDTO> updateModuleOrderDTOS, @RequestAttribute("user") CustomUserDetails user) {
        // Call the service method to update the module order
        moduleService.updateModuleOrder(updateModuleOrderDTOS, user);
        return "Module order updated successfully.";
    }
}
