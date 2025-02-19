package vacademy.io.admin_core_service.features.documents.service;

import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.documents.dto.DeleteDocumentsDTO;
import vacademy.io.admin_core_service.features.documents.dto.DocumentDTO;
import vacademy.io.admin_core_service.features.documents.entity.Document;
import vacademy.io.admin_core_service.features.documents.enums.DocumentAccessTypeEnum;
import vacademy.io.admin_core_service.features.documents.enums.DocumentStatusEnum;
import vacademy.io.admin_core_service.features.documents.enums.FolderStatusEnum;
import vacademy.io.admin_core_service.features.documents.repository.DocumentRepository;
import vacademy.io.common.auth.model.CustomUserDetails;

import java.util.Arrays;
import java.util.List;

@Service
public class DocumentService {
    private final DocumentRepository documentRepository;

    public DocumentService(DocumentRepository documentRepository) {
        this.documentRepository = documentRepository;
    }

    public String addDocuments(List<DocumentDTO> addDocuments, String userId, CustomUserDetails user) {
        List<Document> documents = addDocuments.stream().map(documentDTO -> new Document(documentDTO)).toList();
        documentRepository.saveAll(documents);
        return "Documents added successfully";
    }

    public String deleteDocuments(DeleteDocumentsDTO deleteDocumentsDTO, String userId, CustomUserDetails user) {
        List<String> ids = getIds(deleteDocumentsDTO.getCommaSeparatedIds());
        List<Document> documents = documentRepository.findAllById(ids);
        for (Document document : documents) {
            document.setStatus(DocumentStatusEnum.DELETED.name());
        }
        documentRepository.saveAll(documents);
        return "Documents deleted successfully";
    }

    public List<String> getIds(String commaSeparatedIds) {
        return Arrays.stream(commaSeparatedIds.split(",")).toList();
    }

    public List<DocumentDTO> getDocumentsByUserIdAndFolderId(String userId, String folderId) {
        return documentRepository.findByUserIdAndFolderIdAndStatusNotAndAccessTypeIn(userId, folderId, DocumentStatusEnum.DELETED.name(), List.of(DocumentAccessTypeEnum.BOTH.name(), DocumentAccessTypeEnum.ADMIN.name())).stream().map(document -> document.mapToDocumentDTO()).toList();
    }

    public List<DocumentDTO> getDocumentsByUserId(String userId) {
        return documentRepository.findByUserIdAndStatusNotAndAccessTypeInAndFolder_StatusNot(userId, DocumentStatusEnum.DELETED.name(), List.of(DocumentAccessTypeEnum.BOTH.name(), DocumentAccessTypeEnum.ADMIN.name()), FolderStatusEnum.DELETED.name()).stream().map(document -> document.mapToDocumentDTO()).toList();
    }
}
