package vacademy.io.admin_core_service.features.documents.service;

import lombok.AllArgsConstructor;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.documents.dto.DeleteFoldersDTO;
import vacademy.io.admin_core_service.features.documents.dto.FolderDTO;
import vacademy.io.admin_core_service.features.documents.entity.Folder;
import vacademy.io.admin_core_service.features.documents.enums.FolderStatusEnum;
import vacademy.io.admin_core_service.features.documents.repository.FolderRepository;
import vacademy.io.common.auth.model.CustomUserDetails;

import java.util.Arrays;
import java.util.List;

@Service
@AllArgsConstructor
public class FolderService {
    private final FolderRepository folderRepository;

    public String addFolders(List<FolderDTO> addFolders, String userId, CustomUserDetails userDetails) {
        List<Folder> folders = addFolders.stream().map(folderDTO -> new Folder(folderDTO)).toList();
        folderRepository.saveAll(folders);
        return "Folders added successfully";
    }

    public String deleteFolders(DeleteFoldersDTO deleteFoldersDTO, String userId, CustomUserDetails userDetails) {
        List<Folder> folders = getIds(deleteFoldersDTO.getCommaSeparatedFolderIds()).stream().map(folderId -> folderRepository.findById(folderId).get()).toList();
        for (Folder folder : folders) {
            folder.setStatus("DELETED");
        }
        folderRepository.saveAll(folders);
        return "Folders added successfully";
    }

    public List<String> getIds(String commaSeparatedIds) {
        return Arrays.stream(commaSeparatedIds.split(",")).toList();
    }

    public List<FolderDTO> getFoldersByUserId(String userId, CustomUserDetails userDetails) {
        return folderRepository.findByUserIdAndStatusNot(userId, FolderStatusEnum.DELETED.name()).stream().map((folder) -> folder.mapToFolderDTO()).toList();
    }
}
