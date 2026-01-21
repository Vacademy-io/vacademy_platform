package vacademy.io.admin_core_service.features.course.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import vacademy.io.admin_core_service.features.common.enums.StatusEnum;
import vacademy.io.admin_core_service.features.course.dto.bulk.*;
import vacademy.io.admin_core_service.features.course.enums.CourseTypeEnum;
import vacademy.io.admin_core_service.features.enroll_invite.entity.EnrollInvite;
import vacademy.io.admin_core_service.features.enroll_invite.repository.EnrollInviteRepository;
import vacademy.io.admin_core_service.features.enroll_invite.service.EnrollInviteCoursePreviewService;
import vacademy.io.admin_core_service.features.enroll_invite.service.PackageSessionEnrollInviteToPaymentOptionService;
import vacademy.io.admin_core_service.features.institute.repository.InstituteRepository;
import vacademy.io.admin_core_service.features.learner_invitation.services.LearnerInvitationService;
import vacademy.io.admin_core_service.features.level.repository.LevelRepository;
import vacademy.io.admin_core_service.features.packages.repository.PackageInstituteRepository;
import vacademy.io.admin_core_service.features.packages.repository.PackageRepository;
import vacademy.io.admin_core_service.features.packages.repository.PackageSessionRepository;
import vacademy.io.admin_core_service.features.session.repository.SessionRepository;
import vacademy.io.admin_core_service.features.user_subscription.entity.PaymentOption;
import vacademy.io.admin_core_service.features.user_subscription.entity.PaymentPlan;
import vacademy.io.admin_core_service.features.user_subscription.repository.PaymentOptionRepository;
import vacademy.io.admin_core_service.features.user_subscription.repository.PaymentPlanRepository;
import vacademy.io.admin_core_service.features.user_subscription.service.PaymentOptionService;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.institute.entity.Institute;
import vacademy.io.common.institute.entity.Level;
import vacademy.io.common.institute.entity.PackageEntity;
import vacademy.io.common.institute.entity.session.PackageSession;
import vacademy.io.common.institute.entity.session.Session;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Unit tests for BulkCourseService.
 */
@ExtendWith(MockitoExtension.class)
class BulkCourseServiceTest {

    @Mock
    private PackageRepository packageRepository;

    @Mock
    private PackageInstituteRepository packageInstituteRepository;

    @Mock
    private PackageSessionRepository packageSessionRepository;

    @Mock
    private LevelRepository levelRepository;

    @Mock
    private SessionRepository sessionRepository;

    @Mock
    private InstituteRepository instituteRepository;

    @Mock
    private PaymentOptionRepository paymentOptionRepository;

    @Mock
    private PaymentPlanRepository paymentPlanRepository;

    @Mock
    private PaymentOptionService paymentOptionService;

    @Mock
    private EnrollInviteRepository enrollInviteRepository;

    @Mock
    private PackageSessionEnrollInviteToPaymentOptionService packageSessionEnrollInviteToPaymentOptionService;

    @Mock
    private EnrollInviteCoursePreviewService enrollInviteCoursePreviewService;

    @Mock
    private LearnerInvitationService learnerInvitationService;

    @InjectMocks
    private BulkCourseService bulkCourseService;

    private static final String INSTITUTE_ID = "test-institute-id";
    private CustomUserDetails testUser;
    private Level defaultLevel;
    private Session defaultSession;
    private Institute testInstitute;

    @BeforeEach
    void setUp() {
        testUser = new CustomUserDetails();
        testUser.setId("test-user-id");

        defaultLevel = new Level();
        defaultLevel.setId("DEFAULT");
        defaultLevel.setLevelName("Default");

        defaultSession = new Session();
        defaultSession.setId("DEFAULT");
        defaultSession.setSessionName("Default");

        testInstitute = new Institute();
        testInstitute.setId(INSTITUTE_ID);
    }

    @Nested
    @DisplayName("Empty Request Tests")
    class EmptyRequestTests {

        @Test
        @DisplayName("Should return empty response when courses list is null")
        void shouldReturnEmptyResponseWhenCoursesNull() {
            BulkAddCourseRequestDTO request = BulkAddCourseRequestDTO.builder()
                    .courses(null)
                    .build();

            BulkAddCourseResponseDTO response = bulkCourseService.bulkAddCourses(request, INSTITUTE_ID, testUser);

            assertEquals(0, response.getTotalRequested());
            assertEquals(0, response.getSuccessCount());
            assertEquals(0, response.getFailureCount());
            assertTrue(response.getResults().isEmpty());
        }

