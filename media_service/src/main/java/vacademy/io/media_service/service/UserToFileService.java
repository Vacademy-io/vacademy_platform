package vacademy.io.media_service.service;

import vacademy.io.media_service.dto.UserToFileDTO;
import vacademy.io.media_service.entity.UserToFile;

import java.util.List;

public interface UserToFileService {
    List<UserToFileDTO>getUserFilesByUserId(String userId);
    String deleteFileByFileId(String fileId);
    List<UserToFileDTO>getUserFilesByFolderAndUserId(String folderName,String userId);
    UserToFileDTO getUserFile(String userId, String fileId);
}
