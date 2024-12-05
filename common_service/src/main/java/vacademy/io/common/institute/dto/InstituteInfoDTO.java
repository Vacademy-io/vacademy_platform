package vacademy.io.common.institute.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.sql.Timestamp;
import java.util.List;

@Data
@AllArgsConstructor
@NoArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class InstituteInfoDTO {
    private String instituteName;
    private String id;
    private  String country;
    private String state;
    private String city;
    private String address;
    private String pinCode;
    private String phone;
    private String email;
    private String websiteUrl;
    private String instituteLogoFileId;
    private String instituteThemeCode;
    private String language;
    private String description;
    private String type;
    private String heldBy;
    private Timestamp foundedDate;
    private List<InstituteSubModuleDTO> subModules;
    private List<SessionDTO> sessions;
    private List<PackageSessionDTO> batchesForSessions;
    private List<LevelDTO> levels;
    private List<String> genders;
    private List<String> studentStatuses;
}
