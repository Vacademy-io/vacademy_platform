"""
SQLite writer for video_spatial.sqlite — per-frame data for the renderer.

The renderer queries this DB by timestamp to get pixel-exact face positions,
OCR regions, cursor coordinates, etc. Alpha mattes are in the WebM files,
not stored here.
"""
from __future__ import annotations

import sqlite3
from pathlib import Path
from typing import Any


def create_spatial_db(path: Path) -> sqlite3.Connection:
    """Create the SQLite file with all tables. Returns an open connection."""
    conn = sqlite3.connect(str(path))
    conn.execute("PRAGMA journal_mode=WAL")
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS frames (
            frame_num INTEGER PRIMARY KEY,
            t         REAL NOT NULL,
            face_x    REAL, face_y  REAL,
            face_w    REAL, face_h  REAL,
            head_yaw  REAL, head_pitch REAL,
            gesture   TEXT,
            rms       REAL,
            pitch     REAL
        );

        CREATE TABLE IF NOT EXISTS ocr_events (
            id        INTEGER PRIMARY KEY AUTOINCREMENT,
            frame_num INTEGER NOT NULL,
            text      TEXT,
            bbox_x    REAL, bbox_y REAL,
            bbox_w    REAL, bbox_h REAL,
            confidence REAL
        );

        CREATE TABLE IF NOT EXISTS cursor_track (
            frame_num INTEGER PRIMARY KEY,
            x         REAL NOT NULL,
            y         REAL NOT NULL,
            cursor_type TEXT
        );

        CREATE TABLE IF NOT EXISTS change_events (
            id        INTEGER PRIMARY KEY AUTOINCREMENT,
            frame_num INTEGER NOT NULL,
            region_x  REAL, region_y REAL,
            region_w  REAL, region_h REAL,
            event_type TEXT
        );

        CREATE TABLE IF NOT EXISTS dynamic_crops (
            id        INTEGER PRIMARY KEY AUTOINCREMENT,
            t_start   REAL NOT NULL,
            t_end     REAL NOT NULL,
            crop_x    REAL, crop_y REAL,
            crop_w    REAL, crop_h REAL,
            follows   TEXT
        );

        CREATE TABLE IF NOT EXISTS ui_cutouts (
            id        TEXT PRIMARY KEY,
            asset_path TEXT,
            t_start   REAL,
            t_end     REAL,
            bbox_x    REAL, bbox_y REAL,
            bbox_w    REAL, bbox_h REAL,
            label     TEXT
        );
    """)
    return conn


def write_frame_rows(conn: sqlite3.Connection, rows: list[dict[str, Any]]) -> None:
    """Batch insert into frames table."""
    if not rows:
        return
    conn.executemany(
        """INSERT OR REPLACE INTO frames
           (frame_num, t, face_x, face_y, face_w, face_h,
            head_yaw, head_pitch, gesture, rms, pitch)
           VALUES (:frame_num, :t, :face_x, :face_y, :face_w, :face_h,
                   :head_yaw, :head_pitch, :gesture, :rms, :pitch)""",
        rows,
    )
    conn.commit()


def write_ocr_rows(conn: sqlite3.Connection, rows: list[dict[str, Any]]) -> None:
    if not rows:
        return
    conn.executemany(
        """INSERT INTO ocr_events
           (frame_num, text, bbox_x, bbox_y, bbox_w, bbox_h, confidence)
           VALUES (:frame_num, :text, :bbox_x, :bbox_y, :bbox_w, :bbox_h, :confidence)""",
        rows,
    )
    conn.commit()


def write_cursor_rows(conn: sqlite3.Connection, rows: list[dict[str, Any]]) -> None:
    if not rows:
        return
    conn.executemany(
        """INSERT OR REPLACE INTO cursor_track
           (frame_num, x, y, cursor_type)
           VALUES (:frame_num, :x, :y, :cursor_type)""",
        rows,
    )
    conn.commit()


def write_change_rows(conn: sqlite3.Connection, rows: list[dict[str, Any]]) -> None:
    if not rows:
        return
    conn.executemany(
        """INSERT INTO change_events
           (frame_num, region_x, region_y, region_w, region_h, event_type)
           VALUES (:frame_num, :region_x, :region_y, :region_w, :region_h, :event_type)""",
        rows,
    )
    conn.commit()


def write_dynamic_crops(conn: sqlite3.Connection, rows: list[dict[str, Any]]) -> None:
    if not rows:
        return
    conn.executemany(
        """INSERT INTO dynamic_crops
           (t_start, t_end, crop_x, crop_y, crop_w, crop_h, follows)
           VALUES (:t_start, :t_end, :crop_x, :crop_y, :crop_w, :crop_h, :follows)""",
        rows,
    )
    conn.commit()


def write_ui_cutouts(conn: sqlite3.Connection, rows: list[dict[str, Any]]) -> None:
    if not rows:
        return
    conn.executemany(
        """INSERT OR REPLACE INTO ui_cutouts
           (id, asset_path, t_start, t_end, bbox_x, bbox_y, bbox_w, bbox_h, label)
           VALUES (:id, :asset_path, :t_start, :t_end,
                   :bbox_x, :bbox_y, :bbox_w, :bbox_h, :label)""",
        rows,
    )
    conn.commit()
