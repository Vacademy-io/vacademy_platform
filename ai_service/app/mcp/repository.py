"""
Persistence for the MCP OAuth store.

Plain ``text()`` SQL against the shared admin_core DB, in the style of the other
ai_service repositories. Every method takes an explicit Session so the caller
owns the transaction boundary.

Invariants this layer enforces:
  * issued tokens and auth codes are persisted as SHA-256 hashes / opaque ids,
    never in clear;
  * platform credentials are written only through ``TokenCipher``;
  * codes and refresh tokens are single-use — consumption is an UPDATE guarded
    by ``used_at IS NULL`` / ``revoked_at IS NULL`` so a replay loses the race.
"""
from __future__ import annotations

import json
import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from sqlalchemy import text
from sqlalchemy.orm import Session

from .constants import AUTO_CLIENT_ID_PREFIX
from .crypto import TokenCipher, hash_token

logger = logging.getLogger(__name__)


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _dumps(value: Any) -> Optional[str]:
    if value is None:
        return None
    return json.dumps(value)


def _loads(value: Optional[str], default: Any) -> Any:
    if not value:
        return default
    try:
        return json.loads(value)
    except (ValueError, TypeError):
        return default


class McpOAuthRepository:
    """CRUD for clients, pending authorizations, codes, tokens and the audit log."""

    def __init__(self, db: Session, cipher: TokenCipher):
        self.db = db
        self.cipher = cipher

    # ── clients ──────────────────────────────────────────────────────────
    def get_client(self, client_id: str) -> Optional[Dict[str, Any]]:
        row = self.db.execute(
            text(
                "SELECT client_id, client_secret_hash, client_name, redirect_uris, "
                "grant_types, scope, client_metadata, institute_id, source, "
                "client_secret_expires_at "
                "FROM mcp_oauth_client WHERE client_id = :cid"
            ),
            {"cid": client_id},
        ).mappings().first()
        if not row:
            return None
        return {
            "client_id": row["client_id"],
            "client_secret_hash": row["client_secret_hash"],
            "client_name": row["client_name"],
            "redirect_uris": _loads(row["redirect_uris"], []),
            "grant_types": _loads(row["grant_types"], []),
            "scope": row["scope"],
            "client_metadata": _loads(row["client_metadata"], {}),
            "institute_id": row["institute_id"],
            "source": row["source"],
            "client_secret_expires_at": row["client_secret_expires_at"],
        }

    def save_client(
        self,
        *,
        client_id: str,
        client_name: Optional[str],
        redirect_uris: List[str],
        grant_types: Optional[List[str]] = None,
        scope: Optional[str] = None,
        client_metadata: Optional[Dict[str, Any]] = None,
        client_secret_hash: Optional[str] = None,
        institute_id: Optional[str] = None,
        created_by: Optional[str] = None,
        source: str = "dcr",
    ) -> None:
        self.db.execute(
            text(
                "INSERT INTO mcp_oauth_client "
                "(client_id, client_secret_hash, client_name, redirect_uris, grant_types, "
                " scope, client_metadata, institute_id, created_by, source) "
                "VALUES (:cid, :secret, :name, :uris, :grants, :scope, :meta, :inst, :by, :src) "
                "ON CONFLICT (client_id) DO UPDATE SET "
                "  client_name = EXCLUDED.client_name, "
                "  redirect_uris = EXCLUDED.redirect_uris, "
                "  grant_types = EXCLUDED.grant_types, "
                "  scope = EXCLUDED.scope, "
                "  client_metadata = EXCLUDED.client_metadata"
            ),
            {
                "cid": client_id,
                "secret": client_secret_hash,
                "name": client_name,
                "uris": _dumps(redirect_uris),
                "grants": _dumps(grant_types or []),
                "scope": scope,
                "meta": _dumps(client_metadata or {}),
                "inst": institute_id,
                "by": created_by,
                "src": source,
            },
        )
        self.db.commit()

    def list_manual_clients(self, institute_id: str) -> List[Dict[str, Any]]:
        rows = self.db.execute(
            text(
                "SELECT client_id, client_name, redirect_uris, created_at "
                "FROM mcp_oauth_client "
                "WHERE institute_id = :inst AND source = 'manual' "
                "ORDER BY created_at DESC"
            ),
            {"inst": institute_id},
        ).mappings().all()
        return [
            {
                "client_id": r["client_id"],
                "client_name": r["client_name"],
                "redirect_uris": _loads(r["redirect_uris"], []),
                "created_at": r["created_at"].isoformat() if r["created_at"] else None,
            }
            for r in rows
        ]

    def delete_manual_client(self, institute_id: str, client_id: str) -> bool:
        result = self.db.execute(
            text(
                "DELETE FROM mcp_oauth_client "
                "WHERE client_id = :cid AND institute_id = :inst AND source = 'manual' "
                # The auto-provisioned primary client is never deletable, even if
                # a caller gets past the endpoint-level check.
                "AND client_id NOT LIKE :auto_prefix"
            ),
            {"cid": client_id, "inst": institute_id, "auto_prefix": f"{AUTO_CLIENT_ID_PREFIX}%"},
        )
        self.db.commit()
        return (result.rowcount or 0) > 0

    # ── pending authorizations ───────────────────────────────────────────
    def create_txn(
        self,
        *,
        client_id: str,
        redirect_uri: str,
        redirect_uri_provided: bool,
        code_challenge: Optional[str],
        state: Optional[str],
        scopes: List[str],
        resource: Optional[str],
        ttl_seconds: int,
    ) -> str:
        txn = uuid.uuid4().hex
        self.db.execute(
            text(
                "INSERT INTO mcp_oauth_txn "
                "(txn, client_id, redirect_uri, redirect_uri_provided, code_challenge, "
                " state, scopes, resource, expires_at) "
                "VALUES (:txn, :cid, :uri, :provided, :chal, :state, :scopes, :res, :exp)"
            ),
            {
                "txn": txn,
                "cid": client_id,
                "uri": redirect_uri,
                "provided": redirect_uri_provided,
                "chal": code_challenge,
                "state": state,
                "scopes": _dumps(scopes),
                "res": resource,
                "exp": _now() + timedelta(seconds=ttl_seconds),
            },
        )
        self.db.commit()
        return txn

    def get_txn(self, txn: str) -> Optional[Dict[str, Any]]:
        row = self.db.execute(
            text(
                "SELECT txn, client_id, redirect_uri, redirect_uri_provided, code_challenge, "
                "state, scopes, resource, expires_at, consumed_at "
                "FROM mcp_oauth_txn WHERE txn = :txn"
            ),
            {"txn": txn},
        ).mappings().first()
        if not row:
            return None
        return {
            "txn": row["txn"],
            "client_id": row["client_id"],
            "redirect_uri": row["redirect_uri"],
            "redirect_uri_provided": row["redirect_uri_provided"],
            "code_challenge": row["code_challenge"],
            "state": row["state"],
            "scopes": _loads(row["scopes"], []),
            "resource": row["resource"],
            "expires_at": row["expires_at"],
            "consumed_at": row["consumed_at"],
        }

    def consume_txn(self, txn: str) -> bool:
        """Mark a pending authorization used. False if already consumed/expired."""
        result = self.db.execute(
            text(
                "UPDATE mcp_oauth_txn SET consumed_at = :now "
                "WHERE txn = :txn AND consumed_at IS NULL AND expires_at > :now"
            ),
            {"txn": txn, "now": _now()},
        )
        self.db.commit()
        return (result.rowcount or 0) > 0

    # ── authorization codes ──────────────────────────────────────────────
    def create_code(
        self,
        *,
        code: str,
        client_id: str,
        user_id: str,
        institute_id: str,
        username: Optional[str],
        redirect_uri: str,
        code_challenge: Optional[str],
        scopes: List[str],
        resource: Optional[str],
        platform_access_token: Optional[str],
        platform_refresh_token: Optional[str],
        ttl_seconds: int,
    ) -> None:
        self.db.execute(
            text(
                "INSERT INTO mcp_oauth_code "
                "(code, client_id, user_id, institute_id, username, redirect_uri, "
                " code_challenge, scopes, resource, platform_access_enc, "
                " platform_refresh_enc, expires_at) "
                "VALUES (:code, :cid, :uid, :inst, :uname, :uri, :chal, :scopes, :res, "
                "        :acc, :ref, :exp)"
            ),
            {
                "code": hash_token(code),
                "cid": client_id,
                "uid": user_id,
                "inst": institute_id,
                "uname": username,
                "uri": redirect_uri,
                "chal": code_challenge,
                "scopes": _dumps(scopes),
                "res": resource,
                "acc": self.cipher.encrypt(platform_access_token),
                "ref": self.cipher.encrypt(platform_refresh_token),
                "exp": _now() + timedelta(seconds=ttl_seconds),
            },
        )
        self.db.commit()

    def get_code(self, code: str) -> Optional[Dict[str, Any]]:
        row = self.db.execute(
            text(
                "SELECT code, client_id, user_id, institute_id, username, redirect_uri, "
                "code_challenge, scopes, resource, platform_access_enc, "
                "platform_refresh_enc, expires_at, used_at "
                "FROM mcp_oauth_code WHERE code = :code"
            ),
            {"code": hash_token(code)},
        ).mappings().first()
        if not row:
            return None
        return {
            "client_id": row["client_id"],
            "user_id": row["user_id"],
            "institute_id": row["institute_id"],
            "username": row["username"],
            "redirect_uri": row["redirect_uri"],
            "code_challenge": row["code_challenge"],
            "scopes": _loads(row["scopes"], []),
            "resource": row["resource"],
            "platform_access_token": self.cipher.decrypt(row["platform_access_enc"]),
            "platform_refresh_token": self.cipher.decrypt(row["platform_refresh_enc"]),
            "expires_at": row["expires_at"],
            "used_at": row["used_at"],
        }

    def consume_code(self, code: str) -> bool:
        """Single-use redemption. False when already redeemed or expired."""
        result = self.db.execute(
            text(
                "UPDATE mcp_oauth_code SET used_at = :now "
                "WHERE code = :code AND used_at IS NULL AND expires_at > :now"
            ),
            {"code": hash_token(code), "now": _now()},
        )
        self.db.commit()
        return (result.rowcount or 0) > 0

    # ── tokens ───────────────────────────────────────────────────────────
    def store_token(
        self,
        *,
        token: str,
        kind: str,
        pair_id: str,
        client_id: str,
        user_id: str,
        institute_id: str,
        username: Optional[str],
        scopes: List[str],
        resource: Optional[str],
        platform_access_token: Optional[str],
        platform_refresh_token: Optional[str],
        ttl_seconds: int,
    ) -> None:
        self.db.execute(
            text(
                "INSERT INTO mcp_oauth_token "
                "(token_hash, kind, pair_id, client_id, user_id, institute_id, username, "
                " scopes, resource, platform_access_enc, platform_refresh_enc, expires_at) "
                "VALUES (:hash, :kind, :pair, :cid, :uid, :inst, :uname, :scopes, :res, "
                "        :acc, :ref, :exp)"
            ),
            {
                "hash": hash_token(token),
                "kind": kind,
                "pair": pair_id,
                "cid": client_id,
                "uid": user_id,
                "inst": institute_id,
                "uname": username,
                "scopes": _dumps(scopes),
                "res": resource,
                "acc": self.cipher.encrypt(platform_access_token),
                "ref": self.cipher.encrypt(platform_refresh_token),
                "exp": _now() + timedelta(seconds=ttl_seconds),
            },
        )
        self.db.commit()

    def get_token(self, token: str, kind: str) -> Optional[Dict[str, Any]]:
        row = self.db.execute(
            text(
                "SELECT token_hash, kind, pair_id, client_id, user_id, institute_id, username, "
                "scopes, resource, platform_access_enc, platform_refresh_enc, expires_at, "
                "revoked_at "
                "FROM mcp_oauth_token WHERE token_hash = :hash AND kind = :kind"
            ),
            {"hash": hash_token(token), "kind": kind},
        ).mappings().first()
        if not row:
            return None
        return {
            "token_hash": row["token_hash"],
            "kind": row["kind"],
            "pair_id": row["pair_id"],
            "client_id": row["client_id"],
            "user_id": row["user_id"],
            "institute_id": row["institute_id"],
            "username": row["username"],
            "scopes": _loads(row["scopes"], []),
            "resource": row["resource"],
            "platform_access_token": self.cipher.decrypt(row["platform_access_enc"]),
            "platform_refresh_token": self.cipher.decrypt(row["platform_refresh_enc"]),
            "expires_at": row["expires_at"],
            "revoked_at": row["revoked_at"],
        }

    def touch_token(self, token_hash: str) -> None:
        """Best-effort last-used stamp; never fails a request."""
        try:
            self.db.execute(
                text("UPDATE mcp_oauth_token SET last_used_at = :now WHERE token_hash = :hash"),
                {"hash": token_hash, "now": _now()},
            )
            self.db.commit()
        except Exception as exc:  # noqa: BLE001
            self.db.rollback()
            logger.debug("touch_token failed: %s", exc)

    def update_platform_access_token(self, token_hash: str, platform_access_token: str) -> None:
        """Persist a platform JWT we just refreshed, so the next call reuses it."""
        self.db.execute(
            text("UPDATE mcp_oauth_token SET platform_access_enc = :acc WHERE token_hash = :hash"),
            {"hash": token_hash, "acc": self.cipher.encrypt(platform_access_token)},
        )
        self.db.commit()

    def revoke_pair(self, pair_id: str) -> None:
        """Revoke an access token and its sibling refresh token together."""
        self.db.execute(
            text(
                "UPDATE mcp_oauth_token SET revoked_at = :now "
                "WHERE pair_id = :pair AND revoked_at IS NULL"
            ),
            {"pair": pair_id, "now": _now()},
        )
        self.db.commit()

    def consume_refresh_token(self, token: str) -> bool:
        """Rotation: a refresh token may be redeemed exactly once."""
        result = self.db.execute(
            text(
                "UPDATE mcp_oauth_token SET revoked_at = :now "
                "WHERE token_hash = :hash AND kind = 'refresh' "
                "AND revoked_at IS NULL AND expires_at > :now"
            ),
            {"hash": hash_token(token), "now": _now()},
        )
        self.db.commit()
        return (result.rowcount or 0) > 0

    def list_connections(self, institute_id: str) -> List[Dict[str, Any]]:
        """Live access grants for an institute — powers the settings UI."""
        rows = self.db.execute(
            text(
                "SELECT t.pair_id, t.client_id, c.client_name, t.user_id, t.username, "
                "       MAX(t.created_at) AS created_at, MAX(t.last_used_at) AS last_used_at "
                "FROM mcp_oauth_token t "
                "LEFT JOIN mcp_oauth_client c ON c.client_id = t.client_id "
                "WHERE t.institute_id = :inst AND t.revoked_at IS NULL AND t.expires_at > :now "
                "GROUP BY t.pair_id, t.client_id, c.client_name, t.user_id, t.username "
                "ORDER BY MAX(t.created_at) DESC LIMIT 100"
            ),
            {"inst": institute_id, "now": _now()},
        ).mappings().all()
        return [
            {
                "pair_id": r["pair_id"],
                "client_id": r["client_id"],
                "client_name": r["client_name"],
                "user_id": r["user_id"],
                "username": r["username"],
                "created_at": r["created_at"].isoformat() if r["created_at"] else None,
                "last_used_at": r["last_used_at"].isoformat() if r["last_used_at"] else None,
            }
            for r in rows
        ]

    def revoke_connection(self, institute_id: str, pair_id: str) -> bool:
        """Institute-scoped revoke, so one admin cannot kill another's grant."""
        result = self.db.execute(
            text(
                "UPDATE mcp_oauth_token SET revoked_at = :now "
                "WHERE pair_id = :pair AND institute_id = :inst AND revoked_at IS NULL"
            ),
            {"pair": pair_id, "inst": institute_id, "now": _now()},
        )
        self.db.commit()
        return (result.rowcount or 0) > 0

    # ── audit ────────────────────────────────────────────────────────────
    def log_tool_call(
        self,
        *,
        user_id: str,
        institute_id: str,
        client_id: Optional[str],
        client_name: Optional[str],
        tool_name: str,
        args: Optional[Dict[str, Any]],
        ok: bool,
        error_code: Optional[str],
        duration_ms: int,
    ) -> None:
        """Audit a tool call. Never raises — auditing must not fail the call."""
        try:
            self.db.execute(
                text(
                    "INSERT INTO mcp_tool_call_log "
                    "(id, user_id, institute_id, client_id, client_name, tool_name, "
                    " args_json, ok, error_code, duration_ms) "
                    "VALUES (:id, :uid, :inst, :cid, :cname, :tool, :args, :ok, :err, :ms)"
                ),
                {
                    "id": uuid.uuid4().hex,
                    "uid": user_id,
                    "inst": institute_id,
                    "cid": client_id,
                    "cname": client_name,
                    "tool": tool_name,
                    "args": _dumps(args or {}),
                    "ok": ok,
                    "err": error_code,
                    "ms": duration_ms,
                },
            )
            self.db.commit()
        except Exception as exc:  # noqa: BLE001
            self.db.rollback()
            logger.warning("mcp_tool_call_log insert failed: %s", exc)


__all__ = ["McpOAuthRepository"]
