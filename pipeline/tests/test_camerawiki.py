import pytest

from core.adapters import camerawiki_dump as cw
from core.registry import IdConflict, Registry


@pytest.mark.parametrize(
    ("values", "expected"),
    [
        (["SLR"], "slr"),
        (["folding", "rangefinder", "viewfinder"], "folding"),
        (["disposable", "viewfinder"], "single_use"),
        (["compact"], "point_and_shoot"),
        (["unknown"], None),
    ],
)
def test_camera_type(values, expected):
    assert cw.camera_type(values) == expected


def test_film_formats():
    assert cw.film_formats(["135", "APS", "Polaroid SX-70", "35mm"]) == [
        "135",
        "aps",
        "instant_sx70",
    ]


@pytest.mark.parametrize(
    ("text", "expected"),
    [
        ("24 x 36 mm", "24x36"),
        ("24mm × 36mm", "24x36"),
        ("16.7×30.2 mm (C, H, and P formats)", "16.7x30.2"),
        ("6 x 6 cm on 120 type rollfilm", None),
    ],
)
def test_frame_size(text, expected):
    assert cw.frame_size(text) == expected


@pytest.mark.parametrize(
    ("text", "expected"),
    [
        ("42mm screw mount", "M42"),
        ("K mount", "Pentax K"),
        ("Pentax KAF2 (metal)", "Pentax K"),
        ("Nikon F bayonet AI-s", "Nikon F"),
        ("special bayonet", None),
    ],
)
def test_lens_mount(text, expected):
    assert cw.lens_mount(text) == expected


@pytest.mark.parametrize(
    ("text", "expected"),
    [
        ("focal plane cloth curtains, horizontal travel", "focal_plane_cloth"),
        ("Quartz-timed, electronically operated horizontal-travel titanium.", "focal_plane_metal"),
        ("Compur C00", "leaf"),
        ("Behind-the-lens mechanical shutter, fixed at 1/125 s.", "leaf"),
        ("Rotary", "other"),
        ("Electronically controlled high-speed shutter", None),
    ],
)
def test_shutter_type(text, expected):
    assert cw.shutter_type(text) == expected


@pytest.mark.parametrize(
    ("text", "expected"),
    [
        ('Bulb, 10" -- 1/2000s', {"fastest": "1/2000", "slowest": "10", "bulb": True}),
        (
            "X, B, 1, 1/2, 1/4, 1/8, 1/15, 1/30, 1/60, 1/125, 1/250, 1/500 sec.",
            {"fastest": "1/500", "slowest": "1", "bulb": True},
        ),
        ("1/50 sec. and 1/100 sec.", {"fastest": "1/100", "slowest": "1/50"}),
        ("Electronic shutter", None),
    ],
)
def test_shutter_speeds(text, expected):
    assert cw.shutter_speeds(text) == expected


@pytest.mark.parametrize(
    ("text", "expected"),
    [
        ("None.", "none"),
        ("TTL center-weighted (60/40)", "ttl"),
        ("TTL off-the-film", "ttl_otf"),
        ("uncoupled selenium meter", "built_in"),
        ("Program AE EV5.6 - 17", None),
    ],
)
def test_metering(text, expected):
    assert cw.metering(text) == expected


def test_exposure_modes():
    assert cw.exposure_modes(["P", "M", "Aperture priority"]) == [
        "manual",
        "aperture_priority",
        "program",
    ]


@pytest.mark.parametrize(
    ("text", "expected"),
    [
        ("None (fixed focus)", "fixed"),
        ("TTL phase detection. AF modes: One-Shot", "autofocus"),
        ("two distance zones selectable", "zone"),
        ("manual focusing with help of coupled rangefinder", "manual"),
        ("by rack & pinion", "manual"),
    ],
)
def test_focus(text, expected):
    assert cw.focus(text) == expected


def test_registry_keeps_ids_and_flags_conflicts(tmp_path):
    reg = Registry("film_cameras")
    a = reg.assign(["wikidata:Q1"], "r1")
    b = reg.assign(["camerawiki:7"], "r1")
    assert (a, b) == ("film_cameras:000001", "film_cameras:000002")
    assert reg.assign(["camerawiki:9", "wikidata:Q1"], "r2") == a

    path = tmp_path / "id_registry.csv"
    reg.save(path)
    again = Registry.load("film_cameras", path)
    assert again.assign(["camerawiki:9"], "r3") == a
    assert again.assign(["new:1"], "r3") == "film_cameras:000003"
    with pytest.raises(IdConflict):
        again.assign(["camerawiki:7", "wikidata:Q1"], "r3")


