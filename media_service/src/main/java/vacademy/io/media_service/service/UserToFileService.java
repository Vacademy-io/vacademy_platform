package vacademy.io.media_service.service;

import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.media_service.dto.UserToFileDTO;

import java.util.List;
import java.util.Map;

public interface UserToFileService {
    List<UserToFileDTO>getUserFilesByUserId(CustomUserDetails userDetails, String userId);
    String deleteFilesByFileIds(CustomUserDetails userDetails,String fileIds);
    Map<String, List<UserToFileDTO>>getUserFilesByFoldersAndUserId(CustomUserDetails userDetails,String folderNames, String userId);
    List<UserToFileDTO> getUserFiles(CustomUserDetails userDetails,String userId, String fileIds);
}
