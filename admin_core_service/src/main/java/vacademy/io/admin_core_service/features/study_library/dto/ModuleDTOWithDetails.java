package vacademy.io.admin_core_service.features.study_library.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategy;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;
import vacademy.io.admin_core_service.features.chapter.dto.ChapterDTOWithDetail;
import vacademy.io.admin_core_service.features.module.dto.ModuleDTO;

import java.util.List;

@JsonNaming(PropertyNamingStrategy.SnakeCaseStrategy.class)
@Data
public class ModuleDTOWithDetails {
    private ModuleDTO module;
    private List<ChapterDTOWithDetail> chapters;

    public ModuleDTOWithDetails(ModuleDTO module, List<ChapterDTOWithDetail> chapters) {
        this.module = module;
        this.chapters = chapters;
    }
}
