package vacademy.io.common.auth.service;


import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import vacademy.io.common.auth.dto.*;
import vacademy.io.common.auth.entity.Role;
import vacademy.io.common.auth.entity.User;
import vacademy.io.common.auth.entity.UserRole;
import vacademy.io.common.auth.enums.UserRoleStatus;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.auth.repository.RoleRepository;
import vacademy.io.common.auth.repository.UserRepository;
import vacademy.io.common.auth.repository.UserRoleRepository;
import vacademy.io.common.exceptions.*;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;
import java.util.stream.StreamSupport;


@Service
public class UserService {

    @Autowired
    UserRepository userRepository;

    @Autowired
    RoleRepository roleRepository;

    @Autowired
    UserRoleRepository userRoleRepository;

    public List<User> getUsersFromUserIds(List<String> userIds) {
        List<User> users = new ArrayList<>();

        userRepository.findAllById(userIds).forEach(u -> {
            if (u != null) users.add(u);
        });

        return users;
    }

    public User createUser(User user) {
        String username = user.getUsername().toLowerCase();
        user.setUsername(username);
        return userRepository.save(user);
    }

    @Transactional
    public void deleteUser(User user) {
        userRepository.delete(user);
    }

    public User updateUser(User user) {
        if (!StringUtils.hasText(user.getId())) throw new EmployeeNotFoundException("user id is null");

        return userRepository.save(user);
    }

    public void addRoleToUser(UserRoleRequestDTO userRoleRequestDTO) {

        String userId = userRoleRequestDTO.getUserId();
        String roleId = userRoleRequestDTO.getRoleId();

        if (userId == null || roleId == null) {
            throw new InvalidRequestException("userId and roleId are required.");
        }

        if (!ifRoleExist(roleId)) {
            throw new RoleNotFoundException("Role with Id " + roleId + " not found");
        } else if (!ifUserExist(userId)) {
            throw new UserNotFoundException("User with Id" + userId + "not found");
        }
        userRepository.addRoleToUser(userId, roleId);
    }

    public void addPermissionToUser(UserPermissionRequestDTO userPermissionRequestDTO) {

        String userId = userPermissionRequestDTO.getUserId();
        String permissionId = userPermissionRequestDTO.getPermissionId();

        if (userId == null || permissionId == null) {
            throw new InvalidRequestException("userId and permissionId are required");
        }

        if (!ifUserExist(userId)) {
            throw new UserNotFoundException("User with Id " + userId + " not found");
        } else if (!ifPermissionExist(permissionId)) {
            throw new UserWithPermissionNotFoundException("Permission with Id " + permissionId + "not found");

        }
        userRepository.addPermissionToUser(userId, permissionId);
    }

    public UserDTO getUserDetailsById(String userId) {

        List<User> results = userRepository.findUserDetailsById(userId);

        if (results.isEmpty()) {
            throw new UserNotFoundException("User with Id " + userId + " not found");
        }

        User user = results.get(0);
        return new UserDTO(user);
    }

    public List<UserDTO> getUserDetailsByIds(List<String> userIds) {

        List<User> users = userRepository.findUserDetailsByIds(userIds);

        return users.stream()
                .map(UserDTO::new)
                .collect(Collectors.toList());
    }

    public User getUserDetailsByUsername(String username) {

        List<User> results = userRepository.findUserDetailsByUsername(username);

        if (results.isEmpty()) {
            return null;
        }

        User user = results.get(0);
        return user;
    }


    public User getUserDetailsByEmail(String email) {

        List<User> results = userRepository.findUserDetailsByEmail(email);

        if (results.isEmpty()) {
            return null;
        }

        User user = results.get(0);
        return user;
    }

    public void removeRoleFromUser(UserRoleRequestDTO userRoleRequestDTO) {

        String userId = userRoleRequestDTO.getUserId();
        String roleId = userRoleRequestDTO.getRoleId();

        if (userId == null || roleId == null) {
            throw new InvalidRequestException("userId and RoleId are Required");
        }
        if (!ifRoleAndUserExist(userId, roleId)) {
            throw new UserWithRoleNotFoundException("User with Id " + userId + " and role Id " + roleId + " not found");
        }
        userRepository.removeRoleFromUser(userId, roleId);
    }