def test_llm_quotes_are_checked_against_the_article():
    from core.llm_extract import accept, clean_wikitext

    article = clean_wikitext(
        "{{Flickr_image\n|image= x.jpg\n}}\n"
        "The '''Zorki 4''' was made by [[KMZ]] from 1956 to 1973."
    )
    raw = {
        "covers_several_models": False,
        "manufacturer": {"value": "KMZ", "quote": "was made by KMZ"},
        "year_start": {"value": 1956, "quote": "from 1956 to 1973"},
        "country": {"value": "USSR", "quote": "made in the USSR"},
        "focus": None,
    }
    fields, dropped = accept(raw, article)
    assert set(fields) == {"covers_several_models", "manufacturer", "year_start"}
    assert dropped == ["country"]
    assert "Flickr" not in article


def test_llm_values_fill_only_gaps():
    c = cw.Converted("camera-wiki:1")
    c.status["year_start"] = "ok"
    rec, attrs, sources = {"year_start": 1956}, {}, {}
    llm = {
        "year_start": {"value": 1950, "quote": "q"},
        "year_end": {"value": 1973, "quote": "q"},
        "lens_mount": {"value": "39mm screw mount", "quote": "q"},
        "shutter_speeds": {
            "value": {"fastest": "1/1000s", "slowest": "1", "bulb": True},
            "quote": "q",
        },
        "metering": {"value": "selenium", "quote": "q"},
    }
    filled = cw.fill_from_llm(c, llm, rec, attrs, sources, "https://camera-wiki.org/x")
    assert rec == {"year_start": 1956, "year_end": 1973}
    assert attrs == {
        "lens_mount": "M39",
        "shutter_speeds": {"fastest": "1/1000", "slowest": "1", "bulb": True},
    }
    assert filled == {"year_end", "attributes.lens_mount", "attributes.shutter_speeds"}
    assert c.status["year_end"] == "llm" and c.status["metering"] == "missing"


def test_llm_decade_is_not_a_year():
    from core.llm_extract import accept

    article = "The camera was made in the 1950s, and the 1955 model followed."
    fields, dropped = accept(
        {
            "year_start": {"value": 1950, "quote": "made in the 1950s"},
            "year_end": {"value": 1955, "quote": "the 1955 model"},
        },
        article,
    )
    assert "year_start" not in fields and dropped == ["year_start"]
    assert fields["year_end"]["value"] == 1955


def test_llm_whole_second_speed_must_be_in_quote():
    from core.llm_extract import accept

    article = "Speeds of 1/5 to 1/400th sec. plus bulb. Another runs from 1 second to 1/500."
    bad = {"value": {"fastest": "1/400", "slowest": "1", "bulb": True}, "quote": "1/5 to 1/400th"}
    good = {
        "value": {"fastest": "1/500", "slowest": "1", "bulb": False},
        "quote": "1 second to 1/500",
    }
    assert accept({"shutter_speeds": bad}, article)[1] == ["shutter_speeds"]
    assert "shutter_speeds" in accept({"shutter_speeds": good}, article)[0]


def test_user_edits_replay_over_records():
    from core import user_edits

    records = [
        {"id": "film_cameras:000006", "maker": "Zenit", "name": "E", "aliases": ["Zenit-E"],
         "attributes": {}, "field_sources": {}, "source_urls": [], "attribution": []},
        {"id": "film_cameras:000007", "maker": "Zenit", "name": "E2", "attributes": {}},
    ]  # fmt: skip
    edits = [
        {
            "id": "e1",
            "kind": "edit",
            "catalog_id": "film_cameras:000006",
            "source": "https://x.org/a",
            "note": "KMZ + BelOMO",
            "changes": {
                "production_count": {"value": 3334000, "basis": "stated"},
                "aliases": "Zenith-E",
                "attributes.power": "None (mechanical)",
            },
        },
        {
            "id": "e2",
            "kind": "new_model",
            "catalog_id": None,
            "result_catalog_id": "film_cameras:009999",
            "source": "my own copy",
            "note": None,
            "changes": {"maker": "Lomography", "name": "X"},
        },
        {
            "id": "e3",
            "kind": "merge",
            "catalog_id": "film_cameras:000007",
            "source": "dup",
            "note": None,
            "changes": {"into": "film_cameras:000006"},
        },
        {
            "id": "e4",
            "kind": "edit",
            "catalog_id": "film_cameras:000404",
            "source": "s",
            "note": None,
            "changes": {"country": "USSR"},
        },
    ]
    counts = user_edits.apply(records, edits, "film_cameras")
    assert counts == {"edit": 1, "new_model": 1, "merge": 1, "missing": 1}
    z = records[0]
    assert z["production_count"]["source"] == {"url": "https://x.org/a", "quote": "KMZ + BelOMO"}
    assert (
        z["aliases"] == ["Zenit-E", "Zenith-E"] and z["attributes"]["power"] == "None (mechanical)"
    )
    assert z["field_sources"]["production_count"] == "user_edit:e1"
    assert records[1]["status"] == "merged" and records[1]["merged_into"] == "film_cameras:000006"
    new = records[2]
    assert new["id"] == "film_cameras:009999" and new["labels"] == {"en": "Lomography X"}
    assert new["data_license"] == "CC BY-SA 4.0"
