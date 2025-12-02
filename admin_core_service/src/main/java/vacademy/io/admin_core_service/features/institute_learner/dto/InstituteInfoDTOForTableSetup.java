package vacademy.io.admin_core_service.features.institute_learner.dto;


import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import jakarta.persistence.Column;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.sql.Timestamp;
import java.util.List;

import vacademy.io.common.institute.dto.*;
import vacademy.io.common.institute.entity.*;

@Data
@AllArgsConstructor
@NoArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class InstituteInfoDTOForTableSetup {
    private List<String> moduleRequestIds;
    private List<PackageSessionDTO> batchesForSessions;
    private List<LevelDTO> levels;
    private List<String> genders;
    private List<String> studentStatuses;
    private List<Integer> sessionExpiryDays;
    private List<PackageGroupDTO>packageGroups;
    private String letterHeadFileId;
    private List<String> tags;
}
