package vacademy.io.community_service.feature.trainingvideo.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Date;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TrainingVideoDto {
    private String id;
    private String title;
    private String description;
    private String fileId;
    private String fileUrl;
    /** Breadcrumb segments, e.g. ["LMS","Course creation","AI based course"]. */
    private List<String> modulePath;
    private boolean active;
    private Date createdAt;
    private Date updatedAt;
}
