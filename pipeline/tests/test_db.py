import pytest

from core.db import _row


def record(**overrides):
    return {
        "id": "film_cameras:000001",
        "category": "film_cameras",
        "name": "F2",
        "maker": "Nikon",
        "data_license": "CC BY-SA 4.0",
        **overrides,
    }


def test_row_fills_defaults_and_wraps_json():
    row = _row(record(attributes={"camera_type": "slr"}))
    assert row["status"] == "active"
    assert row["aliases"] == []
    assert row["attributes"].obj == {"camera_type": "slr"}
    assert row["production_count"] is None


def test_row_rejects_missing_required_field():
    with pytest.raises(ValueError, match="missing maker"):
        _row(record(maker=""))


def test_row_rejects_unknown_field():
    with pytest.raises(ValueError, match="unknown fields weight"):
        _row(record(weight=627))
