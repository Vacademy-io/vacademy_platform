"""
Helpers for turning stored media URLs back into S3 object keys, tolerant of
every host shape the platform has ever emitted.

Historically code split URLs on the literal f"{bucket}.s3.amazonaws.com/",
which breaks the moment a URL uses the regional host, the accelerate host, or
a CloudFront distribution in front of the bucket. Rows written before and
after the CDN cutover must both keep working, so all key extraction should go
through extract_s3_key().
"""
from __future__ import annotations

import re
from typing import Optional


def extract_s3_key(url: str, bucket: str, cdn_base_url: Optional[str] = None) -> Optional[str]:
    """Extract the object key from a media URL, or return None if the URL
    doesn't reference the given bucket (or CDN).

    Accepted shapes:
    - https://{bucket}.s3.amazonaws.com/{key}
    - https://{bucket}.s3.<region>.amazonaws.com/{key}
    - https://{bucket}.s3-accelerate.amazonaws.com/{key}
    - https://s3.amazonaws.com/{bucket}/{key} and regional path-style
    - {cdn_base_url}/{key} when cdn_base_url is provided
    """
    if not url or not bucket:
        return None

    if cdn_base_url:
        base = cdn_base_url.rstrip("/") + "/"
        if url.startswith(base):
            return url[len(base):] or None

    escaped = re.escape(bucket)
    # Virtual-hosted style: {bucket}.s3[.region|-accelerate].amazonaws.com/key
    m = re.match(rf"^https?://{escaped}\.s3[.\-][a-z0-9.\-]*?amazonaws\.com/(.+)$", url)
    # Path style: s3[.region].amazonaws.com/{bucket}/key
    if not m:
        m = re.match(rf"^https?://s3[.\-]?[a-z0-9.\-]*?amazonaws\.com/{escaped}/(.+)$", url)
    return m.group(1) if m else None


def public_base_url(bucket: str, cdn_base_url: Optional[str] = None) -> str:
    """Base URL new media URLs should be emitted under: the CDN when
    configured, the raw S3 host otherwise."""
    if cdn_base_url:
        return cdn_base_url.rstrip("/")
    return f"https://{bucket}.s3.amazonaws.com"
