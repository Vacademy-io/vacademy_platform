package vacademy.io.media_service.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.media_service.dto.UserToFileDTO;
import vacademy.io.media_service.service.UserToFileService;

import java.util.List;

@RestController
@RequestMapping("/media")
public class FileServicesController {

    @Autowired
    private UserToFileService userToFileService;

    @GetMapping("/get-user-files/{userId}")
    public ResponseEntity<List<UserToFileDTO>> getUserFilesByUserId(@PathVariable("userId") String userId) {
        return ResponseEntity.ok(userToFileService.getUserFilesByUserId(userId));
    }

    @DeleteMapping("/delete-file/{fileId}")
    public ResponseEntity<String> deleteFileByFileId(@PathVariable("fileId") String fileId) {
        return ResponseEntity.ok(userToFileService.deleteFileByFileId(fileId));
    }

    @GetMapping("/get-user-files-by-folder/{folderName}/{userId}")
    public ResponseEntity<List<UserToFileDTO>> getUserFilesByFolder(@PathVariable("folderName") String folderName,@PathVariable("userId") String userId) {
        return ResponseEntity.ok(userToFileService.getUserFilesByFolderAndUserId(folderName,userId));
    }

    @GetMapping("/get-user-file/{userId}/{fileId}")
    public ResponseEntity<UserToFileDTO> getUserFile(@PathVariable("userId") String userId,@PathVariable("fileId") String fileId) {
        return ResponseEntity.ok(userToFileService.getUserFile(userId,fileId));
    }
}
