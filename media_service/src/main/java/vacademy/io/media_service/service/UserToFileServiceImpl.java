package vacademy.io.media_service.service;

import jakarta.transaction.Transactional;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.media_service.dto.UserToFileDTO;
import vacademy.io.media_service.entity.UserToFile;
import vacademy.io.media_service.enums.FileStatusEnum;
import vacademy.io.media_service.repository.UserToFileRepository;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

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
                    userToFileDTO.setFolderIconDetail(fileService.getFileDetailsWithExpiryAndId(userFile.getFolderIcon().getId(),1));
                }
                userToFileDTOS.add(userToFileDTO);
            }
        }
        return userToFileDTOS;
    }

    @Override
    @Transactional
    public String deleteFileByFileId(String fileId) {
        if (Objects.isNull(fileId)) {
            throw new VacademyException("file Id cannot be null");
        }
        UserToFile userToFile = userToFileRepository.findByFileIdAndStatus(fileId,FileStatusEnum.ACTIVE.name()).orElse(null);
        if (Objects.isNull(userToFile)) {
            throw new VacademyException("File not found!!!");
        }
        userToFile.setStatus(FileStatusEnum.DELETED.name());
        Integer result = userToFileRepository.updateStatusByFileId(userToFile.getId(),FileStatusEnum.DELETED.name(),FileStatusEnum.ACTIVE.name());
        if (result == 0) {
            return "File status update failed!!!";
        }
        return "File deleted successfully!!!";
    }

    @Override
    public List<UserToFileDTO> getUserFilesByFolderAndUserId(String folderName, String userId) {
        if (Objects.isNull(folderName) || Objects.isNull(userId)) {
            throw new VacademyException("folderName and userId cannot be null");
        }
        List<UserToFile> userFiles = userToFileRepository.findByFolderAndUserIdAndStatus(folderName,userId,FileStatusEnum.ACTIVE.name());
        List<UserToFileDTO>userToFileDTOS = new ArrayList<>();
        if (Objects.nonNull(userFiles) && !userFiles.isEmpty()) {
            for(UserToFile userFile : userFiles) {
                UserToFileDTO userToFileDTO = userFile.mapToUserToFileDTO();
                userToFileDTO.setFileDetail(fileService.getFileDetailsWithExpiryAndId(userFile.getFile().getId(),1));
                if (Objects.nonNull(userFile.getFolderIcon())){
                    userToFileDTO.setFolderIconDetail(fileService.getFileDetailsWithExpiryAndId(userFile.getFolderIcon().getId(),1));
                }
                userToFileDTOS.add(userToFileDTO);
            }
        }
        return userToFileDTOS;
    }

    @Override
    public UserToFileDTO getUserFile(String userId, String fileId) {
        // Validate input parameters
        if (Objects.isNull(userId) || Objects.isNull(fileId)) {
            throw new VacademyException("userId and fileId cannot be null");
        }

        // Fetch the user file record
        UserToFile userFile = userToFileRepository.findByUserIdAndFileIdAndStatus(userId, fileId, FileStatusEnum.ACTIVE.name()).orElse(null);

        // If user file exists, map to DTO
        if (Objects.nonNull(userFile)) {
            UserToFileDTO userToFileDTO = userFile.mapToUserToFileDTO();

            // Handle null values in file or folderIcon and set the details if they are not null
            if (Objects.nonNull(userFile.getFile())) {
                userToFileDTO.setFileDetail(fileService.getFileDetailsWithExpiryAndId(userFile.getFile().getId(), 1));
            } else {
                // Optionally handle the case when file is null, e.g., log or set a default value
                userToFileDTO.setFileDetail(null); // Or some default
            }

            if (Objects.nonNull(userFile.getFolderIcon())) {
                userToFileDTO.setFolderIconDetail(fileService.getFileDetailsWithExpiryAndId(userFile.getFolderIcon().getId(), 1));
            } else {
                // handle the case when folderIcon is null
                userToFileDTO.setFolderIconDetail(null);
            }

            return userToFileDTO;
        }

        // Return null if no user file is found
        return null;
    }

}
