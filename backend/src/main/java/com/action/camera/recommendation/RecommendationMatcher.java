package com.action.camera.recommendation;

import java.time.LocalDate;
import java.util.Collection;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;

/** Pure, bounded recommendation match calculations shared by both recommendation directions. */
public final class RecommendationMatcher {

    private RecommendationMatcher() {
    }

    public static void addTextSignal(Map<String, Integer> weights, String value, int weight) {
        if (weights == null || value == null || value.isBlank() || weight <= 0) {
            return;
        }
        weights.merge(value.trim().toLowerCase(Locale.ROOT), weight, Integer::sum);
    }

    public static void addTextSignals(Map<String, Integer> weights, Collection<String> values, int weight) {
        if (values == null) {
            return;
        }
        values.forEach(value -> addTextSignal(weights, value, weight));
    }

    public static int textScore(String candidate, Map<String, Integer> weights, int maxScore) {
        return textScore(candidate, weights, maxScore, 0);
    }

    public static int textScore(String candidate,
                                Map<String, Integer> weights,
                                int maxScore,
                                int referenceWeightFloor) {
        if (candidate == null || candidate.isBlank() || weights == null || weights.isEmpty()) {
            return 0;
        }
        int maximumWeight = Math.max(referenceWeightFloor,
                weights.values().stream().max(Integer::compareTo).orElse(0));
        int matchedWeight = weights.getOrDefault(candidate.trim().toLowerCase(Locale.ROOT), 0);
        return proportionalScore(matchedWeight, maximumWeight, maxScore);
    }

    public static int tagScore(Collection<String> candidates, Map<String, Integer> weights, int maxScore) {
        return tagScore(candidates, weights, maxScore, 0);
    }

    public static int tagScore(Collection<String> candidates,
                               Map<String, Integer> weights,
                               int maxScore,
                               int referenceWeightFloor) {
        if (candidates == null || candidates.isEmpty() || weights == null || weights.isEmpty()) {
            return 0;
        }
        int matchedWeight = candidates.stream()
                .filter(Objects::nonNull)
                .map(value -> value.trim().toLowerCase(Locale.ROOT))
                .distinct()
                .mapToInt(value -> weights.getOrDefault(value, 0))
                .sum();
        int referenceWeight = Math.max(referenceWeightFloor, weights.values().stream()
                .sorted(Comparator.reverseOrder())
                .limit(3)
                .mapToInt(Integer::intValue)
                .sum());
        return proportionalScore(matchedWeight, referenceWeight, maxScore);
    }

    public static int weightedPriceScore(Long priceCent,
                                         List<WeightedBudget> budgets,
                                         int maxScore) {
        return weightedPriceScore(priceCent, budgets, maxScore, 0);
    }

    public static int weightedPriceScore(Long priceCent,
                                         List<WeightedBudget> budgets,
                                         int maxScore,
                                         int referenceWeightFloor) {
        if (priceCent == null || budgets == null || budgets.isEmpty()) {
            return 0;
        }
        int maximumWeight = Math.max(referenceWeightFloor,
                budgets.stream().mapToInt(WeightedBudget::weight).max().orElse(0));
        double bestWeightedFit = budgets.stream()
                .mapToDouble(budget -> budget.weight() * rangeFit(
                        priceCent,
                        budget.minCent(),
                        budget.maxCent()))
                .max()
                .orElse(0.0);
        return maximumWeight <= 0
                ? 0
                : Math.min(maxScore, (int) Math.round(maxScore * bestWeightedFit / maximumWeight));
    }

    public static int priceToBudgetScore(Long priceCent,
                                         Integer budgetMinCent,
                                         Integer budgetMaxCent,
                                         int maxScore) {
        if (priceCent == null) {
            return 0;
        }
        return (int) Math.round(maxScore * rangeFit(priceCent, budgetMinCent, budgetMaxCent));
    }

    public static int dateScore(Collection<LocalDate> availableDates,
                                Map<LocalDate, Integer> desiredDates,
                                int maxScore) {
        return dateScore(availableDates, desiredDates, maxScore, 0);
    }

    public static int dateScore(Collection<LocalDate> availableDates,
                                Map<LocalDate, Integer> desiredDates,
                                int maxScore,
                                int referenceWeightFloor) {
        if (availableDates == null || availableDates.isEmpty() || desiredDates == null || desiredDates.isEmpty()) {
            return 0;
        }
        int maximumWeight = Math.max(referenceWeightFloor,
                desiredDates.values().stream().max(Integer::compareTo).orElse(0));
        int matchedWeight = availableDates.stream()
                .filter(Objects::nonNull)
                .mapToInt(date -> desiredDates.getOrDefault(date, 0))
                .max()
                .orElse(0);
        return proportionalScore(matchedWeight, maximumWeight, maxScore);
    }

    private static int proportionalScore(int matchedWeight, int referenceWeight, int maxScore) {
        if (matchedWeight <= 0 || referenceWeight <= 0 || maxScore <= 0) {
            return 0;
        }
        return Math.min(maxScore, (int) Math.round((double) maxScore * matchedWeight / referenceWeight));
    }

    private static double rangeFit(long value, Number minimum, Number maximum) {
        if (minimum == null && maximum == null) {
            return 0.0;
        }
        long min = minimum == null ? maximum.longValue() : minimum.longValue();
        long max = maximum == null ? minimum.longValue() : maximum.longValue();
        if (min > max) {
            long swap = min;
            min = max;
            max = swap;
        }
        long midpoint = min + (max - min) / 2;
        long halfWidth = Math.max(1L, (max - min) / 2);
        if (value >= min && value <= max) {
            double normalizedDistance = Math.min(1.0, Math.abs((double) value - midpoint) / halfWidth);
            return 1.0 - 0.25 * normalizedDistance;
        }
        long gap = value < min ? min - value : value - max;
        long tolerance = Math.max(10_000L, Math.max(max - min, Math.max(1L, midpoint / 2)));
        return Math.max(0.0, 0.75 * (1.0 - (double) gap / tolerance));
    }

    public record WeightedBudget(Long minCent, Long maxCent, int weight) {
        public WeightedBudget {
            if (weight < 0) {
                throw new IllegalArgumentException("weight must be non-negative");
            }
        }
    }
}