        @Test
        @DisplayName("Should return empty response when courses list is empty")
        void shouldReturnEmptyResponseWhenCoursesEmpty() {
            BulkAddCourseRequestDTO request = BulkAddCourseRequestDTO.builder()
                    .courses(new ArrayList<>())
                    .build();

            BulkAddCourseResponseDTO response = bulkCourseService.bulkAddCourses(request, INSTITUTE_ID, testUser);

            assertEquals(0, response.getTotalRequested());
            assertEquals(0, response.getSuccessCount());
            assertEquals(0, response.getFailureCount());
        }
    }

    @Nested
    @DisplayName("Validation Tests")
    class ValidationTests {

        @Test
        @DisplayName("Should fail when course name is empty")
        void shouldFailWhenCourseNameEmpty() {
            BulkCourseItemDTO courseItem = BulkCourseItemDTO.builder()
                    .courseName("")
                    .build();

            BulkAddCourseRequestDTO request = BulkAddCourseRequestDTO.builder()
                    .courses(List.of(courseItem))
                    .build();

            BulkAddCourseResponseDTO response = bulkCourseService.bulkAddCourses(request, INSTITUTE_ID, testUser);

            assertEquals(1, response.getTotalRequested());
            assertEquals(0, response.getSuccessCount());
            assertEquals(1, response.getFailureCount());
            assertEquals("FAILED", response.getResults().get(0).getStatus());
            assertEquals("Course name is required", response.getResults().get(0).getErrorMessage());
        }

        @Test
        @DisplayName("Should fail when course name is null")
        void shouldFailWhenCourseNameNull() {
            BulkCourseItemDTO courseItem = BulkCourseItemDTO.builder()
                    .courseName(null)
                    .build();

            BulkAddCourseRequestDTO request = BulkAddCourseRequestDTO.builder()
                    .courses(List.of(courseItem))
                    .build();

            BulkAddCourseResponseDTO response = bulkCourseService.bulkAddCourses(request, INSTITUTE_ID, testUser);

            assertEquals(1, response.getFailureCount());
            assertEquals("Course name is required", response.getResults().get(0).getErrorMessage());
        }
    }

    @Nested
    @DisplayName("Dry Run Tests")
    class DryRunTests {

        @Test
        @DisplayName("Should validate without persisting in dry run mode")
        void shouldValidateWithoutPersistingInDryRun() {
            BulkCourseItemDTO courseItem = BulkCourseItemDTO.builder()
                    .courseName("Test Course")
                    .build();

            BulkAddCourseRequestDTO request = BulkAddCourseRequestDTO.builder()
                    .courses(List.of(courseItem))
                    .dryRun(true)
                    .build();

            BulkAddCourseResponseDTO response = bulkCourseService.bulkAddCourses(request, INSTITUTE_ID, testUser);

            assertEquals(1, response.getTotalRequested());
            assertEquals(1, response.getSuccessCount());
            assertTrue(response.isDryRun());
            assertEquals("DRY_RUN_VALIDATED", response.getResults().get(0).getCourseId());

            // Verify no repository calls were made
            verifyNoInteractions(packageRepository);
            verifyNoInteractions(packageSessionRepository);
            verifyNoInteractions(enrollInviteRepository);
        }

        @Test
        @DisplayName("Should return failure for invalid course in dry run")
        void shouldReturnFailureForInvalidCourseInDryRun() {
            BulkCourseItemDTO courseItem = BulkCourseItemDTO.builder()
                    .courseName("") // Invalid
                    .build();

            BulkAddCourseRequestDTO request = BulkAddCourseRequestDTO.builder()
                    .courses(List.of(courseItem))
                    .dryRun(true)
                    .build();

            BulkAddCourseResponseDTO response = bulkCourseService.bulkAddCourses(request, INSTITUTE_ID, testUser);

            assertEquals(1, response.getFailureCount());
            assertTrue(response.isDryRun());
        }
    }

    @Nested
    @DisplayName("Course Creation Tests")
    class CourseCreationTests {

