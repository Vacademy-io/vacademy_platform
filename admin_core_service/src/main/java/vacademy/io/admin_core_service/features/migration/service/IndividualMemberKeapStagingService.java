package vacademy.io.admin_core_service.features.migration.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVParser;
import org.apache.commons.csv.CSVRecord;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import vacademy.io.admin_core_service.features.migration.dto.KeapPaymentDTO;
import vacademy.io.admin_core_service.features.migration.dto.KeapUserDTO;
import vacademy.io.admin_core_service.features.migration.entity.MigrationStagingKeapPayment;
import vacademy.io.admin_core_service.features.migration.entity.MigrationStagingKeapUser;
import vacademy.io.admin_core_service.features.migration.repository.MigrationStagingPaymentRepository;
import vacademy.io.admin_core_service.features.migration.repository.MigrationStagingRepository;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.List;
import java.util.Map;

@Service
public class IndividualMemberKeapStagingService {

    @Autowired
    private MigrationStagingRepository stagingRepository;

    @Autowired
    private MigrationStagingPaymentRepository paymentStagingRepository;

    public byte[] uploadUserCsv(MultipartFile file) {
        try (BufferedReader fileReader = new BufferedReader(
                new InputStreamReader(file.getInputStream(), StandardCharsets.UTF_8));
                CSVParser csvParser = new CSVParser(fileReader,
                        CSVFormat.DEFAULT.withFirstRecordAsHeader().withIgnoreHeaderCase().withTrim())) {

            StringBuilder csvOutput = new StringBuilder();
            csvOutput.append("Email,ContactId,UploadStatus,ErrorMessage\n");

            ObjectMapper mapper = new ObjectMapper();
            SimpleDateFormat dateFormat = new SimpleDateFormat("yyyy-MM-dd");

            for (CSVRecord csvRecord : csvParser) {
                String email = csvRecord.isMapped("Email") ? csvRecord.get("Email") : null;
                String contactId = csvRecord.isMapped("ContactId") ? csvRecord.get("ContactId")
                        : (csvRecord.isMapped("Id") ? csvRecord.get("Id") : null);

                String status = "SUCCESS";
                String error = "";

                if (contactId == null || contactId.isEmpty()) {
                    status = "FAILED";
                    error = "ContactId is required";
                }

                try {
                    KeapUserDTO userDTO = new KeapUserDTO();
                    userDTO.setContactId(contactId);
                    userDTO.setEmail(email);
                    userDTO.setFirstName(csvRecord.isMapped("FirstName") ? csvRecord.get("FirstName") : null);
                    userDTO.setLastName(csvRecord.isMapped("LastName") ? csvRecord.get("LastName") : null);
                    userDTO.setPhone(csvRecord.isMapped("Phone1") ? csvRecord.get("Phone1") : null);
                    userDTO.setAddress(csvRecord.isMapped("StreetAddress1") ? csvRecord.get("StreetAddress1") : null);
                    userDTO.setCity(csvRecord.isMapped("City") ? csvRecord.get("City") : null);
                    userDTO.setState(csvRecord.isMapped("State") ? csvRecord.get("State") : null);
                    userDTO.setZipCode(csvRecord.isMapped("PostalCode") ? csvRecord.get("PostalCode") : null);
                    userDTO.setCountry(csvRecord.isMapped("Country") ? csvRecord.get("Country") : null);
                    userDTO.setProductId(csvRecord.isMapped("ProductId") ? csvRecord.get("ProductId") : null);

                    String startDateStr = csvRecord.isMapped("StartDate") ? csvRecord.get("StartDate") : null;
                    if (startDateStr != null && !startDateStr.isEmpty()) {
                        try {
                            userDTO.setStartDate(dateFormat.parse(startDateStr));
                        } catch (Exception ignored) {
                        }
                    }

                    String nextBillDateStr = csvRecord.isMapped("NextBillDate") ? csvRecord.get("NextBillDate") : null;
                    if (nextBillDateStr != null && !nextBillDateStr.isEmpty()) {
                        try {
                            userDTO.setNextBillDate(dateFormat.parse(nextBillDateStr));
                        } catch (Exception ignored) {
                        }
                    }

                    userDTO.setEwayToken(csvRecord.isMapped("Token") ? csvRecord.get("Token") : null);

                    // Map Job Type
                    if (csvRecord.isMapped("Job Type")) {
                        userDTO.setJobType(csvRecord.get("Job Type"));
                    }

                    if (csvRecord.isMapped("Status")) {
                        userDTO.setStatus(csvRecord.get("Status"));
                    }

                    MigrationStagingKeapUser stagingUser = new MigrationStagingKeapUser();
                    stagingUser.setKeapContactId(userDTO.getContactId());
                    stagingUser.setEmail(userDTO.getEmail());
                    stagingUser.setFirstName(userDTO.getFirstName());
                    stagingUser.setLastName(userDTO.getLastName());
                    stagingUser.setPhone(userDTO.getPhone());
                    stagingUser.setAddress(userDTO.getAddress());
                    stagingUser.setCity(userDTO.getCity());
                    stagingUser.setState(userDTO.getState());
                    stagingUser.setZipCode(userDTO.getZipCode());
                    stagingUser.setCountry(userDTO.getCountry());
                    stagingUser.setProductId(userDTO.getProductId());
                    stagingUser.setStartDate(userDTO.getStartDate());
                    stagingUser.setNextBillDate(userDTO.getNextBillDate());
                    stagingUser.setEwayToken(userDTO.getEwayToken());
                    stagingUser.setJobType(userDTO.getJobType());
                    stagingUser.setUserPlanStatus(userDTO.getStatus()); // Map status to userPlanStatus

                    stagingUser.setRecordType("INDIVIDUAL");
                    stagingUser.setMigrationStatus("PENDING");
                    stagingUser.setRawData(mapper.writeValueAsString(userDTO));

                    stagingRepository.save(stagingUser);

                } catch (Exception e) {
                    status = "FAILED";
                    error = e.getMessage();
                }

                csvOutput.append(
                        String.format("%s,%s,%s,\"%s\"\n", email, contactId, status, error.replace("\"", "\"\"")));
            }

            return csvOutput.toString().getBytes(StandardCharsets.UTF_8);

        } catch (

        Exception e) {
            throw new RuntimeException("Failed to parse CSV file: " + e.getMessage());
        }
    }

