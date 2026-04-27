package vacademy.io.notification_service.config;

import com.amazonaws.auth.AWSStaticCredentialsProvider;
import com.amazonaws.auth.BasicAWSCredentials;
import com.amazonaws.services.s3.AmazonS3;
import com.amazonaws.services.s3.AmazonS3ClientBuilder;
import io.awspring.cloud.sqs.config.SqsMessageListenerContainerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.sqs.SqsAsyncClient;

@Configuration
@ConditionalOnProperty(name = "aws.inbound.email.enabled", havingValue = "true", matchIfMissing = false)
public class AwsInboundConfig {

    @Value("${aws.inbound.accessKey}")
    private String accessKey;

    @Value("${aws.inbound.secretKey}")
    private String secretKey;

    @Value("${aws.inbound.region}")
    private String region;

    @Bean(name = "inboundS3Client")
    public AmazonS3 inboundS3Client() {
        BasicAWSCredentials credentials = new BasicAWSCredentials(accessKey, secretKey);
        return AmazonS3ClientBuilder.standard()
                .withCredentials(new AWSStaticCredentialsProvider(credentials))
                .withRegion(region)
                .build();
    }

    @Bean(name = "inboundSqsAsyncClient")
    public SqsAsyncClient inboundSqsAsyncClient() {
        return SqsAsyncClient.builder()
                .credentialsProvider(StaticCredentialsProvider.create(
                        AwsBasicCredentials.create(accessKey, secretKey)))
                .region(Region.of(region))
                .build();
    }

    @Bean(name = "inboundEmailContainerFactory")
    public SqsMessageListenerContainerFactory<Object> inboundEmailContainerFactory(
            @Qualifier("inboundSqsAsyncClient") SqsAsyncClient inboundSqsAsyncClient) {
        return SqsMessageListenerContainerFactory.builder()
                .sqsAsyncClient(inboundSqsAsyncClient)
                .build();
    }
}
