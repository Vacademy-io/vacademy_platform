package vacademy.io.admin_core_service.config.db;

import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.autoconfigure.jdbc.DataSourceProperties;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.jdbc.datasource.LazyConnectionDataSourceProxy;

import javax.sql.DataSource;
import java.util.HashMap;
import java.util.Map;

@Configuration
public class DataSourceConfiguration {

    @Bean
    @ConfigurationProperties("spring.datasource")
    public DataSourceProperties masterDataSourceProperties() {
        return new DataSourceProperties();
    }

    @Bean
    @ConfigurationProperties("spring.datasource.read")
    public DataSourceProperties slaveDataSourceProperties() {
        return new DataSourceProperties();
    }

    @Bean
    @ConfigurationProperties("spring.datasource.hikari")
    public DataSource masterDataSource(
            @Qualifier("masterDataSourceProperties") DataSourceProperties masterProperties) {
        return masterProperties
                .initializeDataSourceBuilder()
                .build();
    }

    @Bean
    @ConfigurationProperties("spring.datasource.read.hikari")
    public DataSource slaveDataSource(
            @Qualifier("masterDataSourceProperties") DataSourceProperties masterProperties,
            @Qualifier("slaveDataSourceProperties") DataSourceProperties slaveProperties) {

        // Inherit credentials from master if not specified for slave
        if (slaveProperties.getUsername() == null) {
            slaveProperties.setUsername(masterProperties.getUsername());
        }
        if (slaveProperties.getPassword() == null) {
            slaveProperties.setPassword(masterProperties.getPassword());
        }
        if (slaveProperties.getDriverClassName() == null) {
            slaveProperties.setDriverClassName(masterProperties.getDriverClassName());
        }
        if (slaveProperties.getUrl() == null) {
            slaveProperties.setUrl(masterProperties.getUrl());
        }

        return slaveProperties
                .initializeDataSourceBuilder()
                .build();
    }

    @Bean
    public DataSource routingDataSource(
            @Qualifier("masterDataSource") DataSource masterDataSource,
            @Qualifier("slaveDataSource") DataSource slaveDataSource) {

        ReplicationRoutingDataSource routingDataSource = new ReplicationRoutingDataSource();

        Map<Object, Object> dataSourceMap = new HashMap<>();
        dataSourceMap.put(DataSourceType.MASTER, masterDataSource);
        dataSourceMap.put(DataSourceType.SLAVE, slaveDataSource);

        routingDataSource.setTargetDataSources(dataSourceMap);
        routingDataSource.setDefaultTargetDataSource(masterDataSource);

        return routingDataSource;
    }

    @Bean
    @Primary
    public DataSource dataSource(@Qualifier("routingDataSource") DataSource routingDataSource) {
        return new LazyConnectionDataSourceProxy(routingDataSource);
    }
}
