package vacademy.io.admin_core_service.features.telephony.providers.airtel;

import com.amazonaws.auth.AWSStaticCredentialsProvider;
import com.amazonaws.auth.BasicAWSCredentials;
import com.amazonaws.auth.DefaultAWSCredentialsProviderChain;
import com.amazonaws.services.s3.AmazonS3;
import com.amazonaws.services.s3.AmazonS3ClientBuilder;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * S3 client for reading the Airtel CCR/CDR export bucket (vacademy-airtel-ccr).
 *
 * The whole Airtel-import subsystem (this config + reader + service + scheduler)
 * is gated on {@code telephony.airtel.s3.enabled=true}, so it's inert until
 * explicitly switched on per environment. Credentials: explicit access/secret
 * key if provided, else the default provider chain (instance/role creds, e.g.
 * the deployment's s3admin identity).
 */
@Configuration
@ConditionalOnProperty(prefix = "telephony.airtel.s3", name = "enabled", havingValue = "true")
public class AirtelS3Config {

    @Value("${telephony.airtel.s3.region:us-east-1}")
    private String region;

    @Value("${telephony.airtel.s3.access-key:}")
    private String accessKey;

    @Value("${telephony.airtel.s3.secret-key:}")
    private String secretKey;

    @Bean(name = "airtelCcrS3Client")
    public AmazonS3 airtelCcrS3Client() {
        AmazonS3ClientBuilder builder = AmazonS3ClientBuilder.standard().withRegion(region);
        if (accessKey != null && !accessKey.isBlank() && secretKey != null && !secretKey.isBlank()) {
            builder = builder.withCredentials(
                    new AWSStaticCredentialsProvider(new BasicAWSCredentials(accessKey, secretKey)));
        } else {
            builder = builder.withCredentials(DefaultAWSCredentialsProviderChain.getInstance());
        }
        return builder.build();
    }
}
