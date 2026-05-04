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
import vacademy.io.admin_core_service.features.vimotion.dto.StudioAvatarDTO;
import vacademy.io.admin_core_service.features.vimotion.service.StudioAvatarService;
import vacademy.io.common.auth.model.CustomUserDetails;

import java.util.List;

@RestController
@RequestMapping("/admin-core-service/vimotion/v1/avatars")
public class VimotionAvatarController {

    @Autowired
    private StudioAvatarService avatarService;

    @GetMapping
    public ResponseEntity<List<StudioAvatarDTO>> list(
            @RequestAttribute("user") CustomUserDetails user,
            @RequestParam("instituteId") String instituteId) {
        return ResponseEntity.ok(avatarService.list(instituteId));
    }

    @GetMapping("/{id}")
    public ResponseEntity<StudioAvatarDTO> get(
            @RequestAttribute("user") CustomUserDetails user,
            @PathVariable String id,
            @RequestParam("instituteId") String instituteId) {
        return ResponseEntity.ok(avatarService.get(id, instituteId));
    }

    @PostMapping
    public ResponseEntity<StudioAvatarDTO> create(
            @RequestAttribute("user") CustomUserDetails user,
            @RequestParam("instituteId") String instituteId,
            @RequestBody StudioAvatarDTO body) {
        StudioAvatarDTO created = avatarService.create(instituteId, body, user.getUserId());
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    @PutMapping("/{id}")
    public ResponseEntity<StudioAvatarDTO> update(
            @RequestAttribute("user") CustomUserDetails user,
            @PathVariable String id,
            @RequestParam("instituteId") String instituteId,
            @RequestBody StudioAvatarDTO body) {
        return ResponseEntity.ok(avatarService.update(id, instituteId, body, user.getUserId()));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(
            @RequestAttribute("user") CustomUserDetails user,
            @PathVariable String id,
            @RequestParam("instituteId") String instituteId) {
        avatarService.delete(id, instituteId);
        return ResponseEntity.noContent().build();
    }
}
