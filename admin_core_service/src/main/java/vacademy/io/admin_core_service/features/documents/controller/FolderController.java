package vacademy.io.admin_core_service.features.documents.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.documents.dto.DeleteFoldersDTO;
import vacademy.io.admin_core_service.features.documents.dto.FolderDTO;
import vacademy.io.admin_core_service.features.documents.service.FolderService;
import vacademy.io.common.auth.model.CustomUserDetails;

import java.util.List;

@RequestMapping("/admin-core-service/folder/v1")
@RestController
public class FolderController {
    private final FolderService folderService;

    public FolderController(FolderService folderService) {
        this.folderService = folderService;
    }

    @PostMapping("/add")
    public ResponseEntity<String> addFolders(@RequestBody List<FolderDTO> addFolders,
                                             @RequestParam String userId,
                                             @RequestAttribute("user") CustomUserDetails user) {
        String response = folderService.addFolders(addFolders, userId, user);
        return ResponseEntity.ok(response);
    }

    @DeleteMapping("/delete")
    public ResponseEntity<String> deleteFolders(@RequestBody DeleteFoldersDTO deleteFoldersDTO,
                                                @RequestParam String userId,
                                                @RequestAttribute("user") CustomUserDetails user) {
        String response = folderService.deleteFolders(deleteFoldersDTO, userId, user);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/get")
    public ResponseEntity<List<FolderDTO>> getFoldersByUserId(@RequestParam String userId,
                                                              @RequestAttribute("user") CustomUserDetails user) {
        List<FolderDTO> folders = folderService.getFoldersByUserId(userId,user);
        return ResponseEntity.ok(folders);
    }
}
