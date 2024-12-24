package vacademy.io.media_service.service;

import jakarta.transaction.Transactional;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.common.media.utils.MediaUtil;
import vacademy.io.media_service.dto.UserToFileDTO;
import vacademy.io.media_service.entity.UserToFile;
import vacademy.io.media_service.enums.FileStatusEnum;
import vacademy.io.media_service.repository.UserToFileRepository;

import java.util.*;
import java.util.stream.Collectors;

@Service
public class UserToFileServiceImpl implements UserToFileService {

    @Autowired
    private FileServiceImpl fileService;

    @Autowired
    private UserToFileRepository userToFileRepository;

    @Override
    public List<UserToFileDTO> getUserFilesByUserId(String userId) {
        if (Objects.isNull(userId)) {
            throw new VacademyException("userId cannot be null");
        }
        List<UserToFile> userFiles = userToFileRepository.findByUserIdAndStatus(userId, FileStatusEnum.ACTIVE.name());
        List<UserToFileDTO>userToFileDTOS = new ArrayList<>();
        if (Objects.nonNull(userFiles) && !userFiles.isEmpty()) {
            for(UserToFile userFile : userFiles) {
                UserToFileDTO userToFileDTO = userFile.mapToUserToFileDTO();
                userToFileDTO.setFileDetail(fileService.getFileDetailsWithExpiryAndId(userFile.getFile().getId(),1));
                if (Objects.nonNull(userFile.getFolderIcon())){
                    userToFileDTO.setFolderIconUrl(fileService.getPublicUrlWithExpiry(userFile.getFolderIcon().getId(),1));
                }
                userToFileDTOS.add(userToFileDTO);
            }
        }
        return userToFileDTOS;
    }

    @Override
    @Transactional
    public String deleteFilesByFileIds(String fileIds) {
        if (Objects.isNull(fileIds)) {
            throw new VacademyException("fileIds cannot be null");
        }

        // Parse file IDs into a list
        List<String> fileIdsList = MediaUtil.getFileIdsFromParam(fileIds);

        for (String fileId : fileIdsList) {
            UserToFile userToFile = userToFileRepository.findByFileIdAndStatus(fileId, FileStatusEnum.ACTIVE.name()).orElse(null);
            if (Objects.isNull(userToFile)) {
                throw new VacademyException("File with ID " + fileId + " not found!!!");
            }
            userToFile.setStatus(FileStatusEnum.DELETED.name());
            userToFileRepository.save(userToFile);
        }

        return fileIdsList.size() + " file(s) deleted successfully!!!";
    }


    @Override
    public Map<String, List<UserToFileDTO>> getUserFilesByFoldersAndUserId(String folderNames, String userId) {
        // Validate input parameters
        if (Objects.isNull(folderNames) || Objects.isNull(userId)) {
            throw new VacademyException("folderNames and userId cannot be null");
        }

        // Parse folder names into a list
        List<String> folderNamesList = MediaUtil.getFolderNamesFromParam(folderNames);

        // Prepare result map
        Map<String, List<UserToFileDTO>> result = new HashMap<>();

        for (String folderName : folderNamesList) {
            // Fetch user files for the current folder
            List<UserToFile> userFiles = userToFileRepository
                    .findByFolderAndUserIdAndStatus(folderName, userId, FileStatusEnum.ACTIVE.name());

            if (Objects.isNull(userFiles) || userFiles.isEmpty()) {
                result.put(folderName, Collections.emptyList());
                continue;
            }

            // Map user files to DTOs
            List<UserToFileDTO> userToFileDTOS = userFiles.stream()
                    .map(userFile -> {
                        UserToFileDTO userToFileDTO = userFile.mapToUserToFileDTO();

                        // Set file details
                        if (Objects.nonNull(userFile.getFile())) {
                            userToFileDTO.setFileDetail(
                                    fileService.getFileDetailsWithExpiryAndId(userFile.getFile().getId(), 1)
                            );
                        } else {
                            userToFileDTO.setFileDetail(null);
                        }

                        // Set folder icon details
                        if (Objects.nonNull(userFile.getFolderIcon())) {
                            userToFileDTO.setFolderIconUrl(
                                    fileService.getPublicUrlWithExpiry(userFile.getFolderIcon().getId(), 1)
                            );
                        } else {
                            userToFileDTO.setFolderIconUrl(null);
                        }

                        return userToFileDTO;
                    })
                    .collect(Collectors.toList());

            result.put(folderName, userToFileDTOS);
        }

        return result;
    }


    @Override
    public List<UserToFileDTO> getUserFiles(String userId, String fileId) {
        // Validate input parameters
        if (Objects.isNull(userId) || Objects.isNull(fileId)) {
            throw new VacademyException("userId and fileId cannot be null");
        }

        List<String> dividedFileIds = MediaUtil.getFileIdsFromParam(fileId);
        List<UserToFileDTO> userToFileDTOS = new ArrayList<>();

        for (String file : dividedFileIds) {
            // Fetch the user file record
            UserToFile userFile = userToFileRepository
                    .findByUserIdAndFileIdAndStatus(userId, file, FileStatusEnum.ACTIVE.name())
                    .orElse(null);

            // If user file exists, map to DTO
            if (Objects.nonNull(userFile)) {
                UserToFileDTO userToFileDTO = userFile.mapToUserToFileDTO();

                // Handle file details
                if (Objects.nonNull(userFile.getFile())) {
                    userToFileDTO.setFileDetail(
                            fileService.getFileDetailsWithExpiryAndId(userFile.getFile().getId(), 1)
                    );
                } else {
                    userToFileDTO.setFileDetail(null);
                }

                // Handle folder icon details
                if (Objects.nonNull(userFile.getFolderIcon())) {
                    userToFileDTO.setFolderIconUrl(
                            fileService.getPublicUrlWithExpiry(userFile.getFolderIcon().getId(), 1)
                    );
                } else {
                    userToFileDTO.setFolderIconUrl(null);
                }

                userToFileDTOS.add(userToFileDTO);
            }
        }

        return userToFileDTOS;
    }

}