        @BeforeEach
        void setUpMocks() {
            // Mock default level and session
            when(levelRepository.findById("DEFAULT")).thenReturn(Optional.of(defaultLevel));
            when(sessionRepository.findById("DEFAULT")).thenReturn(Optional.of(defaultSession));
            when(instituteRepository.findById(INSTITUTE_ID)).thenReturn(Optional.of(testInstitute));
            when(packageInstituteRepository.findByPackageIdAndInstituteId(any(), eq(INSTITUTE_ID)))
                    .thenReturn(Optional.empty());

            // Mock save operations
            when(packageRepository.save(any(PackageEntity.class))).thenAnswer(invocation -> {
                PackageEntity entity = invocation.getArgument(0);
                if (entity.getId() == null) {
                    entity.setId("generated-package-id");
                }
                return entity;
            });

            when(packageSessionRepository.save(any(PackageSession.class))).thenAnswer(invocation -> {
                PackageSession session = invocation.getArgument(0);
                if (session.getId() == null) {
                    session.setId("generated-ps-id");
                }
                return session;
            });

            when(enrollInviteRepository.save(any(EnrollInvite.class))).thenAnswer(invocation -> {
                EnrollInvite invite = invocation.getArgument(0);
                if (invite.getId() == null) {
                    invite.setId("generated-invite-id");
                }
                return invite;
            });

            when(enrollInviteCoursePreviewService.createPreview(any(), any())).thenReturn("{}");
        }

        @Test
        @DisplayName("Should create course with default values")
        void shouldCreateCourseWithDefaults() {
            BulkCourseItemDTO courseItem = BulkCourseItemDTO.builder()
                    .courseName("Test Course")
                    .build();

            BulkAddCourseRequestDTO request = BulkAddCourseRequestDTO.builder()
                    .courses(List.of(courseItem))
                    .build();

            BulkAddCourseResponseDTO response = bulkCourseService.bulkAddCourses(request, INSTITUTE_ID, testUser);

            assertEquals(1, response.getSuccessCount());
            assertEquals("SUCCESS", response.getResults().get(0).getStatus());
            assertNotNull(response.getResults().get(0).getCourseId());

            // Verify package was saved with correct values
            ArgumentCaptor<PackageEntity> packageCaptor = ArgumentCaptor.forClass(PackageEntity.class);
            verify(packageRepository).save(packageCaptor.capture());

            PackageEntity savedPackage = packageCaptor.getValue();
            assertEquals("Test Course", savedPackage.getPackageName());
            assertEquals(5, savedPackage.getCourseDepth()); // Default depth
            assertEquals("COURSE", savedPackage.getPackageType()); // Default type
            assertEquals("ACTIVE", savedPackage.getStatus());
        }

        @Test
        @DisplayName("Should create course with custom type")
        void shouldCreateCourseWithCustomType() {
            BulkCourseItemDTO courseItem = BulkCourseItemDTO.builder()
                    .courseName("Membership Course")
                    .courseType("MEMBERSHIP")
                    .build();

            BulkAddCourseRequestDTO request = BulkAddCourseRequestDTO.builder()
                    .courses(List.of(courseItem))
                    .build();

            BulkAddCourseResponseDTO response = bulkCourseService.bulkAddCourses(request, INSTITUTE_ID, testUser);

            assertEquals(1, response.getSuccessCount());

            ArgumentCaptor<PackageEntity> packageCaptor = ArgumentCaptor.forClass(PackageEntity.class);
            verify(packageRepository).save(packageCaptor.capture());
            assertEquals("MEMBERSHIP", packageCaptor.getValue().getPackageType());
        }

        @Test
        @DisplayName("Should create course with custom depth")
        void shouldCreateCourseWithCustomDepth() {
            BulkCourseItemDTO courseItem = BulkCourseItemDTO.builder()
                    .courseName("Deep Course")
                    .courseDepth(10)
                    .build();

            BulkAddCourseRequestDTO request = BulkAddCourseRequestDTO.builder()
                    .courses(List.of(courseItem))
                    .build();

            BulkAddCourseResponseDTO response = bulkCourseService.bulkAddCourses(request, INSTITUTE_ID, testUser);

            assertEquals(1, response.getSuccessCount());

            ArgumentCaptor<PackageEntity> packageCaptor = ArgumentCaptor.forClass(PackageEntity.class);
            verify(packageRepository).save(packageCaptor.capture());
            assertEquals(10, packageCaptor.getValue().getCourseDepth());
        }

