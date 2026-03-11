package vacademy.io.auth_service.feature.super_admin.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.auth_service.feature.super_admin.dto.*;
import vacademy.io.common.auth.repository.DailyUserActivitySummaryRepository;
import vacademy.io.common.auth.repository.UserRoleRepository;
import vacademy.io.common.auth.repository.UserSessionRepository;

import java.sql.Timestamp;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Date;
import java.util.List;

@Slf4j
@Service
public class SuperAdminAnalyticsService {

    @Autowired
    private UserSessionRepository userSessionRepository;

    @Autowired
    private DailyUserActivitySummaryRepository dailyActivityRepository;

    @Autowired
    private UserRoleRepository userRoleRepository;

    @Transactional(readOnly = true)
    @Cacheable(value = "superAdminInstituteSessions",
            key = "#instituteId + ':' + #page + ':' + #size + ':' + #startDate + ':' + #endDate")
    public SuperAdminPageResponse<InstituteSessionDTO> getInstituteSessions(
            String instituteId, int page, int size, LocalDateTime startDate, LocalDateTime endDate) {
        try {
            int offset = page * size;
            List<Object[]> rows = userSessionRepository.findSessionsByInstitutePaginated(
                    instituteId, startDate, endDate, size, offset);
            Long total = userSessionRepository.countSessionsByInstitute(instituteId, startDate, endDate);

            List<InstituteSessionDTO> content = rows.stream()
                    .map(this::mapToSessionDTO)
                    .toList();

            return SuperAdminPageResponse.<InstituteSessionDTO>builder()
                    .content(content)
                    .page(page)
                    .size(size)
                    .totalElements(total != null ? total : 0)
                    .totalPages(total != null ? (int) Math.ceil((double) total / size) : 0)
                    .build();
        } catch (Exception e) {
            log.error("Error getting sessions for institute {}: {}", instituteId, e.getMessage(), e);
            return SuperAdminPageResponse.<InstituteSessionDTO>builder()
                    .content(List.of()).page(page).size(size).totalElements(0).totalPages(0).build();
        }
    }

    @Transactional(readOnly = true)
    @Cacheable(value = "superAdminInstituteUsers",
            key = "#instituteId + ':' + #page + ':' + #size + ':' + (#role != null ? #role : '') + ':' + (#search != null ? #search : '')")
    public SuperAdminPageResponse<InstituteUserDTO> getInstituteUsers(
            String instituteId, String role, String search, int page, int size) {
        try {
            int offset = page * size;
            List<Object[]> rows = userRoleRepository.findUsersByInstitutePaginated(
                    instituteId, role, search, size, offset);
            Long total = userRoleRepository.countUsersByInstitute(instituteId, role, search);

            List<InstituteUserDTO> content = rows.stream()
                    .map(this::mapToUserDTO)
                    .toList();

            return SuperAdminPageResponse.<InstituteUserDTO>builder()
                    .content(content)
                    .page(page)
                    .size(size)
                    .totalElements(total != null ? total : 0)
                    .totalPages(total != null ? (int) Math.ceil((double) total / size) : 0)
                    .build();
        } catch (Exception e) {
            log.error("Error getting users for institute {}: {}", instituteId, e.getMessage(), e);
            return SuperAdminPageResponse.<InstituteUserDTO>builder()
                    .content(List.of()).page(page).size(size).totalElements(0).totalPages(0).build();
        }
    }

    @Transactional(readOnly = true)
    @Cacheable("superAdminCrossActiveUsers")
    public CrossInstituteActiveUsersDTO getCrossInstituteActiveUsers() {
        try {
            Long totalActive = userSessionRepository.countTotalCurrentlyActiveUsers();
            List<Object[]> perInstitute = userSessionRepository.getPerInstituteActiveCounts();

            List<CrossInstituteActiveUsersDTO.InstituteActiveCount> counts = perInstitute.stream()
                    .map(row -> CrossInstituteActiveUsersDTO.InstituteActiveCount.builder()
                            .instituteId(row[0] != null ? row[0].toString() : null)
                            .activeCount(row[1] instanceof Number n ? n.longValue() : 0L)
                            .build())
                    .toList();

            return CrossInstituteActiveUsersDTO.builder()
                    .totalCurrentlyActive(totalActive != null ? totalActive : 0L)
                    .perInstitute(counts)
                    .build();
        } catch (Exception e) {
            log.error("Error getting cross-institute active users: {}", e.getMessage(), e);
            return CrossInstituteActiveUsersDTO.builder()
                    .totalCurrentlyActive(0L).perInstitute(List.of()).build();
        }
    }

