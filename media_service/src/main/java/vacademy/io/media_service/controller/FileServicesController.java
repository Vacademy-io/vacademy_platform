package vacademy.io.media_service.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.media_service.dto.UserToFileDTO;
import vacademy.io.media_service.service.UserToFileService;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/media")
public class FileServicesController {

    @Autowired
    private UserToFileService userToFileService;

    @GetMapping("/get-user-files/{userId}")
    public ResponseEntity<List<UserToFileDTO>> getUserFilesByUserId(@PathVariable("userId") String userId) {
        return ResponseEntity.ok(userToFileService.getUserFilesByUserId(userId));
    }

    @DeleteMapping("/delete-file/{fileIds}")
    public ResponseEntity<String> deleteFileByFileId(@PathVariable("fileIds") String fileIds) {
        return ResponseEntity.ok(userToFileService.deleteFilesByFileIds(fileIds));
    }

    @GetMapping("/get-user-files-by-folders/{folderNames}/{userId}")
    public ResponseEntity<Map<String, List<UserToFileDTO>>> getUserFilesByFolder(@PathVariable("folderNames") String folderNames, @PathVariable("userId") String userId) {
        return ResponseEntity.ok(userToFileService.getUserFilesByFoldersAndUserId(folderNames,userId));
    }

    @GetMapping("/get-user-file/{userId}/{fileIds}")
    public ResponseEntity<List<UserToFileDTO>> getUserFile(@PathVariable("userId") String userId,@PathVariable("fileIds") String fileIds) {
        return ResponseEntity.ok(userToFileService.getUserFiles(userId,fileIds));
    }
}
