package vacademy.io.media_service.service;

import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.media_service.dto.UserToFileDTO;

import java.util.List;
import java.util.Map;

public interface UserToFileService {
    List<UserToFileDTO>getUserFilesByUserId(String userId);
    String deleteFilesByFileIds(String fileIds);
    Map<String, List<UserToFileDTO>>getUserFilesByFoldersAndUserId(String folderNames, String userId);
    List<UserToFileDTO> getUserFiles(String userId, String fileIds);
}