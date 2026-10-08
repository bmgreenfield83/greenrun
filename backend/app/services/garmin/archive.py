"""Pull the FIT file out of a Garmin "original" download, entirely in memory."""

import zipfile
from io import BytesIO
from pathlib import PurePosixPath

from app.services.garmin.errors import GarminArchiveError

# A FIT file carries ".FIT" at bytes 8-11 of its header.
_FIT_SIGNATURE = b".FIT"


def is_fit(content: bytes) -> bool:
    return len(content) >= 12 and content[8:12] == _FIT_SIGNATURE


def extract_fit(content: bytes, *, fallback_name: str, max_bytes: int) -> tuple[bytes, str]:
    """Return the FIT bytes and a filename from a ZIP archive (or a bare FIT file)."""
    if is_fit(content):
        if len(content) > max_bytes:
            raise GarminArchiveError("The Garmin activity exceeds the configured FIT size limit.")
        return content, fallback_name
    try:
        archive = zipfile.ZipFile(BytesIO(content))
    except zipfile.BadZipFile as error:
        raise GarminArchiveError(
            "Garmin returned a download that is neither a ZIP archive nor a FIT file."
        ) from error
    with archive:
        members = [
            member
            for member in archive.infolist()
            if not member.is_dir() and member.filename.lower().endswith(".fit")
        ]
        if not members:
            raise GarminArchiveError("The Garmin download did not contain a FIT file.")
        member = max(members, key=lambda item: item.file_size)
        if member.file_size > max_bytes:
            raise GarminArchiveError("The Garmin activity exceeds the configured FIT size limit.")
        try:
            with archive.open(member) as handle:
                # Read one byte past the limit to catch an archive that understates its size.
                data = handle.read(max_bytes + 1)
        except (zipfile.BadZipFile, OSError, RuntimeError) as error:
            raise GarminArchiveError("The FIT file in the Garmin download is damaged.") from error
    if len(data) > max_bytes:
        raise GarminArchiveError("The Garmin activity exceeds the configured FIT size limit.")
    if not is_fit(data):
        raise GarminArchiveError("The file in the Garmin download is not a valid FIT file.")
    return data, PurePosixPath(member.filename).name or fallback_name
