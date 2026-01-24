package vacademy.io.admin_core_service.features.common.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.common.dto.SystemFieldCustomFieldMappingDTO;
import vacademy.io.admin_core_service.features.common.dto.SystemFieldInfoDTO;
import vacademy.io.admin_core_service.features.common.manager.FieldMappingManager;
import vacademy.io.admin_core_service.features.common.service.FieldSyncService;
import vacademy.io.common.auth.model.CustomUserDetails;

import java.util.List;

/**
 * Controller for managing system field ↔ custom field mappings.
 * Allows admins to configure which custom fields map to which system fields.
 */
@RestController
@RequestMapping("/admin-core-service/common/field-mapping")
public class FieldMappingController {

    @Autowired
    private FieldMappingManager fieldMappingManager;

    @Autowired
    private FieldSyncService fieldSyncService;

    /**
     * Get all mappings for an institute and entity type.
     */
    @GetMapping
    public ResponseEntity<List<SystemFieldCustomFieldMappingDTO>> getMappings(
            @RequestParam("instituteId") String instituteId,
            @RequestParam("entityType") String entityType) {
        return ResponseEntity.ok(fieldMappingManager.getMappings(instituteId, entityType));
    }

    /**
     * Get available system fields for an entity type.
     * Shows which fields can be mapped and their current mapping status.
     */
    @GetMapping("/available-fields")
    public ResponseEntity<List<SystemFieldInfoDTO>> getAvailableFields(
            @RequestParam("instituteId") String instituteId,
            @RequestParam("entityType") String entityType) {
        return ResponseEntity.ok(fieldMappingManager.getAvailableSystemFields(instituteId, entityType));
    }

    /**
     * Get supported entity types.
     */
    @GetMapping("/entity-types")
    public ResponseEntity<List<String>> getEntityTypes() {
        return ResponseEntity.ok(fieldMappingManager.getSupportedEntityTypes());
    }

    /**
     * Create a new mapping between a system field and custom field.
     */
    @PostMapping
    public ResponseEntity<SystemFieldCustomFieldMappingDTO> createMapping(
            @RequestParam("user") CustomUserDetails userDetails,
            @RequestBody SystemFieldCustomFieldMappingDTO request) {
        return ResponseEntity.ok(fieldMappingManager.createMapping(request));
    }

    /**
     * Update an existing mapping.
     */
    @PutMapping("/{mappingId}")
    public ResponseEntity<SystemFieldCustomFieldMappingDTO> updateMapping(
            @RequestParam("user") CustomUserDetails userDetails,
            @PathVariable("mappingId") String mappingId,
            @RequestBody SystemFieldCustomFieldMappingDTO request) {
        return ResponseEntity.ok(fieldMappingManager.updateMapping(mappingId, request));
    }

    /**
     * Delete a mapping (soft delete).
     */
    @DeleteMapping("/{mappingId}")
    public ResponseEntity<String> deleteMapping(
            @RequestParam("user") CustomUserDetails userDetails,
            @PathVariable("mappingId") String mappingId) {
        fieldMappingManager.deleteMapping(mappingId);
        return ResponseEntity.ok("Mapping deleted successfully");
    }

    /**
     * Manually trigger sync from system fields to custom fields for an entity.
     * Useful for initial population or fixing sync issues.
     */
    @PostMapping("/sync/system-to-custom")
    public ResponseEntity<String> syncSystemToCustom(
            @RequestParam("user") CustomUserDetails userDetails,
            @RequestParam("instituteId") String instituteId,
            @RequestParam("entityType") String entityType,
            @RequestParam("entityId") String entityId) {
        fieldSyncService.syncAllSystemFieldsToCustomFields(instituteId, entityType, entityId);
        return ResponseEntity.ok("Sync completed");
    }

    /**
     * Manually trigger sync from custom fields to system fields for an entity.
     */
    @PostMapping("/sync/custom-to-system")
    public ResponseEntity<String> syncCustomToSystem(
            @RequestParam("user") CustomUserDetails userDetails,
            @RequestParam("instituteId") String instituteId,
            @RequestParam("entityType") String entityType,
            @RequestParam("entityId") String entityId) {
        fieldSyncService.syncAllCustomFieldsToSystemFields(instituteId, entityType, entityId);
        return ResponseEntity.ok("Sync completed");
    }
}