        @Test
        @DisplayName("Should create course with tags")
        void shouldCreateCourseWithTags() {
            BulkCourseItemDTO courseItem = BulkCourseItemDTO.builder()
                    .courseName("Tagged Course")
                    .tags(List.of("Java", "Programming", "Backend"))
                    .build();

            BulkAddCourseRequestDTO request = BulkAddCourseRequestDTO.builder()
                    .courses(List.of(courseItem))
                    .build();

            BulkAddCourseResponseDTO response = bulkCourseService.bulkAddCourses(request, INSTITUTE_ID, testUser);

            assertEquals(1, response.getSuccessCount());

            ArgumentCaptor<PackageEntity> packageCaptor = ArgumentCaptor.forClass(PackageEntity.class);
            verify(packageRepository).save(packageCaptor.capture());
            assertEquals("java,programming,backend", packageCaptor.getValue().getTags());
        }
    }

    @Nested
    @DisplayName("Global Defaults Tests")
    class GlobalDefaultsTests {

        @BeforeEach
        void setUpMocks() {
            when(levelRepository.findById("DEFAULT")).thenReturn(Optional.of(defaultLevel));
            when(sessionRepository.findById("DEFAULT")).thenReturn(Optional.of(defaultSession));
            when(instituteRepository.findById(INSTITUTE_ID)).thenReturn(Optional.of(testInstitute));
            when(packageInstituteRepository.findByPackageIdAndInstituteId(any(), eq(INSTITUTE_ID)))
                    .thenReturn(Optional.empty());

            when(packageRepository.save(any(PackageEntity.class))).thenAnswer(invocation -> {
                PackageEntity entity = invocation.getArgument(0);
                entity.setId("generated-id");
                return entity;
            });

            when(packageSessionRepository.save(any(PackageSession.class))).thenAnswer(invocation -> {
                PackageSession session = invocation.getArgument(0);
                session.setId("generated-ps-id");
                return session;
            });

            when(enrollInviteRepository.save(any(EnrollInvite.class))).thenAnswer(invocation -> {
                EnrollInvite invite = invocation.getArgument(0);
                invite.setId("generated-invite-id");
                return invite;
            });

            when(enrollInviteCoursePreviewService.createPreview(any(), any())).thenReturn("{}");
        }

        @Test
        @DisplayName("Should apply global course type to all courses")
        void shouldApplyGlobalCourseType() {
            BulkCourseGlobalDefaultsDTO globalDefaults = BulkCourseGlobalDefaultsDTO.builder()
                    .enabled(true)
                    .courseType("PRODUCT")
                    .build();

            BulkCourseItemDTO course1 = BulkCourseItemDTO.builder().courseName("Course 1").build();
            BulkCourseItemDTO course2 = BulkCourseItemDTO.builder().courseName("Course 2").build();

            BulkAddCourseRequestDTO request = BulkAddCourseRequestDTO.builder()
                    .applyToAll(globalDefaults)
                    .courses(List.of(course1, course2))
                    .build();

            BulkAddCourseResponseDTO response = bulkCourseService.bulkAddCourses(request, INSTITUTE_ID, testUser);

            assertEquals(2, response.getSuccessCount());

            ArgumentCaptor<PackageEntity> packageCaptor = ArgumentCaptor.forClass(PackageEntity.class);
            verify(packageRepository, times(2)).save(packageCaptor.capture());

            List<PackageEntity> savedPackages = packageCaptor.getAllValues();
            assertTrue(savedPackages.stream().allMatch(p -> "PRODUCT".equals(p.getPackageType())));
        }

        @Test
        @DisplayName("Should allow course-level override of global defaults")
        void shouldAllowCourseLevelOverride() {
            BulkCourseGlobalDefaultsDTO globalDefaults = BulkCourseGlobalDefaultsDTO.builder()
                    .enabled(true)
                    .courseType("PRODUCT")
                    .courseDepth(3)
                    .build();

            BulkCourseItemDTO course1 = BulkCourseItemDTO.builder()
                    .courseName("Course with global type")
                    .build();
            BulkCourseItemDTO course2 = BulkCourseItemDTO.builder()
                    .courseName("Course with override")
                    .courseType("SERVICE")
                    .courseDepth(7)
                    .build();

            BulkAddCourseRequestDTO request = BulkAddCourseRequestDTO.builder()
                    .applyToAll(globalDefaults)
                    .courses(List.of(course1, course2))
                    .build();

            BulkAddCourseResponseDTO response = bulkCourseService.bulkAddCourses(request, INSTITUTE_ID, testUser);

            assertEquals(2, response.getSuccessCount());

            ArgumentCaptor<PackageEntity> packageCaptor = ArgumentCaptor.forClass(PackageEntity.class);
            verify(packageRepository, times(2)).save(packageCaptor.capture());

            List<PackageEntity> savedPackages = packageCaptor.getAllValues();
            assertEquals("PRODUCT", savedPackages.get(0).getPackageType());
            assertEquals(3, savedPackages.get(0).getCourseDepth());
            assertEquals("SERVICE", savedPackages.get(1).getPackageType());
            assertEquals(7, savedPackages.get(1).getCourseDepth());
        }

