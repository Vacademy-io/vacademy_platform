package vacademy.io.common.auth.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.UuidGenerator;
import com.fasterxml.jackson.annotation.JsonIgnore;
import org.hibernate.annotations.Where;
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
    @JsonIgnore
    @Column(name = "password_hash")
    private String password;
    @Column(name = "full_name")
    private String fullName;
    @OneToMany(mappedBy = "user", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    @Where(clause = "status IN ('ACTIVE', 'INVITED')")
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

    @Column(name = "last_token_update_time")
    @Temporal(TemporalType.TIMESTAMP)
    private Date lastTokenUpdateTime;

    @Column(name = "last_login_time")
    @Temporal(TemporalType.TIMESTAMP)
    private Date lastLoginTime;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Timestamp createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Timestamp updatedAt;

    public UserTopLevelDto getUserTopLevelDto() {
        return UserTopLevelDto.builder()
                .fullName(this.fullName)
                .mobileNumber(this.mobileNumber)
                .id(this.id)
                .addressLine(this.addressLine)
                .gender(this.gender)
                .dateOfBirth(this.dateOfBirth)
                .isRootUser(this.isRootUser)
                .city(this.city)
                .email(this.email)
                .pinCode(this.pinCode)
                .profilePicFileId(this.profilePicFileId)
                .roles(this.roles != null ? roles.stream().map(UserRole::getRoleDto).toList() : new ArrayList<>())
                .build();
    }

    @PrePersist
    @PreUpdate
    private void normalizeEmails() {
        if (this.email != null) {
            this.email = this.email.toLowerCase();
        }
    }

    // Manual Getters and Setters to ensure compilation
    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getUsername() {
        return username;
    }

    public void setUsername(String username) {
        this.username = username;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public String getPassword() {
        return password;
    }

    public void setPassword(String password) {
        this.password = password;
    }

    public String getFullName() {
        return fullName;
    }

    public void setFullName(String fullName) {
        this.fullName = fullName;
    }

    public Set<UserRole> getRoles() {
        return roles;
    }

    public void setRoles(Set<UserRole> roles) {
        this.roles = roles;
    }

    public String getAddressLine() {
        return addressLine;
    }

    public void setAddressLine(String addressLine) {
        this.addressLine = addressLine;
    }

    public String getCity() {
        return city;
    }

    public void setCity(String city) {
        this.city = city;
    }

    public String getPinCode() {
        return pinCode;
    }

    public void setPinCode(String pinCode) {
        this.pinCode = pinCode;
    }

    public String getMobileNumber() {
        return mobileNumber;
    }

    public void setMobileNumber(String mobileNumber) {
        this.mobileNumber = mobileNumber;
    }

    public Date getDateOfBirth() {
        return dateOfBirth;
    }

    public void setDateOfBirth(Date dateOfBirth) {
        this.dateOfBirth = dateOfBirth;
    }

    public String getGender() {
        return gender;
    }

    public void setGender(String gender) {
        this.gender = gender;
    }

    public String getProfilePicFileId() {
        return profilePicFileId;
    }

    public void setProfilePicFileId(String profilePicFileId) {
        this.profilePicFileId = profilePicFileId;
    }

    public boolean isRootUser() {
        return isRootUser;
    }

    public void setRootUser(boolean rootUser) {
        isRootUser = rootUser;
    }

    public Date getLastTokenUpdateTime() {
        return lastTokenUpdateTime;
    }

    public void setLastTokenUpdateTime(Date lastTokenUpdateTime) {
        this.lastTokenUpdateTime = lastTokenUpdateTime;
    }

    public Date getLastLoginTime() {
        return lastLoginTime;
    }

    public void setLastLoginTime(Date lastLoginTime) {
        this.lastLoginTime = lastLoginTime;
    }

    public Timestamp getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Timestamp createdAt) {
        this.createdAt = createdAt;
    }

    public Timestamp getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(Timestamp updatedAt) {
        this.updatedAt = updatedAt;
    }

}