    public void removePermissionFromUser(UserPermissionRequestDTO userPermissionRequestDTO) {

        String userId = userPermissionRequestDTO.getUserId();
        String permissionId = userPermissionRequestDTO.getPermissionId();
        if (userId == null || permissionId == null) {
            throw new InvalidRequestException("userId and permissionId are Required");
        }

        if (!ifPermissionAndUserExist(userId, permissionId)) {
            throw new UserWithPermissionNotFoundException("User with Id " + userId + " and Permission Id " + permissionId + " not found");
        }
        userRepository.removePermissionFromUser(userId, permissionId);
    }

    private boolean ifPermissionAndUserExist(String userId, String permissionId) {

        return userRepository.existsByUserIdAndPermissionId(userId, permissionId);
    }

    private boolean ifRoleAndUserExist(String userId, String roleId) {

        return userRepository.existsByUserIdAndRoleId(userId, roleId);
    }

    public boolean ifUserExistByUserName(String userName) {
        return userRepository.existsByUserName(userName);
    }

    public boolean ifRoleExist(String roleId) {

        return userRepository.existsByRoleId(roleId);
    }

    public boolean ifUserExist(String userId) {

        return userRepository.existsByUserId(userId);
    }

    public boolean ifPermissionExist(String permissionId) {
        return userRepository.existsByPermissionId(permissionId);
    }


    public User createUserFromUserDto(UserDTO userDTO) {

        User user = new User();
        user.setUsername(userDTO.getUsername());
        user.setPassword(userDTO.getPassword());
        user.setEmail(userDTO.getEmail());
        user.setFullName(userDTO.getFullName());
        user.setAddressLine(userDTO.getAddressLine());
        user.setCity(userDTO.getCity());
        user.setPinCode(userDTO.getPinCode());
        user.setMobileNumber(userDTO.getMobileNumber());
        user.setDateOfBirth(userDTO.getDateOfBirth());
        user.setGender(userDTO.getGender());
        user.setRootUser(userDTO.isRootUser());
        User savedUser = userRepository.save(user);
        userDTO.setId(savedUser.getId());

        return savedUser;
    }

    public List<UserRole> addUserRoles(String instituteId, List<String> roles, User user, String status) {

        List<Role> rolesEntity = roleRepository.findByNameIn(roles);

        List<UserRole> userRoles = new ArrayList<>();

        if (user.getRoles() != null && !user.getRoles().isEmpty()) {
            userRoles = new ArrayList<>(user.getRoles());
        }

        for (Role role : rolesEntity) {
            UserRole userRole = new UserRole();
            userRole.setRole(role);
            userRole.setInstituteId(instituteId);
            userRole.setUser(user);
            userRole.setStatus(status);
            userRoles.add(userRole);
        }

        user.setRoles(new HashSet<>(userRoles));
        userRepository.save(user);
        return userRoles;
    }

    public List<UserWithRolesDTO> getUserDetailsByInstituteId(String instituteId, CustomUserDetails user) {
        return userRepository.findUsersWithRolesByInstituteId(instituteId).stream().map(UserWithRolesDTO::new).collect(Collectors.toList());
    }

    public List<UserWithRolesDTO> getUserDetailsByInstituteId(String instituteId, List<String> roles, CustomUserDetails user) {
        return userRepository.findUsersWithRolesByInstituteIdAndStatuses(instituteId, roles, List.of(UserRoleStatus.ACTIVE.name(), UserRoleStatus.DISABLED.name())).stream().map(UserWithRolesDTO::new).collect(Collectors.toList());
    }

    public UserCredentials getUserCredentials(String userId, CustomUserDetails user) {
        User userEntity = userRepository.findById(userId).orElseThrow(() -> new UserNotFoundException("User with Id " + userId + " not found"));
        UserCredentials userCredentials = new UserCredentials();
        userCredentials.setUsername(userEntity.getUsername());
        userCredentials.setPassword(userEntity.getPassword());
        return userCredentials;
    }

