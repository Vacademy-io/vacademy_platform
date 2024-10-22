package vacademy.io.common.auth.entity;


import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.UuidGenerator;

import java.util.*;


@Data
@Builder
@ToString
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "USERS")
public class User {

    @Id
    @UuidGenerator
    @Column(name = "id")
    private String id;
    private String username;
    @JsonIgnore
    private String password;
    private String firstname;
    private String lastname;
    @ManyToMany(fetch = FetchType.EAGER)
    private Set<UserRole> roles = new HashSet<>();
    private String type;
    private String nickname;
    private String faceFileId;
    private Date lastLogin;

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