        @Test
        @DisplayName("Should merge course and global tags")
        void shouldMergeTags() {
            BulkCourseGlobalDefaultsDTO globalDefaults = BulkCourseGlobalDefaultsDTO.builder()
                    .enabled(true)
                    .tags(List.of("global-tag"))
                    .build();

            BulkCourseItemDTO course1 = BulkCourseItemDTO.builder()
                    .courseName("Tagged Course")
                    .tags(List.of("course-tag"))
                    .build();

            BulkAddCourseRequestDTO request = BulkAddCourseRequestDTO.builder()
                    .applyToAll(globalDefaults)
                    .courses(List.of(course1))
                    .build();

            BulkAddCourseResponseDTO response = bulkCourseService.bulkAddCourses(request, INSTITUTE_ID, testUser);

            assertEquals(1, response.getSuccessCount());

            ArgumentCaptor<PackageEntity> packageCaptor = ArgumentCaptor.forClass(PackageEntity.class);
            verify(packageRepository).save(packageCaptor.capture());

            String tags = packageCaptor.getValue().getTags();
            assertTrue(tags.contains("course-tag"));
            assertTrue(tags.contains("global-tag"));
        }
    }

    @Nested
    @DisplayName("Inventory Tests")
    class InventoryTests {

        @BeforeEach
        void setUpMocks() {
            when(levelRepository.findById("DEFAULT")).thenReturn(Optional.of(defaultLevel));
            when(sessionRepository.findById("DEFAULT")).thenReturn(Optional.of(defaultSession));
            when(instituteRepository.findById(INSTITUTE_ID)).thenReturn(Optional.of(testInstitute));
            when(packageInstituteRepository.findByPackageIdAndInstituteId(any(), eq(INSTITUTE_ID)))
                    .thenReturn(Optional.empty());

            when(packageRepository.save(any(PackageEntity.class))).thenAnswer(invocation -> {
                PackageEntity entity = invocation.getArgument(0);
                entity.setId("generated-id");
                return entity;
            });

            when(packageSessionRepository.save(any(PackageSession.class))).thenAnswer(invocation -> {
                PackageSession session = invocation.getArgument(0);
                session.setId("generated-ps-id");
                return session;
            });

            when(enrollInviteRepository.save(any(EnrollInvite.class))).thenAnswer(invocation -> {
                EnrollInvite invite = invocation.getArgument(0);
                invite.setId("generated-invite-id");
                return invite;
            });

            when(enrollInviteCoursePreviewService.createPreview(any(), any())).thenReturn("{}");
        }

        @Test
        @DisplayName("Should create package session with max slots")
        void shouldCreatePackageSessionWithMaxSlots() {
            BulkCourseInventoryConfigDTO inventoryConfig = BulkCourseInventoryConfigDTO.builder()
                    .maxSlots(50)
                    .availableSlots(50)
                    .build();

            BulkCourseItemDTO courseItem = BulkCourseItemDTO.builder()
                    .courseName("Limited Course")
                    .inventoryConfig(inventoryConfig)
                    .build();

            BulkAddCourseRequestDTO request = BulkAddCourseRequestDTO.builder()
                    .courses(List.of(courseItem))
                    .build();

            BulkAddCourseResponseDTO response = bulkCourseService.bulkAddCourses(request, INSTITUTE_ID, testUser);

            assertEquals(1, response.getSuccessCount());

            ArgumentCaptor<PackageSession> sessionCaptor = ArgumentCaptor.forClass(PackageSession.class);
            verify(packageSessionRepository).save(sessionCaptor.capture());

            PackageSession savedSession = sessionCaptor.getValue();
            assertEquals(50, savedSession.getMaxSeats());
            assertEquals(50, savedSession.getAvailableSlots());
        }