    public List<UserCredentials> getUsersCredentials(List<String> userIds) {
        Iterable<User> userEntities = userRepository.findAllById(userIds);
        return StreamSupport.stream(userEntities.spliterator(), false)
                .map(user -> new UserCredentials(user.getUsername(), user.getPassword(), user.getId(),user.getProfilePicFileId()))
                .collect(Collectors.toList());
    }

    public List<UserWithRolesDTO> getUsersByInstituteIdAndStatus(String instituteId, List<String> statuses, List<String> roles, CustomUserDetails userDetails) {
        return userRepository.findUsersByStatusAndInstitute(statuses, roles, instituteId)
                .stream()
                .map(UserWithRolesDTO::new).collect(Collectors.toList());
    }

    public User getUserById(String userId) {
        return userRepository.findById(userId).orElseThrow(() -> new UserNotFoundException("User with Id " + userId + " not found"));
    }

    public List<UserWithRolesDTO> getUsersByInstituteIdAndStatus(String instituteId, List<String> statuses, List<String> roles) {
        return userRepository.findUsersByStatusAndInstitute(statuses, roles, instituteId)
                .stream()
                .map(UserWithRolesDTO::new).collect(Collectors.toList());
    }

    public User updateUser(User user, UserDTO userDTO) {
        if (StringUtils.hasText(userDTO.getUsername())) user.setUsername(userDTO.getUsername());
        if (StringUtils.hasText(userDTO.getEmail())) user.setEmail(userDTO.getEmail());
        if (StringUtils.hasText(userDTO.getFullName())) user.setFullName(userDTO.getFullName());
        if (StringUtils.hasText(userDTO.getAddressLine())) user.setAddressLine(userDTO.getAddressLine());
        if (StringUtils.hasText(userDTO.getCity())) user.setCity(userDTO.getCity());
        if (StringUtils.hasText(userDTO.getPinCode())) user.setPinCode(userDTO.getPinCode());
        if (StringUtils.hasText(userDTO.getMobileNumber())) user.setMobileNumber(userDTO.getMobileNumber());
        if (userDTO.getDateOfBirth() != null) user.setDateOfBirth(userDTO.getDateOfBirth());
        if (StringUtils.hasText(userDTO.getGender())) user.setGender(userDTO.getGender());
        if (StringUtils.hasText(userDTO.getProfilePicFileId())) user.setProfilePicFileId(userDTO.getProfilePicFileId());

        // Only set password if it's provided
        if (StringUtils.hasText(userDTO.getPassword())) user.setPassword(userDTO.getPassword());

        // isRootUser is primitive boolean, so check if change is desired
        user.setRootUser(userDTO.isRootUser());
        return userRepository.save(user);
    }

    public Optional<User> getOptionalUserById(String userId) {
        return userRepository.findById(userId);
    }

    @Transactional
    public String updateUserDetails(CustomUserDetails customUserDetails, UserTopLevelDto request, String userId, String instituteId) {
        try{
            Optional<User> userOptional = userRepository.findById(userId);
            if(userOptional.isEmpty()) throw new VacademyException("User Not Found");

            updateIfNotNull(request.getEmail(), userOptional.get()::setEmail);
            updateIfNotNull(request.getMobileNumber(), userOptional.get()::setMobileNumber);
            userOptional.get().setProfilePicFileId(request.getProfilePicFileId());
            updateIfNotNull(request.getPinCode(), userOptional.get()::setPinCode);
            updateIfNotNull(request.getCity(), userOptional.get()::setCity);
            updateIfNotNull(request.getGender(), userOptional.get()::setGender);
            updateIfNotNull(request.getFullName(), userOptional.get()::setFullName);
            updateIfNotNull(request.getDateOfBirth(), userOptional.get()::setDateOfBirth);
            updateIfNotNull(request.getAddressLine(), userOptional.get()::setAddressLine);

            User savedUser = userRepository.save(userOptional.get());

            updateRolesOfUser(savedUser, request, instituteId);

            return "Done";
        } catch (Exception e) {
            throw new VacademyException("Failed To Update: " + e.getMessage());
        }
    }

