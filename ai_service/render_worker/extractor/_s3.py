"""
Shared S3 helper for the indexing pipelines (video + image).

Lifted out of pipeline.py so image_pipeline.py can reuse the same
download/upload logic without duplicating it.
"""
from __future__ import annotations

import os
from pathlib import Path
from urllib.request import Request, urlopen

import boto3
from botocore.exceptions import ClientError


class S3Helper:
    """Minimal S3 helper used by the indexing pipelines.

    Handles download from either S3 (with explicit boto3 calls when the URL
    points at a known bucket) or any HTTP URL as fallback. Uploads always go
    to AWS_S3_PUBLIC_BUCKET so the FE can serve the artifacts directly.
    """

    def __init__(self):
        self._s3 = boto3.client(
            "s3",
            aws_access_key_id=os.environ.get("AWS_ACCESS_KEY_ID") or None,
            aws_secret_access_key=os.environ.get("AWS_SECRET_ACCESS_KEY") or None,
            region_name=os.environ.get("AWS_REGION", "ap-south-1"),
        )
        self.bucket = os.environ.get("AWS_S3_PUBLIC_BUCKET", "vacademy-media-storage-public")

    def download(self, url: str, local_path: Path) -> None:
        local_path.parent.mkdir(parents=True, exist_ok=True)
        if self.bucket and self.bucket in url:
            try:
                parts = url.split(f"{self.bucket}.s3.amazonaws.com/")
                if len(parts) == 2:
                    self._s3.download_file(self.bucket, parts[1], str(local_path))
                    return
            except (ClientError, Exception):
                pass
        try:
            for bucket_name in ["vacademy-media-storage", self.bucket]:
                if bucket_name in url:
                    try:
                        parts = url.split(f"{bucket_name}.s3.amazonaws.com/")
                        if len(parts) == 2:
                            self._s3.download_file(bucket_name, parts[1], str(local_path))
                            return
                    except Exception:
                        continue
            req = Request(url, headers={"User-Agent": "VacademyIndexer/1.0"})
            with urlopen(req, timeout=300) as resp:
                local_path.write_bytes(resp.read())
        except Exception as e:
            raise RuntimeError(f"Failed to download {url}: {e}")

    def upload(
        self,
        local_path: Path,
        s3_key: str,
        content_type: str = "application/octet-stream",
    ) -> str:
        self._s3.upload_file(
            str(local_path), self.bucket, s3_key,
            ExtraArgs={"ContentType": content_type},
        )
        return f"https://{self.bucket}.s3.amazonaws.com/{s3_key}"
