import pytest

from app.services.heart_rate_zones import heart_rate_reserve_zones, heart_rate_zone


def test_reserve_zone_boundaries_use_karvonen_formula() -> None:
    zones = heart_rate_reserve_zones(194, 55)

    assert [zone.zone for zone in zones] == [1, 2, 3, 4, 5]
    assert zones[0].lower_bpm == pytest.approx(124.5)
    assert zones[1].lower_bpm == pytest.approx(55 + 0.6 * 139, abs=0.05)
    assert zones[-1].upper_bpm == 194
    assert all(
        left.upper_bpm == right.lower_bpm for left, right in zip(zones, zones[1:], strict=False)
    )


@pytest.mark.parametrize(
    ("heart_rate", "zone"),
    [
        (40, 1),
        (100, 1),
        (125, 1),
        (139.99, 1),
        (140, 2),
        (155, 3),
        (170, 4),
        (184.99, 4),
        (185, 5),
        (200, 5),
        (230, 5),
    ],
)
def test_heart_rate_zone_classifies_with_lower_bound_inclusive(
    heart_rate: float, zone: int
) -> None:
    # max 200, resting 50 -> reserve 150; Z2 starts at 140, Z5 at 185.
    assert heart_rate_zone(heart_rate, 200, 50) == zone


def test_zone_helpers_reject_invalid_inputs() -> None:
    with pytest.raises(ValueError):
        heart_rate_reserve_zones(150, 150)
    with pytest.raises(ValueError):
        heart_rate_zone(120, 180, 0)
