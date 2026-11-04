package com.action.camera.auth.service;

import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.locks.ReentrantLock;
import java.util.stream.Stream;

/** Bounded JVM-local guard, including first sends with no database row to lock.
 * Held through commit/rollback, so concurrent counts cannot see uncommitted reservations.
 * Database challenge locks remain in place. Multi-instance deployments need a shared guard.
 */
final class SmsSendConcurrencyGuard {
    private static final ReentrantLock[] LOCKS = new ReentrantLock[4096];

    static {
        for (int i = 0; i < LOCKS.length; i++) {
            LOCKS[i] = new ReentrantLock();
        }
    }

    private SmsSendConcurrencyGuard() { }

    static boolean acquireUntilTransactionCompletion(String phoneHash, String ip, String device) {
        if (!TransactionSynchronizationManager.isSynchronizationActive()) {
            throw new IllegalStateException("SMS send requires a managed transaction");
        }
        List<ReentrantLock> acquired = new ArrayList<>();
        int[] indices = Stream.of("phone:" + phoneHash, "ip:" + ip, "device:" + device)
                .mapToInt(key -> Math.floorMod(key.hashCode(), LOCKS.length)).distinct().sorted().toArray();
        for (int index : indices) {
            ReentrantLock lock = LOCKS[index];
            if (!lock.tryLock()) {
                acquired.forEach(ReentrantLock::unlock);
                return false;
            }
            acquired.add(lock);
        }
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCompletion(int status) {
                acquired.forEach(ReentrantLock::unlock);
            }
        });
        return true;
    }
}
