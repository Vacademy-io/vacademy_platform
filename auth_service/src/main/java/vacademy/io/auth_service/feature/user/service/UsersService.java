package vacademy.io.auth_service.feature.user.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import vacademy.io.auth_service.feature.user.dto.UserDTO;
import vacademy.io.auth_service.feature.user.entity.Users;
import vacademy.io.auth_service.feature.user.exception.UserWithPermissionNotFoundException;
import vacademy.io.auth_service.feature.user.exception.UserWithRoleNotFoundException;
import vacademy.io.auth_service.feature.user.repository.UsersRepository;
import vacademy.io.auth_service.feature.user.exception.UserNotFoundException;
import vacademy.io.auth_service.feature.user.exception.RoleNotFoundException;


import java.util.List;
import java.util.stream.Collectors;

@Service
public class UsersService {

    @Autowired
    UsersRepository userRepository;

    public void addRoleToUser(String userId, String roleId) {

        if(!ifRoleExist(roleId)) {
            throw new RoleNotFoundException("Role with Id " + roleId + " not found");
        }
        else if(!ifUserExist(userId)) {
            throw new UserNotFoundException("User with Id" + userId + "not found");
        }
        userRepository.addRoleToUser(userId, roleId);
    }

    public void addPermissionToUser(String userId, String permissionId) {

        if(!ifUserExist(userId)) {
            throw new UserNotFoundException("User with Id " + userId + " not found");
        } else if (!ifPermissionExist(permissionId)) {
            throw new UserWithPermissionNotFoundException("Permission with Id "+ permissionId + "not found");

        }
        userRepository.addPermissionToUser(userId, permissionId);
    }

    public UserDTO getUserDetailsById(String userId) {

        if(!ifUserExist(userId)) {
            throw new UserNotFoundException("User with Id " + userId + " not found");
        }
        List<Users> results = userRepository.findUserDetailsById(userId);

        Users user = results.get(0);
        return new UserDTO(
               user.getId(), user.getUsername(), user.getEmail(), user.getFullName(), user.getAddressLine(), user.getCity(), user.getPinCode(), user.getMobileNumber(), user.getDateOfBirth(), user.getGender(), user.isRootUser()
        );
    }

    public List<UserDTO> getUserDetailsByIds(List<String> userIds) {

        for(String user : userIds) {
            if(!ifUserExist(user)) {
                throw new UserNotFoundException("User with Id " + user + " not found");
            }
        }
        List<Users> users = userRepository.findUserDetailsByIds(userIds);

        return users.stream()
                .map(user -> new UserDTO(
                        user.getId(), user.getUsername(), user.getEmail(), user.getFullName(), user.getAddressLine(), user.getCity(), user.getPinCode(), user.getMobileNumber(), user.getDateOfBirth(), user.getGender(), user.isRootUser()
                ))
                .collect(Collectors.toList());
    }

    public UserDTO getUserDetailsByUsername(String username) {

        if(!ifUserExistByUserName(username)) {
            throw new UserNotFoundException("User with user name " + username + " not found");
        }
        List<Users> results = userRepository.findUserDetailsByUsername(username);
        Users user = results.get(0);
        return new UserDTO(
                user.getId(), user.getUsername(), user.getEmail(), user.getFullName(), user.getAddressLine(), user.getCity(), user.getPinCode(), user.getMobileNumber(), user.getDateOfBirth(), user.getGender(), user.isRootUser()
        );
    }

    public void removeRoleFromUser(String userId, String roleId) {

        if(!ifRoleAndUserExist(userId, roleId)) {
            throw new UserWithRoleNotFoundException("User with Id " + userId + " and role Id " + roleId + " not found");
        }
        userRepository.removeRoleFromUser(userId, roleId);
    }

    public void removePermissionFromUser(String userId, String permissionId) {

        if(!ifPermissionAndUserExist(userId, permissionId)) {
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
}
