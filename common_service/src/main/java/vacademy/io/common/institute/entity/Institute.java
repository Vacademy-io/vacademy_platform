package vacademy.io.common.institute.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.UuidGenerator;
import vacademy.io.common.institute.dto.InstituteInfoDTO;

import java.sql.Timestamp;
import java.util.Date;

@Data
@Builder
@ToString
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "institutes")
public class Institute {

    @Id
    @UuidGenerator
    @Column(name = "id")
    private String id;

    @Column(name = "name")
    private String instituteName;

    @Column(name = "address_line")
    private String address;

    @Column(name = "pin_code")
    private String pinCode;

    @Column(name = "mobile_number")
    private String mobileNumber;

    @Column(name = "logo_file_id")
    private String logoFileId;

    @Column(name = "language")
    private String Language;

    @Column(name = "institute_theme_code")
    private String instituteThemeCode;

    @Column(name = "website_url")
    private String websiteUrl;

    @Column(name = "description")
    private String description;

    @Column(name = "type")
    private String instituteType;

    @Column(name = "held")
    private String heldBy;

    @Column(name = "founded_date")
    private Timestamp foundedData;

    @Column(name = "country")
    private  String country;

    @Column(name = "state")
    private String state;

    @Column(name = "city")
    private String city;

    @Column(name = "email")
    private String email;


    @Column(name = "updated_at", insertable = false, updatable = false)
    private Date updatedAt;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Date createdAt;

}
