package vacademy.io.admin_core_service.features.vimotion.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import vacademy.io.admin_core_service.features.vimotion.dto.BrandKitDTO;
import vacademy.io.admin_core_service.features.vimotion.service.BrandKitService;
import vacademy.io.common.auth.model.CustomUserDetails;

import java.util.List;

@RestController
@RequestMapping("/admin-core-service/vimotion/v1/brand-kits")
public class VimotionBrandKitController {

    @Autowired
    private BrandKitService brandKitService;

    @GetMapping
    public ResponseEntity<List<BrandKitDTO>> list(
            @RequestAttribute("user") CustomUserDetails user,
            @RequestParam("instituteId") String instituteId) {
        return ResponseEntity.ok(brandKitService.list(instituteId));
    }

    @GetMapping("/default")
    public ResponseEntity<BrandKitDTO> getDefault(
            @RequestAttribute("user") CustomUserDetails user,
            @RequestParam("instituteId") String instituteId) {
        return brandKitService.findDefault(instituteId)
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.status(HttpStatus.NOT_FOUND).build());
    }

    @GetMapping("/{id}")
    public ResponseEntity<BrandKitDTO> get(
            @RequestAttribute("user") CustomUserDetails user,
            @PathVariable String id,
            @RequestParam("instituteId") String instituteId) {
        return ResponseEntity.ok(brandKitService.get(id, instituteId));
    }

    @PostMapping
    public ResponseEntity<BrandKitDTO> create(
            @RequestAttribute("user") CustomUserDetails user,
            @RequestParam("instituteId") String instituteId,
            @RequestBody BrandKitDTO body) {
        BrandKitDTO created = brandKitService.create(instituteId, body, user.getUserId());
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    @PutMapping("/{id}")
    public ResponseEntity<BrandKitDTO> update(
            @RequestAttribute("user") CustomUserDetails user,
            @PathVariable String id,
            @RequestParam("instituteId") String instituteId,
            @RequestBody BrandKitDTO body) {
        return ResponseEntity.ok(brandKitService.update(id, instituteId, body, user.getUserId()));
    }

    @PostMapping("/{id}/set-default")
    public ResponseEntity<BrandKitDTO> setDefault(
            @RequestAttribute("user") CustomUserDetails user,
            @PathVariable String id,
            @RequestParam("instituteId") String instituteId) {
        return ResponseEntity.ok(brandKitService.setDefault(id, instituteId));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(
            @RequestAttribute("user") CustomUserDetails user,
            @PathVariable String id,
            @RequestParam("instituteId") String instituteId) {
        brandKitService.delete(id, instituteId);
        return ResponseEntity.noContent().build();
    }
}
