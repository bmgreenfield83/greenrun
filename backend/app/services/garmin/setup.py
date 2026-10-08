"""One-time Garmin Connect sign-in, run in a terminal so it can ask for an MFA code.

    python -m app.services.garmin.setup            # sign in and save tokens (reuses valid tokens)
    python -m app.services.garmin.setup --force    # discard saved tokens and sign in again

Credentials come from GARMIN_EMAIL and GARMIN_PASSWORD; tokens are saved to GARMIN_TOKEN_DIR so the
API can sync without ever needing the password or an MFA code. See docs/garmin-sync.md.
"""

import argparse
import sys
from pathlib import Path

from app.core.config import get_settings


def main(argv: list[str] | None = None) -> int:
    arguments = argparse.ArgumentParser(description="Sign in to Garmin Connect for Greenrun.")
    arguments.add_argument(
        "--force", action="store_true", help="discard saved tokens and sign in again"
    )
    options = arguments.parse_args(argv)

    settings = get_settings()
    if not settings.garmin_configured:
        print("Set GARMIN_EMAIL and GARMIN_PASSWORD in the environment first.", file=sys.stderr)
        return 1
    token_dir = settings.garmin_token_dir

    from garminconnect import Garmin, GarminConnectAuthenticationError

    if options.force:
        token_file = Path(token_dir).expanduser() / "garmin_tokens.json"
        token_file.unlink(missing_ok=True)

    api = Garmin(
        settings.garmin_email.strip(),
        settings.garmin_password.get_secret_value(),
        prompt_mfa=lambda: input("Garmin MFA code: ").strip(),
    )
    try:
        api.login(token_dir)
    except GarminConnectAuthenticationError as error:
        print(f"Garmin sign-in failed: {error}", file=sys.stderr)
        return 1
    except Exception as error:  # network trouble, rate limits, Garmin changes
        print(f"Garmin sign-in failed ({type(error).__name__}): {error}", file=sys.stderr)
        return 1
    name = api.get_full_name() or settings.garmin_email.strip()
    print(f"Signed in to Garmin Connect as {name}. Tokens are saved in {token_dir}.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