    public byte[] uploadPaymentCsv(MultipartFile file) {
        try (BufferedReader fileReader = new BufferedReader(
                new InputStreamReader(file.getInputStream(), StandardCharsets.UTF_8));
                CSVParser csvParser = new CSVParser(fileReader,
                        CSVFormat.DEFAULT.withFirstRecordAsHeader().withIgnoreHeaderCase().withTrim())) {

            StringBuilder csvOutput = new StringBuilder();
            csvOutput.append("Email,ContactId,TransactionId,UploadStatus,ErrorMessage\n");

            ObjectMapper mapper = new ObjectMapper();
            SimpleDateFormat dateFormat = new SimpleDateFormat("yyyy-MM-dd");

            for (CSVRecord csvRecord : csvParser) {
                String email = csvRecord.isMapped("Email") ? csvRecord.get("Email") : "UNKNOWN";
                String contactId = csvRecord.isMapped("ContactId") ? csvRecord.get("ContactId") : "UNKNOWN";
                String transactionId = csvRecord.isMapped("TransactionId") ? csvRecord.get("TransactionId") : "UNKNOWN";
                String status = "SUCCESS";
                String error = "";

                try {
                    KeapPaymentDTO paymentDTO = new KeapPaymentDTO();
                    paymentDTO.setEmail(email);
                    paymentDTO.setContactId(contactId);

                    String amountStr = csvRecord.isMapped("Amount") ? csvRecord.get("Amount") : "0.0";
                    try {
                        paymentDTO.setAmount(Double.parseDouble(amountStr));
                    } catch (NumberFormatException e) {
                        paymentDTO.setAmount(0.0);
                    }

                    String dateStr = csvRecord.isMapped("Date") ? csvRecord.get("Date") : null;
                    if (dateStr != null && !dateStr.isEmpty()) {
                        try {
                            paymentDTO.setDate(dateFormat.parse(dateStr));
                        } catch (Exception ignored) {
                        }
                    }

                    paymentDTO.setTransactionId(transactionId);
                    paymentDTO.setStatus(csvRecord.isMapped("Status") ? csvRecord.get("Status") : null);

                    MigrationStagingKeapPayment stagingPayment = new MigrationStagingKeapPayment();
                    stagingPayment.setKeapContactId(paymentDTO.getContactId()); // Link by Contact ID
                    stagingPayment.setEmail(paymentDTO.getEmail());
                    stagingPayment.setAmount(paymentDTO.getAmount());

                    if (paymentDTO.getDate() != null) {
                        stagingPayment.setTransactionDate(
                                new java.sql.Timestamp(paymentDTO.getDate().getTime()).toLocalDateTime());
                    }

                    stagingPayment.setTransactionId(paymentDTO.getTransactionId());
                    stagingPayment.setStatus(paymentDTO.getStatus());

                    stagingPayment.setMigrationStatus("PENDING");
                    stagingPayment.setRawData(mapper.writeValueAsString(paymentDTO));

                    paymentStagingRepository.save(stagingPayment);

                } catch (Exception e) {
                    status = "FAILED";
                    error = e.getMessage();
                }

                csvOutput.append(String.format("%s,%s,%s,%s,\"%s\"\n", email, contactId, transactionId, status,
                        error.replace("\"", "\"\"")));
            }

            return csvOutput.toString().getBytes(StandardCharsets.UTF_8);

        } catch (Exception e) {
            throw new RuntimeException("Failed to parse Payment CSV file: " + e.getMessage());
        }
    }

    public List<MigrationStagingKeapUser> getPendingRecords(String recordType, int batchSize) {
        return stagingRepository.findByMigrationStatusAndRecordType("PENDING", recordType,
                PageRequest.of(0, batchSize));
    }

    public List<MigrationStagingKeapPayment> getPendingPaymentRecords(int batchSize) {
        return paymentStagingRepository.findByMigrationStatus("PENDING", PageRequest.of(0, batchSize));
    }

    public void updateStatus(MigrationStagingKeapUser user, String status, String errorMessage) {
        user.setMigrationStatus(status);
        user.setErrorMessage(errorMessage);
        stagingRepository.save(user);
    }

    public void updatePaymentStatus(MigrationStagingKeapPayment payment, String status, String errorMessage) {
        payment.setMigrationStatus(status);
        payment.setErrorMessage(errorMessage);
        paymentStagingRepository.save(payment);
    }

    public List<MigrationStagingKeapPayment> getPaymentsForUser(String contactId) {
        return paymentStagingRepository.findByKeapContactId(contactId);
    }

    public Map<String, Long> getStatusCounts() {
        return Map.of(
                "PENDING", stagingRepository.countByMigrationStatus("PENDING"),
                "COMPLETED", stagingRepository.countByMigrationStatus("COMPLETED"),
                "FAILED", stagingRepository.countByMigrationStatus("FAILED"));
    }
}
