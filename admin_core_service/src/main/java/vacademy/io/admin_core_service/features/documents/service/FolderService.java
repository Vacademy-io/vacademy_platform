package vacademy.io.admin_core_service.features.documents.service;

import lombok.AllArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import vacademy.io.admin_core_service.features.documents.dto.DeleteFoldersDTO;
import vacademy.io.admin_core_service.features.documents.dto.FolderDTO;
import vacademy.io.admin_core_service.features.documents.entity.Folder;
import vacademy.io.admin_core_service.features.documents.enums.FolderStatusEnum;
import vacademy.io.admin_core_service.features.documents.repository.FolderRepository;
import vacademy.io.common.auth.model.CustomUserDetails;

import java.util.Arrays;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
@AllArgsConstructor
public class FolderService {
    private final FolderRepository folderRepository;

    public String addFolders(List<FolderDTO> addFolders, String userId, CustomUserDetails userDetails) {
        validateUser(userId);

        if (addFolders == null || addFolders.isEmpty()) {
            throw new IllegalArgumentException("Folder list cannot be empty");
        }

        List<Folder> folders = addFolders.stream()
                .map(Folder::new)
                .toList();

        folderRepository.saveAll(folders);
        return "Folders added successfully";
    }

    public String deleteFolders(DeleteFoldersDTO deleteFoldersDTO, String userId, CustomUserDetails userDetails) {
        validateUser(userId);

        if (deleteFoldersDTO == null || !StringUtils.hasText(deleteFoldersDTO.getCommaSeparatedFolderIds())) {
            throw new IllegalArgumentException("Folder IDs cannot be null or empty");
        }

        List<String> folderIds = getIds(deleteFoldersDTO.getCommaSeparatedFolderIds());
        List<Folder> folders = folderIds.stream()
                .map(folderId -> folderRepository.findById(folderId))
                .filter(Optional::isPresent)
                .map(Optional::get)
                .toList();

        if (folders.isEmpty()) {
            throw new IllegalArgumentException("No valid folders found for deletion");
        }

        folders.forEach(folder -> folder.setStatus(FolderStatusEnum.DELETED.name()));
        folderRepository.saveAll(folders);
        return "Folders deleted successfully";
    }

    public List<String> getIds(String commaSeparatedIds) {
        if (!StringUtils.hasText(commaSeparatedIds)) {
            throw new IllegalArgumentException("Comma-separated IDs cannot be null or empty");
        }
        return Arrays.stream(commaSeparatedIds.split(","))
                .map(String::trim)
                .filter(id -> !id.isEmpty())
                .collect(Collectors.toList());
    }

    public List<FolderDTO> getFoldersByUserId(String userId, CustomUserDetails userDetails) {
        validateUser(userId);
        return folderRepository.findByUserIdAndStatusNot(userId, FolderStatusEnum.DELETED.name()).stream()
                .map(Folder::mapToFolderDTO)
                .toList();
    }

    public FolderDTO addFolder(FolderDTO folderDTO, String userId, CustomUserDetails userDetails) {
        validateUser(userId);

        if (folderDTO == null) {
            throw new IllegalArgumentException("Folder data cannot be null");
        }

        Folder folder = new Folder(folderDTO);
        folderRepository.save(folder);
        return folder.mapToFolderDTO();
    }

    private void validateUser(String userId) {
        if (!StringUtils.hasText(userId)) {
            throw new IllegalArgumentException("User ID cannot be null or empty");
        }
    }
}
