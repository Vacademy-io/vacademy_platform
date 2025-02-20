package vacademy.io.admin_core_service.features.documents.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.documents.dto.DeleteDocumentsDTO;
import vacademy.io.admin_core_service.features.documents.dto.DocumentDTO;
import vacademy.io.admin_core_service.features.documents.service.DocumentService;
import vacademy.io.common.auth.model.CustomUserDetails;

import java.util.List;

@RestController
@RequestMapping("/admin-core-service/documents/v1")
public class DocumentController {
    private final DocumentService documentService;

    public DocumentController(DocumentService documentService) {
        this.documentService = documentService;
    }

    @PostMapping("/add-documents")
    public ResponseEntity<String> addDocuments(@RequestBody List<DocumentDTO> addDocuments,
                                               @RequestParam String userId,
                                               @AuthenticationPrincipal CustomUserDetails user) {
        String response = documentService.addDocuments(addDocuments, userId, user);
        return ResponseEntity.ok(response);
    }

    @DeleteMapping("/delete")
    public ResponseEntity<String> deleteDocuments(@RequestBody DeleteDocumentsDTO deleteDocumentsDTO,
                                                  @RequestParam String userId,
                                                  @AuthenticationPrincipal CustomUserDetails user) {
        String response = documentService.deleteDocuments(deleteDocumentsDTO, userId, user);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/get-for-user-folder")
    public ResponseEntity<List<DocumentDTO>> getDocumentsByUserIdAndFolderId(@RequestParam String userId,
                                                                             @RequestParam String folderId,
                                                                             @RequestAttribute("user") CustomUserDetails userDetails) {
        List<DocumentDTO> documents = documentService.getDocumentsByUserIdAndFolderId(userId, folderId);
        return ResponseEntity.ok(documents);
    }

    @GetMapping("/get-for-user")
    public ResponseEntity<List<DocumentDTO>> getDocumentsByUserId(@RequestParam String userId, @RequestAttribute("user") CustomUserDetails userDetails) {
        List<DocumentDTO> documents = documentService.getDocumentsByUserId(userId);
        return ResponseEntity.ok(documents);
    }

    @PostMapping("/add-document")
    public ResponseEntity<DocumentDTO> getDocumentsByUserId(@RequestParam String userId,@RequestBody DocumentDTO documentDTO, @RequestAttribute("user") CustomUserDetails userDetails) {
        return ResponseEntity.ok(documentService.addDocument(documentDTO, userId, userDetails));
    }
}
