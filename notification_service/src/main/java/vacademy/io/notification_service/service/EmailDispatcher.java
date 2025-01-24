package vacademy.io.notification_service.service;

import java.util.concurrent.*;

public class EmailDispatcher {

    private static final int MAX_EMAILS_PER_SECOND = 14;
    private static EmailDispatcher instance;
    private final ScheduledExecutorService scheduler;
    private final Semaphore semaphore;

    private EmailDispatcher() {
        this.scheduler = Executors.newScheduledThreadPool(1);
        this.semaphore = new Semaphore(MAX_EMAILS_PER_SECOND);
        // Replenish permits every second
        this.scheduler.scheduleAtFixedRate(() -> semaphore.release(MAX_EMAILS_PER_SECOND - semaphore.availablePermits()),
                0, 1, TimeUnit.SECONDS);
    }

    public static synchronized EmailDispatcher getInstance() {
        if (instance == null) {
            instance = new EmailDispatcher();
        }
        return instance;
    }

    public void sendEmail(Runnable emailTask) throws InterruptedException {
        // Acquire a permit (blocks if the limit is reached)
        semaphore.acquire();
        CompletableFuture.runAsync(emailTask);
    }

    public void shutdown() {
        scheduler.shutdown();
    }
}