        @Test
        @DisplayName("Should default available slots to max slots")
        void shouldDefaultAvailableSlotsToMaxSlots() {
            BulkCourseInventoryConfigDTO inventoryConfig = BulkCourseInventoryConfigDTO.builder()
                    .maxSlots(30) // Only set max, not available
                    .build();

            BulkCourseItemDTO courseItem = BulkCourseItemDTO.builder()
                    .courseName("Limited Course")
                    .inventoryConfig(inventoryConfig)
                    .build();

            BulkAddCourseRequestDTO request = BulkAddCourseRequestDTO.builder()
                    .courses(List.of(courseItem))
                    .build();

            BulkAddCourseResponseDTO response = bulkCourseService.bulkAddCourses(request, INSTITUTE_ID, testUser);

            assertEquals(1, response.getSuccessCount());

            ArgumentCaptor<PackageSession> sessionCaptor = ArgumentCaptor.forClass(PackageSession.class);
            verify(packageSessionRepository).save(sessionCaptor.capture());

            PackageSession savedSession = sessionCaptor.getValue();
            assertEquals(30, savedSession.getMaxSeats());
            assertEquals(30, savedSession.getAvailableSlots()); // Should default to max
        }
    }

    @Nested
    @DisplayName("Partial Failure Tests")
    class PartialFailureTests {

        @BeforeEach
        void setUpMocks() {
            when(levelRepository.findById("DEFAULT")).thenReturn(Optional.of(defaultLevel));
            when(sessionRepository.findById("DEFAULT")).thenReturn(Optional.of(defaultSession));
            when(instituteRepository.findById(INSTITUTE_ID)).thenReturn(Optional.of(testInstitute));
            when(packageInstituteRepository.findByPackageIdAndInstituteId(any(), eq(INSTITUTE_ID)))
                    .thenReturn(Optional.empty());

            when(packageRepository.save(any(PackageEntity.class))).thenAnswer(invocation -> {
                PackageEntity entity = invocation.getArgument(0);
                entity.setId("generated-id");
                return entity;
            });

            when(packageSessionRepository.save(any(PackageSession.class))).thenAnswer(invocation -> {
                PackageSession session = invocation.getArgument(0);
                session.setId("generated-ps-id");
                return session;
            });

            when(enrollInviteRepository.save(any(EnrollInvite.class))).thenAnswer(invocation -> {
                EnrollInvite invite = invocation.getArgument(0);
                invite.setId("generated-invite-id");
                return invite;
            });

            when(enrollInviteCoursePreviewService.createPreview(any(), any())).thenReturn("{}");
        }

        @Test
        @DisplayName("Should process valid courses even when some fail")
        void shouldProcessValidCoursesEvenWhenSomeFail() {
            BulkCourseItemDTO validCourse = BulkCourseItemDTO.builder()
                    .courseName("Valid Course")
                    .build();
            BulkCourseItemDTO invalidCourse = BulkCourseItemDTO.builder()
                    .courseName("") // Invalid
                    .build();
            BulkCourseItemDTO anotherValidCourse = BulkCourseItemDTO.builder()
                    .courseName("Another Valid Course")
                    .build();

            BulkAddCourseRequestDTO request = BulkAddCourseRequestDTO.builder()
                    .courses(List.of(validCourse, invalidCourse, anotherValidCourse))
                    .build();

            BulkAddCourseResponseDTO response = bulkCourseService.bulkAddCourses(request, INSTITUTE_ID, testUser);

            assertEquals(3, response.getTotalRequested());
            assertEquals(2, response.getSuccessCount());
            assertEquals(1, response.getFailureCount());

            // Check individual results
            assertEquals("SUCCESS", response.getResults().get(0).getStatus());
            assertEquals("FAILED", response.getResults().get(1).getStatus());
            assertEquals("SUCCESS", response.getResults().get(2).getStatus());
        }
    }

    @Nested
    @DisplayName("Payment Configuration Tests")
    class PaymentConfigurationTests {

