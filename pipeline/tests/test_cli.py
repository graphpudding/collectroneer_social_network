from core.cli import main
from core.config import list_categories, load_category


def test_film_cameras_config_loads():
    config = load_category("film_cameras")
    assert config.category == "film_cameras"
    assert config.dir.name == "film_cameras"
    assert "film_cameras" in list_categories()


def test_unknown_category_fails(capsys):
    assert main(["run", "--category", "no_such_category"]) == 1
    assert "no config" in capsys.readouterr().err


def test_unimplemented_stage_fails_cleanly(capsys):
    assert main(["run", "--category", "film_cameras", "--stage", "recon"]) == 1
    assert "not implemented" in capsys.readouterr().err
