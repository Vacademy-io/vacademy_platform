package vacademy.io.auth_service.feature.user.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import vacademy.io.auth_service.feature.user.dto.UserBasicDetailsDto;
import vacademy.io.common.auth.entity.User;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.auth.repository.UserRepository;

import java.util.ArrayList;
import java.util.List;
import java.util.stream.StreamSupport;

@Service
public class UserDetailService {

    @Autowired
    UserRepository userRepository;

    public List<UserBasicDetailsDto> getUserBasicDetails(CustomUserDetails userDetails, List<String> userIds) {
        List<User> allUsers = StreamSupport
                .stream(userRepository.findAllById(userIds).spliterator(), false)
                .toList();

        List<UserBasicDetailsDto> response = new ArrayList<>();
        allUsers.forEach(user->{
            response.add(UserBasicDetailsDto.builder()
                    .id(user.getId())
                    .faceFileId(user.getProfilePicFileId())
                    .name(user.getFullName()).build());
        });

        return response;
    }
}
