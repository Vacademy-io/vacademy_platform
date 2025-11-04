package vacademy.io.notification_service.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import java.util.concurrent.*;

/**
 * Email dispatcher with rate limiting to respect AWS SES limits
 * Defaults to 50 emails per second (AWS SES standard limit)
 * Configurable via application properties: email.rate.limit.per.second
 */
@Component
@Slf4j
public class EmailDispatcher {

    @Value("${email.rate.limit.per.second:50}")
    private int maxEmailsPerSecond;

    private ScheduledExecutorService scheduler;
    private Semaphore semaphore;
    private volatile boolean initialized = false;

    @PostConstruct
    public void init() {
        // Use 95% of limit as safety margin to avoid hitting exact limit
        int effectiveLimit = (int) (maxEmailsPerSecond * 0.95);
        log.info("Initializing EmailDispatcher with rate limit: {} emails/second (effective: {} with safety margin)", 
                maxEmailsPerSecond, effectiveLimit);
        
        this.semaphore = new Semaphore(effectiveLimit);
        this.scheduler = Executors.newScheduledThreadPool(1);
        
        // Replenish permits every second to maintain rate limit
        this.scheduler.scheduleAtFixedRate(() -> {
            int available = semaphore.availablePermits();
            int needed = effectiveLimit - available;
            if (needed > 0) {
                semaphore.release(needed);
                log.debug("Replenished {} email permits. Available: {}", needed, semaphore.availablePermits());
            }
        }, 0, 1, TimeUnit.SECONDS);
        
        initialized = true;
        log.info("EmailDispatcher initialized successfully with rate limit of {} emails/second", effectiveLimit);
    }

    /**
     * Send email with rate limiting
     * Blocks if rate limit is reached to prevent exceeding AWS SES limits
     * 
     * @param emailTask The email sending task
     * @throws InterruptedException if interrupted while waiting for permit
     */
    public void sendEmail(Runnable emailTask) throws InterruptedException {
        if (!initialized) {
            log.warn("EmailDispatcher not initialized, initializing now");
            init();
        }
        
        // Acquire a permit (blocks if the limit is reached)
        // This ensures we never exceed AWS SES rate limits
        semaphore.acquire();
        
        // Execute email sending asynchronously
        CompletableFuture.runAsync(emailTask).exceptionally(throwable -> {
            log.error("Error sending email asynchronously", throwable);
            // Release permit on failure so it can be retried
            semaphore.release();
            return null;
        });
    }

    /**
     * Try to send email with rate limiting, returns false if rate limit exceeded
     * Non-blocking version for better control
     */
    public boolean trySendEmail(Runnable emailTask) {
        if (!initialized) {
            log.warn("EmailDispatcher not initialized, initializing now");
            init();
        }
        
        // Try to acquire permit without blocking
        if (semaphore.tryAcquire()) {
            CompletableFuture.runAsync(emailTask).exceptionally(throwable -> {
                log.error("Error sending email asynchronously", throwable);
                semaphore.release();
                return null;
            });
            return true;
        } else {
            log.warn("Rate limit reached. Email queued for retry. Available permits: {}", semaphore.availablePermits());
            return false;
        }
    }

    /**
     * Get current available email sending capacity
     */
    public int getAvailablePermits() {
        return initialized ? semaphore.availablePermits() : 0;
    }

    /**
     * Get configured rate limit
     */
    public int getRateLimit() {
        return maxEmailsPerSecond;
    }

    @PreDestroy
    public void shutdown() {
        log.info("Shutting down EmailDispatcher");
        if (scheduler != null) {
            scheduler.shutdown();
            try {
                if (!scheduler.awaitTermination(10, TimeUnit.SECONDS)) {
                    scheduler.shutdownNow();
                }
            } catch (InterruptedException e) {
                scheduler.shutdownNow();
                Thread.currentThread().interrupt();
            }
        }
    }
}