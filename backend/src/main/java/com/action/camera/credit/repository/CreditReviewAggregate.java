package com.action.camera.credit.repository;

public interface CreditReviewAggregate {

    Long getUserId();

    Long getReviewCount();

    Long getGoodReviewCount();

    Double getAverageRating();

    Long getEffectiveOrderCount();
}
