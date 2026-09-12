"""Who may manage teaching plans (compile, read answer keys, spend credits).

One constant for both tutor routers. Platform role names carry spaces
("CONTENT CREATOR", "COURSE CREATOR"); the JWT may carry either form, so
names are normalised before comparison.
"""
from __future__ import annotations

from typing import Iterable, Set

STAFF_ROLES: Set[str] = {
    "ADMIN", "ADMIN_NON_ROOT", "SUPER_ADMIN", "TEACHER",
    "CONTENT_CREATOR", "COURSE_CREATOR",
}


def normalize_roles(roles: Iterable[str] | None) -> Set[str]:
    return {str(r).strip().upper().replace(" ", "_").replace("-", "_") for r in (roles or []) if r}


def is_staff(roles: Iterable[str] | None, *, is_root: bool = False) -> bool:
    return bool(is_root) or bool(normalize_roles(roles) & STAFF_ROLES)


__all__ = ["STAFF_ROLES", "normalize_roles", "is_staff"]
