"""Heart-rate-reserve (Karvonen) zones derived from the owner's max and resting heart rate.

Zones are defined as fractions of heart-rate reserve (max - resting) above resting heart rate:
Z1 50-60%, Z2 60-70%, Z3 70-80%, Z4 80-90%, Z5 90-100%. Heart rates below 50% of reserve count as
Z1 and heart rates above max count as Z5. Each zone includes its lower bound and excludes its upper
bound.
"""

from dataclasses import dataclass

ZONE_RESERVE_FRACTIONS: tuple[tuple[int, float, float], ...] = (
    (1, 0.5, 0.6),
    (2, 0.6, 0.7),
    (3, 0.7, 0.8),
    (4, 0.8, 0.9),
    (5, 0.9, 1.0),
)


@dataclass(frozen=True)
class HeartRateZone:
    zone: int
    lower_reserve_fraction: float
    upper_reserve_fraction: float
    lower_bpm: float
    upper_bpm: float


def _validate(max_heart_rate: float, resting_heart_rate: float) -> None:
    if resting_heart_rate <= 0 or max_heart_rate <= resting_heart_rate:
        raise ValueError("max heart rate must be greater than a positive resting heart rate")


def heart_rate_reserve_zones(
    max_heart_rate: float, resting_heart_rate: float
) -> list[HeartRateZone]:
    """Return Z1..Z5 boundaries in bpm.

    Z1's lower bound is nominal: heart rates below it also count as Z1.
    """
    _validate(max_heart_rate, resting_heart_rate)
    reserve = max_heart_rate - resting_heart_rate
    return [
        HeartRateZone(
            zone=zone,
            lower_reserve_fraction=lower,
            upper_reserve_fraction=upper,
            lower_bpm=round(resting_heart_rate + lower * reserve, 1),
            upper_bpm=round(resting_heart_rate + upper * reserve, 1),
        )
        for zone, lower, upper in ZONE_RESERVE_FRACTIONS
    ]


def heart_rate_zone(heart_rate: float, max_heart_rate: float, resting_heart_rate: float) -> int:
    """Classify one heart-rate value into zone 1..5 using exact (unrounded) reserve fractions."""
    _validate(max_heart_rate, resting_heart_rate)
    fraction = (heart_rate - resting_heart_rate) / (max_heart_rate - resting_heart_rate)
    for zone, _lower, upper in ZONE_RESERVE_FRACTIONS[:-1]:
        if fraction < upper:
            return zone
    return 5
