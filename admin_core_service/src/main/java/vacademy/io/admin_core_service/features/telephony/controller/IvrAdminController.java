package vacademy.io.admin_core_service.features.telephony.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.telephony.controller.dto.IvrMenuDTO;
import vacademy.io.admin_core_service.features.telephony.ivr.IvrMenuService;

import java.util.List;

/**
 * Admin CRUD for IVR menus (the multi-level inbound tree builder backing API).
 * JWT-protected (default Spring auth — not in ALLOWED_PATHS). The frontend tree
 * builder reads/writes whole menus here; the inbound call flow consumes them at
 * runtime via {@link IvrMenuService}.
 */
@RestController
@RequestMapping("/admin-core-service/v1/telephony/ivr")
@RequiredArgsConstructor
public class IvrAdminController {

    private final IvrMenuService ivrMenuService;

    @GetMapping("/menus")
    public ResponseEntity<List<IvrMenuDTO>> list(@RequestParam("instituteId") String instituteId) {
        return ResponseEntity.ok(ivrMenuService.listMenus(instituteId));
    }

    @GetMapping("/menus/{menuId}")
    public ResponseEntity<IvrMenuDTO> get(@PathVariable("menuId") String menuId) {
        return ResponseEntity.ok(ivrMenuService.getMenu(menuId));
    }

    /** Create (id null) or update (id set) a whole menu tree atomically. */
    @PostMapping("/menus")
    public ResponseEntity<IvrMenuDTO> save(@RequestBody IvrMenuDTO dto) {
        return ResponseEntity.ok(ivrMenuService.saveMenu(dto));
    }

    @DeleteMapping("/menus/{menuId}")
    public ResponseEntity<Void> delete(@PathVariable("menuId") String menuId) {
        ivrMenuService.deleteMenu(menuId);
        return ResponseEntity.noContent().build();
    }
}
