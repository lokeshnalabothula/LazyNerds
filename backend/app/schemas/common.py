from datetime import datetime, timezone
from typing import Optional


def serialize_utc_datetime(dt: Optional[datetime]) -> Optional[str]:
    """
    Ensures any datetime serialized across API endpoints is formatted as
    a canonical ISO-8601 string in UTC with an explicit 'Z' terminator,
    e.g. '2026-10-17T14:30:00Z'.
    """
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    else:
        dt = dt.astimezone(timezone.utc)
    iso = dt.isoformat()
    if iso.endswith("+00:00"):
        return iso[:-6] + "Z"
    return iso
