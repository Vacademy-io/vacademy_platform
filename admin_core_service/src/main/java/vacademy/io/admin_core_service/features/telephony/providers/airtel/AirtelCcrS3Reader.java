package vacademy.io.admin_core_service.features.telephony.providers.airtel;

import com.amazonaws.services.s3.AmazonS3;
import com.amazonaws.services.s3.model.ListObjectsV2Request;
import com.amazonaws.services.s3.model.ListObjectsV2Result;
import com.amazonaws.services.s3.model.S3Object;
import com.amazonaws.services.s3.model.S3ObjectSummary;
import com.amazonaws.util.IOUtils;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;
import vacademy.io.common.exceptions.VacademyException;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

/**
 * Thin reader over the Airtel CCR/CDR export bucket: list keys under a prefix,
 * fetch an object as a UTF-8 string (json/csv) or raw bytes (mp3).
 */
@Component
@ConditionalOnProperty(prefix = "telephony.airtel.s3", name = "enabled", havingValue = "true")
public class AirtelCcrS3Reader {

    private final AmazonS3 s3;
    private final String bucket;

    public AirtelCcrS3Reader(@Qualifier("airtelCcrS3Client") AmazonS3 s3,
                             @Value("${telephony.airtel.s3.bucket:vacademy-airtel-ccr}") String bucket) {
        this.s3 = s3;
        this.bucket = bucket;
    }

    /** Every object key under {@code prefix} (paginated). */
    public List<String> listKeys(String prefix) {
        List<String> keys = new ArrayList<>();
        ListObjectsV2Request req = new ListObjectsV2Request().withBucketName(bucket).withPrefix(prefix);
        ListObjectsV2Result res;
        do {
            res = s3.listObjectsV2(req);
            for (S3ObjectSummary s : res.getObjectSummaries()) {
                keys.add(s.getKey());
            }
            req.setContinuationToken(res.getNextContinuationToken());
        } while (res.isTruncated());
        return keys;
    }

    public boolean exists(String key) {
        return s3.doesObjectExist(bucket, key);
    }

    public String getString(String key) {
        try (S3Object obj = s3.getObject(bucket, key)) {
            return new String(IOUtils.toByteArray(obj.getObjectContent()), StandardCharsets.UTF_8);
        } catch (Exception e) {
            throw new VacademyException("Airtel S3 read failed for " + key + ": " + e.getMessage());
        }
    }

    public byte[] getBytes(String key) {
        try (S3Object obj = s3.getObject(bucket, key)) {
            return IOUtils.toByteArray(obj.getObjectContent());
        } catch (Exception e) {
            throw new VacademyException("Airtel S3 read failed for " + key + ": " + e.getMessage());
        }
    }
}