        @BeforeEach
        void setUpMocks() {
            when(levelRepository.findById("DEFAULT")).thenReturn(Optional.of(defaultLevel));
            when(sessionRepository.findById("DEFAULT")).thenReturn(Optional.of(defaultSession));
            when(instituteRepository.findById(INSTITUTE_ID)).thenReturn(Optional.of(testInstitute));
            when(packageInstituteRepository.findByPackageIdAndInstituteId(any(), eq(INSTITUTE_ID)))
                    .thenReturn(Optional.empty());

            when(packageRepository.save(any(PackageEntity.class))).thenAnswer(invocation -> {
                PackageEntity entity = invocation.getArgument(0);
                entity.setId("generated-id");
                return entity;
            });

            when(packageSessionRepository.save(any(PackageSession.class))).thenAnswer(invocation -> {
                PackageSession session = invocation.getArgument(0);
                session.setId("generated-ps-id");
                return session;
            });

            when(enrollInviteRepository.save(any(EnrollInvite.class))).thenAnswer(invocation -> {
                EnrollInvite invite = invocation.getArgument(0);
                invite.setId("generated-invite-id");
                return invite;
            });

            when(enrollInviteCoursePreviewService.createPreview(any(), any())).thenReturn("{}");
        }

        @Test
        @DisplayName("Should use existing payment option when ID provided")
        void shouldUseExistingPaymentOption() {
            PaymentOption existingPaymentOption = new PaymentOption();
            existingPaymentOption.setId("existing-payment-id");
            existingPaymentOption.setName("Existing Payment Option");

            when(paymentOptionService.findById("existing-payment-id")).thenReturn(existingPaymentOption);

            BulkCoursePaymentConfigDTO paymentConfig = BulkCoursePaymentConfigDTO.builder()
                    .paymentOptionId("existing-payment-id")
                    .build();

            BulkCourseItemDTO courseItem = BulkCourseItemDTO.builder()
                    .courseName("Course with existing payment")
                    .paymentConfig(paymentConfig)
                    .build();

            BulkAddCourseRequestDTO request = BulkAddCourseRequestDTO.builder()
                    .courses(List.of(courseItem))
                    .build();

            BulkAddCourseResponseDTO response = bulkCourseService.bulkAddCourses(request, INSTITUTE_ID, testUser);

            assertEquals(1, response.getSuccessCount());
            assertEquals("existing-payment-id", response.getResults().get(0).getPaymentOptionId());

            // Verify we didn't create a new payment option
            verify(paymentOptionRepository, never()).save(any());
        }

        @Test
        @DisplayName("Should create ONE_TIME payment option")
        void shouldCreateOneTimePaymentOption() {
            PaymentOption createdPaymentOption = new PaymentOption();
            createdPaymentOption.setId("new-payment-id");

            when(paymentOptionRepository.save(any(PaymentOption.class))).thenReturn(createdPaymentOption);
            when(paymentPlanRepository.save(any(PaymentPlan.class))).thenAnswer(invocation -> {
                PaymentPlan plan = invocation.getArgument(0);
                plan.setId("new-plan-id");
                return plan;
            });

            BulkCoursePaymentConfigDTO paymentConfig = BulkCoursePaymentConfigDTO.builder()
                    .paymentType("ONE_TIME")
                    .price(999.0)
                    .currency("INR")
                    .validityInDays(365)
                    .build();

            BulkCourseItemDTO courseItem = BulkCourseItemDTO.builder()
                    .courseName("Paid Course")
                    .paymentConfig(paymentConfig)
                    .build();

            BulkAddCourseRequestDTO request = BulkAddCourseRequestDTO.builder()
                    .courses(List.of(courseItem))
                    .build();

            BulkAddCourseResponseDTO response = bulkCourseService.bulkAddCourses(request, INSTITUTE_ID, testUser);

            assertEquals(1, response.getSuccessCount());

            // Verify payment option was created
            ArgumentCaptor<PaymentOption> paymentCaptor = ArgumentCaptor.forClass(PaymentOption.class);
            verify(paymentOptionRepository).save(paymentCaptor.capture());
            assertEquals("ONE_TIME", paymentCaptor.getValue().getType());

            // Verify payment plan was created
            ArgumentCaptor<PaymentPlan> planCaptor = ArgumentCaptor.forClass(PaymentPlan.class);
            verify(paymentPlanRepository).save(planCaptor.capture());
            assertEquals(999.0, planCaptor.getValue().getActualPrice());
            assertEquals("INR", planCaptor.getValue().getCurrency());
            assertEquals(365, planCaptor.getValue().getValidityInDays());
        }

