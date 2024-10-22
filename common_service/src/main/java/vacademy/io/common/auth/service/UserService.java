package vacademy.io.common.auth.service;


import vacademy.io.common.auth.entity.User;
import vacademy.io.common.auth.enums.UserTypesEnum;
import vacademy.io.common.auth.repository.UserRepository;

import vacademy.io.common.exceptions.EmployeeNotFoundException;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;


@Service
public class UserService {

    @Autowired
    UserRepository userRepository;

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



}
