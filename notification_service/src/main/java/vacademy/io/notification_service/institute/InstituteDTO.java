package vacademy.io.notification_service.institute;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.sql.Timestamp;
import java.util.Date;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class InstituteDTO {

    private String id;
    private String instituteName;
    private String address;
    private String pinCode;
    private String mobileNumber;
    private String logoFileId;
    private String language;
    private String instituteThemeCode;
    private String websiteUrl;
    private String description;
    private String instituteType;
    private String heldBy;
    private Timestamp foundedData;
    private String country;
    private String state;
    private String city;
    private String email;
    private String letterHeadFileId;
    private String subdomain;
    private String setting;
    private Date updatedAt;
    private Date createdAt;
    private String coverImageFileId;
    private String coverTextJson;
}
