package vacademy.io.common.auth.model;

import vacademy.io.common.auth.dto.UserServiceDTO;
import vacademy.io.common.auth.entity.User;
import vacademy.io.common.auth.entity.UserRole;
import lombok.Getter;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

import java.util.ArrayList;
import java.util.Collection;
import java.util.List;

public class CustomUserDetails extends User implements UserDetails {

    private final String username;
    private final String password;

    @Getter
    private final String userId;
    Collection<? extends GrantedAuthority> authorities;


    /**
     * Constructor for CustomUserDetails, creating an instance from a User object.
     *
     * @param user The User object to extract details from.
     */
    public CustomUserDetails(User user) {
        // Set the username from the provided User object
        this.username = user.getUsername();

        // Set the password securely from the User object
        this.password = user.getPassword();
        this.userId = user.getId();

        // Create a list to store GrantedAuthority objects
        List<GrantedAuthority> auths = new ArrayList<>();

        // Iterate through each UserRole for the user
        for (UserRole role : user.getRoles()) {
            // Get individual authorities from the role and convert them to uppercase GrantedAuthority objects
            role.getAuthorities().forEach(userAuthority -> auths.add(new SimpleGrantedAuthority(userAuthority.getName().toUpperCase())));

            // Add the role name itself as a GrantedAuthority (also in uppercase)
            auths.add(new SimpleGrantedAuthority(role.getName().toUpperCase()));
        }

        // Assign the collected authorities to the this.authorities field
        this.authorities = auths;
    }

    public CustomUserDetails(UserServiceDTO user) {
        // Set the username from the provided User object
        this.username = user.getUsername();
        this.password = "";
        this.userId = user.getUserId();

        // Create a list to store GrantedAuthority objects
        List<GrantedAuthority> auths = new ArrayList<>();

        // Iterate through each UserRole for the user
        for (UserServiceDTO.Authority auth : user.getAuthorities()) {

            // Add the role name itself as a GrantedAuthority (also in uppercase)
            auths.add(new SimpleGrantedAuthority(auth.getAuthority().toUpperCase()));
        }

        // Assign the collected authorities to the this.authorities field
        this.authorities = auths;
    }

    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        return authorities;
    }

    @Override
    public String getPassword() {
        return password;
    }

    @Override
    public String getUsername() {
        return username;
    }

    @Override
    public boolean isAccountNonExpired() {
        return true;
    }

    @Override
    public boolean isAccountNonLocked() {
        return true;
    }

    @Override
    public boolean isCredentialsNonExpired() {
        return true;
    }

    @Override
    public boolean isEnabled() {
        return true;
    }

}