package com.action.camera.common.page;

import java.util.List;

/**
 * Minimal page wrapper used by P4 list APIs.
 */
public class PageResult<T> {

    private final List<T> records;
    private final int page;
    private final int size;
    private final long total;

    public PageResult(List<T> records, int page, int size, long total) {
        this.records = records;
        this.page = page;
        this.size = size;
        this.total = total;
    }

    public List<T> getRecords() {
        return records;
    }

    public int getPage() {
        return page;
    }

    public int getSize() {
        return size;
    }

    public long getTotal() {
        return total;
    }
}
