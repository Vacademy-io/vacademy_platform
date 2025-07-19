package vacademy.io.admin_core_service.features.common.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.*;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.auth_service.service.AuthService;
import vacademy.io.admin_core_service.features.common.dto.RatingFilterDTO;
import vacademy.io.admin_core_service.features.common.dto.RatingDTO;
import vacademy.io.admin_core_service.features.common.dto.RatingDetailDTO;
import vacademy.io.admin_core_service.features.common.dto.RatingSummaryProjection;
import vacademy.io.admin_core_service.features.common.entity.Rating;
import vacademy.io.admin_core_service.features.common.enums.RatingSourceEnum;
import vacademy.io.admin_core_service.features.common.enums.StatusEnum;
import vacademy.io.admin_core_service.features.common.repository.RatingRepository;
import vacademy.io.admin_core_service.features.packages.enums.PackageSessionStatusEnum;
import vacademy.io.common.auth.dto.UserDTO;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.core.standard_classes.ListService;
import vacademy.io.common.exceptions.VacademyException;

import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
public class RatingService {

    @Autowired
    private RatingRepository ratingRepository;

    @Autowired
    private AuthService authService;

    public String addRating(RatingDTO ratingDTO){
        Rating rating = new Rating(ratingDTO);
        ratingRepository.save(rating);
        return rating.getId();
    }

    public String updateRating(RatingDTO ratingDTO){
        Rating rating = ratingRepository.findById(ratingDTO.getId()).orElseThrow(()->new VacademyException("Rating not found"));
        rating.setPoints(ratingDTO.getPoints());
        rating.setText(ratingDTO.getText());
        rating.setStatus(ratingDTO.getStatus());
        rating.setLikes(ratingDTO.getLikes());
        rating.setDislikes(ratingDTO.getDislikes());
        rating.setStatus(ratingDTO.getStatus());
        ratingRepository.save(rating);
        return rating.getId();
    }

    public Page<RatingDetailDTO> mapRatingPageToDetailDTO(Page<Rating> ratingsPage) {
        List<String> userIds = ratingsPage.getContent()
            .stream()
            .map(Rating::getUserId)
            .distinct()
            .collect(Collectors.toList());

        List<UserDTO> userDTOS = authService.getUsersFromAuthServiceByUserIds(userIds);
        Map<String, UserDTO> userMap = userDTOS.stream()
            .collect(Collectors.toMap(UserDTO::getId, Function.identity()));

        List<RatingDetailDTO> detailDTOs = ratingsPage.getContent().stream()
            .map(rating -> {
                RatingDetailDTO dto = rating.mapToRatingDetailDTO();
                dto.setUser(userMap.get(rating.getUserId()));
                return dto;
            })
            .collect(Collectors.toList());

        return new PageImpl<>(detailDTOs, ratingsPage.getPageable(), ratingsPage.getTotalElements());
    }

    public Page<RatingDetailDTO> getRatingsForPackage(
        RatingFilterDTO ratingFilterDTO,
        int pageNo,
        int pageSize
    ) {
        Sort sort = ListService.createSortObject(ratingFilterDTO.getSortColumns());
        Pageable pageable = PageRequest.of(pageNo, pageSize, sort);

        Page<Rating> ratingsPage = ratingRepository.getAllRatingsWithFilter(
            List.of(StatusEnum.ACTIVE.name()),
            List.of(PackageSessionStatusEnum.ACTIVE.name(), PackageSessionStatusEnum.HIDDEN.name()),
            List.of(RatingSourceEnum.PACKAGE.name(), RatingSourceEnum.PACKAGE_SESSION.name()),
            ratingFilterDTO.getSourceId(),
            pageable
        );

        return mapRatingPageToDetailDTO(ratingsPage);
    }

    public Page<RatingDetailDTO> getRatingsForSource(
        RatingFilterDTO ratingFilterDTO,
        int pageNo,
        int pageSize,
        CustomUserDetails userDetails
    ) {
        Sort sort = ListService.createSortObject(ratingFilterDTO.getSortColumns());
        Pageable pageable = PageRequest.of(pageNo, pageSize, sort);

        Page<Rating> ratingsPage = ratingRepository.findRatingsBySourceAndStatus(
            ratingFilterDTO.getSourceType(),
            ratingFilterDTO.getSourceId(),
            List.of(StatusEnum.ACTIVE.name()),
            pageable
        );

        return mapRatingPageToDetailDTO(ratingsPage);
    }

    public Page<RatingDetailDTO> getRatingsForSourceExcludingDeleted(
        RatingFilterDTO ratingFilterDTO,
        int pageNo,
        int pageSize,
        CustomUserDetails userDetails
    ) {
        Sort sort = ListService.createSortObject(ratingFilterDTO.getSortColumns());
        Pageable pageable = PageRequest.of(pageNo, pageSize, sort);

        Page<Rating> ratingsPage = ratingRepository.findRatingsBySourceExcludingDeleted(
            ratingFilterDTO.getSourceType(),
            ratingFilterDTO.getSourceId(),
            pageable
        );

        return mapRatingPageToDetailDTO(ratingsPage);
    }

    public RatingSummaryProjection getRatingSummaryProjectionForSource(String sourceType, String sourceId) {
        return ratingRepository.getRatingSummary(sourceId, sourceType, List.of(StatusEnum.ACTIVE.name()));
    }

    public RatingSummaryProjection getRatingSummaryProjectionForPackage(String sourceType, String sourceId) {
        return ratingRepository.getFilteredRatingSummary(List.of(StatusEnum.ACTIVE.name()),
            List.of(PackageSessionStatusEnum.ACTIVE.name(), PackageSessionStatusEnum.HIDDEN.name()),List.of(RatingSourceEnum.PACKAGE.name(), RatingSourceEnum.PACKAGE_SESSION.name()), sourceId);
    }

}
