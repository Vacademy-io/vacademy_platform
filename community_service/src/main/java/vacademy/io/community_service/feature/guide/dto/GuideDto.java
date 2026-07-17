package vacademy.io.community_service.feature.guide.dto;

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
public class GuideDto {
    private String id;
    private String title;
    private String fileId;
    private String fileUrl;
    private List<String> routes;
    private boolean active;
    private Date createdAt;
    private Date updatedAt;
}
