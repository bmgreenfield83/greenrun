from app.core.config import REPOSITORY_ROOT, ROOT_ENV_FILE, Settings


def test_root_env_path_is_independent_of_working_directory(monkeypatch) -> None:
    monkeypatch.chdir(REPOSITORY_ROOT / "docs")

    settings = Settings()  # type: ignore[call-arg]

    assert ROOT_ENV_FILE == REPOSITORY_ROOT / ".env"
    assert ROOT_ENV_FILE.is_absolute()
    assert settings.mongodb_database


def test_secret_is_masked_in_settings_representation() -> None:
    settings = Settings()  # type: ignore[call-arg]

    assert settings.mongodb_uri.get_secret_value() not in repr(settings)


def test_cors_origins_support_local_and_explicit_network_addresses() -> None:
    settings = Settings(
        mongodb_uri="mongodb://example.invalid",
        frontend_origins=("http://localhost:5174, http://127.0.0.1:5174, http://100.64.0.10:5174/"),
    )

    assert settings.cors_origins == [
        "http://localhost:5174",
        "http://127.0.0.1:5174",
        "http://100.64.0.10:5174",
    ]
