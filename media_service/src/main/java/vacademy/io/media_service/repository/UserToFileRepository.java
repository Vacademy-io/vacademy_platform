package vacademy.io.media_service.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import vacademy.io.media_service.entity.UserToFile;

import java.util.List;
import java.util.Optional;

public interface UserToFileRepository extends JpaRepository<UserToFile, String> {
    List<UserToFile> findByUserIdAndStatus(String userId, String status);

    Optional<UserToFile> findByFileIdAndStatus(String fileId, String status);


    @Query("SELECT u FROM UserToFile u WHERE u.folderName = :folderName AND u.userId = :userId AND u.status = :status")
    List<UserToFile> findByFolderAndUserIdAndStatus(@Param("folderName") String folderName,
                                                    @Param("userId") String userId,
                                                    @Param("status") String status);

    Optional<UserToFile> findByUserIdAndFileIdAndStatus(String userId, String fileId, String status);
}