    private void updateRolesOfUser(User savedUser, UserTopLevelDto request, String instituteId) {
        List<UserRole> allDeleteRequestUserRoles = StreamSupport
                .stream(userRoleRepository.findAllById(request.getDeleteUserRoleRequest()).spliterator(), false)
                .toList();

        allDeleteRequestUserRoles.forEach(userRole -> {
            userRole.setStatus(UserRoleStatus.DELETED.name());
        });
        userRoleRepository.saveAll(allDeleteRequestUserRoles);

        createOrUpdateUserRole(savedUser, request.getAddUserRoleRequest(),instituteId);
    }

    public void createOrUpdateUserRole(User savedUser, List<String> addUserRoleRequest, String instituteId) {
        List<String> newRoleNames = new ArrayList<>();
        List<UserRole> updateStatusRoles = new ArrayList<>();

        addUserRoleRequest.forEach(roleName->{
            Optional<UserRole> userRole = userRoleRepository.findByUserIdAndRoleIdAndInstituteId(savedUser.getId(),roleName,instituteId);
            if(userRole.isPresent()){
                userRole.get().setStatus(UserRoleStatus.ACTIVE.name());
                updateStatusRoles.add(userRole.get());
            }
            else newRoleNames.add(roleName);
        });

        userRoleRepository.saveAll(updateStatusRoles);
        createNewRolesForRoleName(savedUser, newRoleNames, instituteId);
    }

    private void createNewRolesForRoleName(User savedUser, List<String> newRoleNames, String instituteId) {
        List<UserRole> roles = new ArrayList<>();

        newRoleNames.forEach(name->{
            Optional<Role> role = roleRepository.findByName(name);
            if(role.isPresent()){
                UserRole newRole = new UserRole();
                newRole.setRole(role.get());
                newRole.setStatus(UserRoleStatus.ACTIVE.name());
                newRole.setInstituteId(instituteId);
                newRole.setUser(savedUser);

                roles.add(newRole);
            }
        });

        userRoleRepository.saveAll(roles);
    }

    private <T> void updateIfNotNull(T value, java.util.function.Consumer<T> setterMethod) {
        if (value != null) {
            setterMethod.accept(value);
        }
    }

    public UserTopLevelDto getUserTopLevelDetails(CustomUserDetails customUserDetails, String userId, String instituteId) {
        Optional<User> userOptional = userRepository.findById(userId);

        if (userOptional.isEmpty()) {
            throw new VacademyException("User Not Found");
        }

        // Get the full DTO
        UserTopLevelDto userTopLevelDto = userOptional.get().getUserTopLevelDto();

        // Filter roles based on matching instituteId
        List<UserRoleDTO> filteredRoles = userTopLevelDto.getRoles()
                .stream()
                .filter(role -> instituteId.equals(role.getInstituteId()))
                .filter(role-> !role.getStatus().equals(UserRoleStatus.DELETED.name()))
                .toList(); // or .collect(Collectors.toList()) in Java 8

        // Set the filtered roles back
        userTopLevelDto.setRoles(filteredRoles);

        return userTopLevelDto;
    }


    public UserJwtUpdateDetail getUserJwtUpdateDetail(CustomUserDetails userDetails,String userId) {
        UserJwtUpdateDetail userJwtUpdateDetail = new UserJwtUpdateDetail();
        Optional<User> user = userRepository.findById(userId);
        if (user.isPresent()) {
            userJwtUpdateDetail.setUpdatedAt(user.get().getLastTokenUpdateTime());
        }
        return userJwtUpdateDetail;
    }

    public void updateLastTokenUpdatedTime(List<String> userIds) {
        if (userIds == null || userIds.isEmpty()) {
            return;
        }
        userRepository.updateLastTokenUpdateTime(userIds);
    }

    public UserDTO updateUserDetails(UserDTO userDTO,String userId) {
        User user = userRepository.findById(userId).orElseThrow(()->new VacademyException("User Not Found with id "+userId));
        user = updateUser(user,userDTO);
        return new UserDTO(user);
    }
}