        @Test
        @DisplayName("Should create FREE payment option without plan")
        void shouldCreateFreePaymentOptionWithoutPlan() {
            PaymentOption createdPaymentOption = new PaymentOption();
            createdPaymentOption.setId("free-payment-id");

            when(paymentOptionRepository.save(any(PaymentOption.class))).thenReturn(createdPaymentOption);

            BulkCoursePaymentConfigDTO paymentConfig = BulkCoursePaymentConfigDTO.builder()
                    .paymentType("FREE")
                    .build();

            BulkCourseItemDTO courseItem = BulkCourseItemDTO.builder()
                    .courseName("Free Course")
                    .paymentConfig(paymentConfig)
                    .build();

            BulkAddCourseRequestDTO request = BulkAddCourseRequestDTO.builder()
                    .courses(List.of(courseItem))
                    .build();

            BulkAddCourseResponseDTO response = bulkCourseService.bulkAddCourses(request, INSTITUTE_ID, testUser);

            assertEquals(1, response.getSuccessCount());

            // Verify payment option was created
            ArgumentCaptor<PaymentOption> paymentCaptor = ArgumentCaptor.forClass(PaymentOption.class);
            verify(paymentOptionRepository).save(paymentCaptor.capture());
            assertEquals("FREE", paymentCaptor.getValue().getType());

            // Verify NO payment plan was created for FREE
            verify(paymentPlanRepository, never()).save(any());
        }
    }

    @Nested
    @DisplayName("DTO Helper Method Tests")
    class DtoHelperMethodTests {

        @Test
        @DisplayName("BulkCourseInventoryConfigDTO should return effective available slots")
        void shouldReturnEffectiveAvailableSlots() {
            BulkCourseInventoryConfigDTO config1 = BulkCourseInventoryConfigDTO.builder()
                    .maxSlots(100)
                    .availableSlots(50)
                    .build();
            assertEquals(50, config1.getEffectiveAvailableSlots());

            BulkCourseInventoryConfigDTO config2 = BulkCourseInventoryConfigDTO.builder()
                    .maxSlots(100)
                    .build();
            assertEquals(100, config2.getEffectiveAvailableSlots()); // Defaults to max

            BulkCourseInventoryConfigDTO config3 = BulkCourseInventoryConfigDTO.builder().build();
            assertNull(config3.getEffectiveAvailableSlots());
        }

        @Test
        @DisplayName("BulkCoursePaymentConfigDTO should return effective values")
        void shouldReturnEffectivePaymentValues() {
            BulkCoursePaymentConfigDTO config = BulkCoursePaymentConfigDTO.builder()
                    .price(100.0)
                    .build();

            assertEquals("INR", config.getEffectiveCurrency()); // Default
            assertEquals(365, config.getEffectiveValidityInDays()); // Default
            assertEquals(100.0, config.getEffectiveElevatedPrice()); // Falls back to price
            assertFalse(config.isEffectiveRequireApproval()); // Default false
        }

        @Test
        @DisplayName("BulkCourseGlobalDefaultsDTO should return effective values")
        void shouldReturnEffectiveGlobalDefaults() {
            BulkCourseGlobalDefaultsDTO defaults = new BulkCourseGlobalDefaultsDTO();

            assertEquals(5, defaults.getEffectiveCourseDepth());
            assertEquals("COURSE", defaults.getEffectiveCourseType());
            assertFalse(defaults.isEnabled());
        }

        @Test
        @DisplayName("BulkAddCourseRequestDTO should return empty defaults when null")
        void shouldReturnEmptyDefaultsWhenNull() {
            BulkAddCourseRequestDTO request = new BulkAddCourseRequestDTO();

            assertNotNull(request.getApplyToAllOrEmpty());
            assertFalse(request.isDryRun());
        }

        @Test
        @DisplayName("BulkCourseResultDTO factory methods should work correctly")
        void shouldCreateResultDTOsCorrectly() {
            BulkCourseResultDTO success = BulkCourseResultDTO.success(
                    0, "Course A", "course-id",
                    List.of("ps-1"), List.of("invite-1"), "payment-id");

            assertEquals(0, success.getIndex());
            assertEquals("Course A", success.getCourseName());
            assertEquals("SUCCESS", success.getStatus());
            assertNull(success.getErrorMessage());

            BulkCourseResultDTO failure = BulkCourseResultDTO.failure(
                    1, "Course B", "Something went wrong");

            assertEquals(1, failure.getIndex());
            assertEquals("Course B", failure.getCourseName());
            assertEquals("FAILED", failure.getStatus());
            assertEquals("Something went wrong", failure.getErrorMessage());
            assertTrue(failure.getPackageSessionIds().isEmpty());
        }
    }
}
