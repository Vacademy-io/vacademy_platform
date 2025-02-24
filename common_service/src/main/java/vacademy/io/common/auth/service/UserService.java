package vacademy.io.common.auth.service;


import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import vacademy.io.common.auth.dto.UserDTO;
import vacademy.io.common.auth.dto.UserPermissionRequestDTO;
import vacademy.io.common.auth.dto.UserRoleRequestDTO;
import vacademy.io.common.auth.dto.UserWithRolesDTO;
import vacademy.io.common.auth.entity.Role;
import vacademy.io.common.auth.entity.User;
import vacademy.io.common.auth.entity.UserRole;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.auth.repository.RoleRepository;
import vacademy.io.common.auth.repository.UserRepository;
import vacademy.io.common.exceptions.*;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.stream.Collectors;


@Service
public class UserService {

    @Autowired
    UserRepository userRepository;

    @Autowired
    RoleRepository roleRepository;

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

        for (String user : userIds) {
            if (!ifUserExist(user)) {
                throw new UserNotFoundException("User with Id " + user + " not found");
            }
        }
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

    public List<UserRole> addUserRoles(String instituteId, List<String> roles, User user) {

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
            userRoles.add(userRole);
        }

        user.setRoles(new HashSet<>(userRoles));
        userRepository.save(user);
        return userRoles;
    }

    public List<UserWithRolesDTO> getUserDetailsByInstituteId(String instituteId, CustomUserDetails user) {
        return userRepository.findUsersWithRolesByInstituteId(instituteId).stream().map(UserWithRolesDTO::new).collect(Collectors.toList());
    }

    public List<UserWithRolesDTO> getUserDetailsByInstituteId(String instituteId,List<String>roles, CustomUserDetails user) {
        return userRepository.findUsersWithRolesByInstituteId(instituteId,roles).stream().map(UserWithRolesDTO::new).collect(Collectors.toList());
    }
}
