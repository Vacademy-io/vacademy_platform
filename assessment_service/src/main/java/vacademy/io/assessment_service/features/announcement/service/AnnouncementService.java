package vacademy.io.assessment_service.features.announcement.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import vacademy.io.assessment_service.features.announcement.dto.AddAnnouncementDTO;
import vacademy.io.assessment_service.features.announcement.entity.AssessmentAnnouncement;
import vacademy.io.assessment_service.features.announcement.repository.AssessmentAnnouncementRepository;
import vacademy.io.assessment_service.features.assessment.entity.Assessment;
import vacademy.io.assessment_service.features.learner_assessment.dto.response.BasicLevelAnnouncementDto;
import vacademy.io.assessment_service.features.rich_text.entity.AssessmentRichTextData;
import vacademy.io.assessment_service.features.rich_text.enums.TextType;
import vacademy.io.common.auth.model.CustomUserDetails;

import java.time.Duration;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class AnnouncementService {

    private static final Map<String, List<AssessmentAnnouncement>> mappedAnnouncementsForAssessment = new ConcurrentHashMap<>();
    private static final Map<String, Date> mappedLastAnnouncementFetchTime = new ConcurrentHashMap<>();

    @Autowired
    AssessmentAnnouncementRepository assessmentAnnouncementRepository;

    private static <T> List<T> addUniqueObjects(List<T> l1, List<T> l2) {
        // Use a Set to ensure uniqueness, as it automatically handles duplicates
        Set<T> uniqueSet = new HashSet<>();

        // Add all elements from l1 and l2 to the Set
        uniqueSet.addAll(l1);
        uniqueSet.addAll(l2);

        // Return the unique objects as a List
        return new ArrayList<>(uniqueSet);
    }

    public Optional<AssessmentAnnouncement> getAnnouncementById(String id) {
        return assessmentAnnouncementRepository.findById(id);
    }

    public AssessmentAnnouncement createAnnouncement(AssessmentAnnouncement announcement) {
        return assessmentAnnouncementRepository.save(announcement);
    }

    public AssessmentAnnouncement updateAnnouncement(AssessmentAnnouncement announcement) {
        return assessmentAnnouncementRepository.save(announcement);
    }

    public List<AssessmentAnnouncement> getAnnouncementForAssessment(String assessmentId) {
        // Get previously fetched announcements
        List<AssessmentAnnouncement> allMappedAnnouncement = mappedAnnouncementsForAssessment.get(assessmentId);
        List<AssessmentAnnouncement> allNewAnnouncements = new ArrayList<>();

        // If there are no mapped announcements for the assessment
        if (Objects.isNull(allMappedAnnouncement)) {
            allNewAnnouncements = assessmentAnnouncementRepository.findByAssessmentId(assessmentId);
        } else {
            Date lastFetchedTime = mappedLastAnnouncementFetchTime.get(assessmentId);

            // If no time has been fetched or last fetched time is null
            if (Objects.isNull(lastFetchedTime)) {
                allNewAnnouncements = assessmentAnnouncementRepository.findByAssessmentId(assessmentId);
            } else {
                Instant lastFetchedTimeInstant = lastFetchedTime.toInstant();
                Instant currentDateInstant = Instant.now();  // Use Instant.now() for current time

                // Check if the time difference is within 60 seconds
                if (Duration.between(lastFetchedTimeInstant, currentDateInstant).toMillis() <= 60000) {
                    return allMappedAnnouncement;  // Return previously fetched announcements if within 60 seconds
                }

                // Fetch new announcements after last fetched time
                allNewAnnouncements = assessmentAnnouncementRepository.findByAssessmentIdAndSentTimeAfterAndStatusNotIn(assessmentId, lastFetchedTime);
            }

            // Merge new announcements with the previously fetched announcements
            allMappedAnnouncement = addUniqueObjects(allMappedAnnouncement, allNewAnnouncements);
            mappedAnnouncementsForAssessment.put(assessmentId, allMappedAnnouncement);
            mappedLastAnnouncementFetchTime.put(assessmentId, new Date());  // Update fetch time to current date
        }

        return allMappedAnnouncement;
    }

    public List<BasicLevelAnnouncementDto> createBasicLevelAnnouncementDto(List<AssessmentAnnouncement> allAnnouncement) {
        List<BasicLevelAnnouncementDto> allDtos = new ArrayList<>();
        if (Objects.isNull(allAnnouncement)) return allDtos;
        allAnnouncement.forEach(announcement -> {
            allDtos.add(BasicLevelAnnouncementDto.builder().id(announcement.getId())
                    .richTextId(announcement.getAssessmentRichTextData().getId())
                    .sentTime(announcement.getSentTime()).build());
        });

        return allDtos;
    }

    public ResponseEntity<String> addAnnouncement(CustomUserDetails user, AddAnnouncementDTO addAccessAssessmentDetailsDTO, String assessmentId, String instituteId) {
        AssessmentAnnouncement announcement = AssessmentAnnouncement.builder()
                .assessment(Assessment.builder().id(assessmentId).build())
                .instituteId(instituteId)
                .assessmentRichTextData(AssessmentRichTextData.builder().type(TextType.HTML.name()).content(addAccessAssessmentDetailsDTO.getAnnouncementHtml()).build())
                .type(addAccessAssessmentDetailsDTO.getAnnouncementType())
                .sentTime(new Date(addAccessAssessmentDetailsDTO.getGmtAnnouncementTimeInMillis()))
                .build();

        announcement = createAnnouncement(announcement);
        return ResponseEntity.ok("Announcement added successfully.");
    }
}
