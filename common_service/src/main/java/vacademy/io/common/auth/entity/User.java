package vacademy.io.common.auth.entity;


import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.UuidGenerator;
import vacademy.io.common.auth.dto.UserTopLevelDto;

import java.sql.Timestamp;
import java.util.ArrayList;
import java.util.Date;
import java.util.Set;


@Getter
@Setter
@Builder
@ToString
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "users")
public class User {

    @Id
    @UuidGenerator
    @Column(name = "id")
    private String id;
    @Column(name = "username")
    private String username;
    @Column(name = "email")
    private String email;
    @Column(name = "password_hash")
    private String password;
    @Column(name = "full_name")
    private String fullName;

    @OneToMany(mappedBy = "user", cascade = CascadeType.ALL, fetch = FetchType.LAZY) // Adjust mapping as necessary
    private Set<UserRole> roles;

    @Column(name = "address_line")
    private String addressLine;

    @Column(name = "city")
    private String city;

    @Column(name = "pin_code")
    private String pinCode;

    @Column(name = "mobile_number")
    private String mobileNumber;

    @Column(name = "date_of_birth")
    private Date dateOfBirth;

    @Column(name = "gender")
    private String gender;

    @Column(name = "profile_pic_file_id")
    private String profilePicFileId;

    @Column(name = "is_root_user")
    private boolean isRootUser;


    @Column(name = "created_at", insertable = false, updatable = false)
    private Timestamp createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Timestamp updatedAt;

    public UserTopLevelDto getUserTopLevelDto(){
        return UserTopLevelDto.builder()
                .id(this.id)
                .addressLine(this.addressLine)
                .gender(this.gender)
                .dateOfBirth(this.dateOfBirth)
                .isRootUser(this.isRootUser)
                .city(this.city)
                .email(this.email)
                .pinCode(this.pinCode)
                .profilePicFileId(this.profilePicFileId)
                .roles(this.roles!=null ? roles.stream().map(UserRole::getRoleDto).toList() : new ArrayList<>())
                .build();
    }

}
