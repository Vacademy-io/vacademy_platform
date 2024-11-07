package vacademy.io.common.auth.entity;



import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.UuidGenerator;
import vacademy.io.common.auth.enums.Gender;

import java.sql.Timestamp;
import java.time.LocalDate;
import java.util.*;


@Data
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

    @ManyToMany(fetch = FetchType.EAGER)
    @JoinTable(
            name = "user_role",
            joinColumns = @JoinColumn(name = "user_id"),
            inverseJoinColumns = @JoinColumn(name = "role_id")
    )
    private Set<UserRole> roles = new HashSet<>();

    @Column(name = "address_line")
    private String addressLine;

    @Column(name = "city")
    private String city;

    @Column(name = "pin_code")
    private String pinCode;

    @Column(name = "mobile_number")
    private String mobileNumber;

    @Column(name = "date_of_birth")
    private LocalDate dateOfBirth;

    @Enumerated(EnumType.STRING)
    @Column(name = "gender")
    private Gender gender;

    @Column(name = "is_root_user")
    private boolean isRootUser;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Timestamp createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Timestamp updatedAt;


    public List<String> getAllAuth() {
        // Create a list to store GrantedAuthority objects
        List<String> auths = new ArrayList<>();

        // Iterate through each UserRole for the user
        for (UserRole role : roles) {
            // Get individual authorities from the role and convert them to uppercase GrantedAuthority objects
            role.getAuthorities().forEach(userAuthority -> auths.add(userAuthority.getName().toUpperCase()));

            // Add the role name itself as a GrantedAuthority (also in uppercase)
            auths.add(role.getName().toUpperCase());
        }
        return auths;
    }



}