    @Transactional(readOnly = true)
    @Cacheable(value = "superAdminActivityTrends", key = "#days")
    public PlatformActivityTrendDTO getPlatformActivityTrends(int days) {
        try {
            LocalDate endDate = LocalDate.now();
            LocalDate startDate = endDate.minusDays(days);

            Object[] totals = dailyActivityRepository.getPlatformWideTotals(startDate, endDate);
            List<Object[]> dailyRows = dailyActivityRepository.getPlatformWideDailyTrends(startDate, endDate);

            Long totalUsers = 0L, totalSessions = 0L, totalApiCalls = 0L;
            if (totals != null && totals.length >= 3) {
                totalUsers = totals[0] instanceof Number n ? n.longValue() : 0L;
                totalSessions = totals[1] instanceof Number n ? n.longValue() : 0L;
                totalApiCalls = totals[2] instanceof Number n ? n.longValue() : 0L;
            }

            List<PlatformActivityTrendDTO.DailyTrend> trends = dailyRows.stream()
                    .map(row -> PlatformActivityTrendDTO.DailyTrend.builder()
                            .date(row[0] instanceof java.sql.Date d ? d.toLocalDate() : null)
                            .uniqueUsers(row[1] instanceof Number n ? n.longValue() : 0L)
                            .totalSessions(row[2] instanceof Number n ? n.longValue() : 0L)
                            .totalApiCalls(row[3] instanceof Number n ? n.longValue() : 0L)
                            .build())
                    .toList();

            return PlatformActivityTrendDTO.builder()
                    .totalUniqueUsers(totalUsers)
                    .totalSessions(totalSessions)
                    .totalApiCalls(totalApiCalls)
                    .dailyTrends(trends)
                    .build();
        } catch (Exception e) {
            log.error("Error getting platform activity trends: {}", e.getMessage(), e);
            return PlatformActivityTrendDTO.builder()
                    .totalUniqueUsers(0L).totalSessions(0L).totalApiCalls(0L).dailyTrends(List.of()).build();
        }
    }

    private InstituteSessionDTO mapToSessionDTO(Object[] row) {
        return InstituteSessionDTO.builder()
                .sessionId(row[0] != null ? row[0].toString() : null)
                .userId(row[1] != null ? row[1].toString() : null)
                .deviceType(row[2] != null ? row[2].toString() : null)
                .ipAddress(row[3] != null ? row[3].toString() : null)
                .isActive(row[4] instanceof Boolean b ? b : null)
                .loginTime(row[5] instanceof Timestamp ts ? ts.toLocalDateTime() : null)
                .lastActivityTime(row[6] instanceof Timestamp ts ? ts.toLocalDateTime() : null)
                .logoutTime(row[7] instanceof Timestamp ts ? ts.toLocalDateTime() : null)
                .sessionDurationMinutes(row[8] instanceof Number n ? n.longValue() : null)
                .build();
    }

    private InstituteUserDTO mapToUserDTO(Object[] row) {
        return InstituteUserDTO.builder()
                .userId(row[0] != null ? row[0].toString() : null)
                .fullName(row[1] != null ? row[1].toString() : null)
                .email(row[2] != null ? row[2].toString() : null)
                .mobileNumber(row[3] != null ? row[3].toString() : null)
                .roles(row[4] != null ? row[4].toString() : null)
                .status(row[5] != null ? row[5].toString() : null)
                .lastLoginTime(row[6] instanceof Timestamp ts ? new Date(ts.getTime()) : null)
                .createdAt(row[7] instanceof Timestamp ts ? new Date(ts.getTime()) : null)
                .build();
    }
}
