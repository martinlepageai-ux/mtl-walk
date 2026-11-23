#!/usr/bin/env python3
"""Local, dependency-free backend for Bernardo's website.

Use only on localhost for development. For an internet-facing deployment, place
the app behind HTTPS and set BERNARDO_SECURE_COOKIES=1.
"""
from __future__ import annotations

import hashlib
import hmac
import json
import mimetypes
import os
import re
import secrets
import sqlite3
import sys
import threading
import time
import unicodedata
from datetime import datetime, timedelta, timezone
from http import HTTPStatus
from http.cookies import SimpleCookie
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlsplit
from getpass import getpass


OUTPUT_DIR = Path(__file__).resolve().parents[1]
DATA_DIR = Path(__file__).resolve().parent / "data"
DB_PATH = Path(os.environ.get("BERNARDO_DB", str(DATA_DIR / "bernardo.sqlite3")))
HOST = os.environ.get("BERNARDO_BIND", "127.0.0.1")
PORT = int(os.environ.get("BERNARDO_PORT", "8787"))
SESSION_HOURS = 12
PASSWORD_ITERATIONS = 600_000
MAX_BODY_BYTES = 1_000_000
COOKIE_SECURE = os.environ.get("BERNARDO_SECURE_COOKIES", "0") == "1"
LOGIN_ATTEMPTS = {}
LOGIN_LOCK = threading.Lock()

STATIC_FILES = {
    "/": "index.html",
    "/index.html": "index.html",
    "/assets/bernardo.jpg": "assets/bernardo.jpg",
    "/assets/bernardo-portrait.png": "assets/bernardo-portrait.png",
    "/assets/branding/montréal-double-entente-mark.png": "assets/branding/montréal-double-entente-mark.png",
    "/place-darmes.html": "place-darmes.html",
    "/solitudes.html": "solitudes.html",
    "/routes.html": "routes.html",
    "/site.js": "site.js",
    "/solitudes.js": "solitudes.js",
    "/routes.js": "routes.js",
    "/site-type.css": "site-type.css",
    "/assets/walking/palais-street.jpg": "assets/walking/palais-street.jpg",
    "/assets/walking/palais-street-960.jpg": "assets/walking/palais-street-960.jpg",
    "/assets/walking/square-fountain.jpg": "assets/walking/square-fountain.jpg",
    "/assets/walking/palais-light.jpg": "assets/walking/palais-light.jpg",
    "/assets/walking/green-lane-walk.jpg": "assets/walking/green-lane-walk.jpg",
    "/assets/walking/brick-detail.jpg": "assets/walking/brick-detail.jpg",
    "/article.js": "article.js",
    "/admin": "admin.html",
    "/admin.html": "admin.html",
    "/admin.js": "admin.js",
    "/blog": "blog.html",
    "/blog.html": "blog.html",
    "/blog.js": "blog.js",
    "/post": "post.html",
    "/post.html": "post.html",
    "/post.js": "post.js",
}


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def utc_text(value: datetime | None = None) -> str:
    value = value or utc_now()
    return value.astimezone(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def db_connect() -> sqlite3.Connection:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH, timeout=10)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys=ON")
    conn.execute("PRAGMA journal_mode=WAL")
    return conn


def init_db() -> None:
    with db_connect() as conn:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS admins (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                username TEXT NOT NULL UNIQUE,
                salt BLOB NOT NULL,
                password_hash BLOB NOT NULL,
                created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS sessions (
                token_hash TEXT PRIMARY KEY,
                csrf_token TEXT NOT NULL,
                expires_at TEXT NOT NULL,
                created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS posts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                slug TEXT NOT NULL UNIQUE,
                title TEXT NOT NULL,
                language TEXT NOT NULL CHECK (language IN ('es','fr','en')),
                summary TEXT NOT NULL DEFAULT '',
                body TEXT NOT NULL,
                status TEXT NOT NULL CHECK (status IN ('draft','published')),
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                published_at TEXT
            );
            CREATE TABLE IF NOT EXISTS tour_lessons (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                tour_date TEXT NOT NULL DEFAULT '',
                tour_name TEXT NOT NULL DEFAULT '',
                category TEXT NOT NULL DEFAULT 'other',
                situation TEXT NOT NULL,
                learning TEXT NOT NULL,
                next_action TEXT NOT NULL DEFAULT '',
                tags TEXT NOT NULL DEFAULT '',
                status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved')),
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS calendar_connections (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                provider TEXT NOT NULL,
                account_label TEXT NOT NULL DEFAULT '',
                external_calendar_id TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'connected',
                last_synced_at TEXT,
                UNIQUE(provider, external_calendar_id)
            );
            CREATE TABLE IF NOT EXISTS calendar_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                connection_id INTEGER NOT NULL REFERENCES calendar_connections(id) ON DELETE CASCADE,
                external_id TEXT NOT NULL,
                calendar_uid TEXT NOT NULL DEFAULT '',
                title TEXT NOT NULL,
                starts_at TEXT NOT NULL,
                ends_at TEXT NOT NULL,
                location TEXT NOT NULL DEFAULT '',
                all_day INTEGER NOT NULL DEFAULT 0,
                updated_at TEXT NOT NULL,
                UNIQUE(connection_id, external_id)
            );
            CREATE INDEX IF NOT EXISTS posts_status_updated ON posts(status, updated_at DESC);
            CREATE INDEX IF NOT EXISTS lessons_status_date ON tour_lessons(status, tour_date DESC);
            CREATE INDEX IF NOT EXISTS calendar_events_time ON calendar_events(starts_at, ends_at);
        """)
        conn.execute("DELETE FROM sessions WHERE expires_at <= ?", (utc_text(),))


def password_digest(password: str, salt: bytes) -> bytes:
    return hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, PASSWORD_ITERATIONS)


def set_admin() -> None:
    init_db()
    username = input("Bernardo's login name: ").strip().lower()
    if not re.fullmatch(r"[a-z0-9._-]{3,48}", username):
        raise SystemExit("Use 3–48 letters, numbers, dots, underscores or hyphens.")
    password = getpass("Choose a password (at least 14 characters): ")
    confirm = getpass("Type it again: ")
    if password != confirm:
        raise SystemExit("Passwords do not match.")
    if len(password) < 14:
        raise SystemExit("Choose a password with at least 14 characters.")
    salt = secrets.token_bytes(16)
    digest = password_digest(password, salt)
    with db_connect() as conn:
        existing = conn.execute("SELECT id FROM admins LIMIT 1").fetchone()
        if existing:
            conn.execute(
                "UPDATE admins SET username=?, salt=?, password_hash=? WHERE id=1",
                (username, salt, digest),
            )
        else:
            conn.execute(
                "INSERT INTO admins(id, username, salt, password_hash, created_at) VALUES (1,?,?,?,?)",
                (username, salt, digest, utc_text()),
            )
    print("Admin account saved. The password is stored as a salted hash.")


def json_bytes(value: object) -> bytes:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":")).encode("utf-8")


def clean_text(value: object, maximum: int, *, required: bool = False) -> str:
    if not isinstance(value, str):
        value = ""
    value = value.strip()
    if len(value) > maximum:
        raise ValueError(f"Text exceeds the {maximum}-character limit.")
    if required and not value:
        raise ValueError("Complete the required fields.")
    return value


def slugify(value: str) -> str:
    value = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode("ascii")
    value = re.sub(r"[^a-zA-Z0-9]+", "-", value.lower()).strip("-")
    return value[:120].strip("-") or secrets.token_hex(5)


def merge_calendar_events(events: list[dict]) -> tuple[list[dict], list[dict]]:
    """Combine duplicates across sources and report overlapping time slots."""
    merged: dict[tuple, dict] = {}
    for event in events:
        identity = (
            event.get("calendar_uid") or "",
            event.get("title", "").strip().casefold(),
            event.get("starts_at"),
            event.get("ends_at"),
        )
        if not identity[0]:
            identity = ("",) + identity[1:]
        if identity not in merged:
            merged[identity] = {**event, "sources": list(event.get("sources", []))}
        else:
            for source in event.get("sources", []):
                if source not in merged[identity]["sources"]:
                    merged[identity]["sources"].append(source)

    combined = sorted(merged.values(), key=lambda item: item["starts_at"])
    conflicts = []
    for i, first in enumerate(combined):
        for second in combined[i + 1:]:
            if second["starts_at"] >= first["ends_at"]:
                break
            if first["starts_at"] < second["ends_at"] and second["starts_at"] < first["ends_at"]:
                conflicts.append({"first": first, "second": second})
    return combined, conflicts


class BernardoServer(ThreadingHTTPServer):
    daemon_threads = True
    allow_reuse_address = True


class Handler(BaseHTTPRequestHandler):
    server_version = "BernardoSite/1.0"

    def log_message(self, format_string: str, *args: object) -> None:
        # Avoid logging credentials, request bodies or session values.
        super().log_message(format_string, *args)

    def security_headers(self) -> None:
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("X-Frame-Options", "DENY")
        self.send_header("Referrer-Policy", "strict-origin-when-cross-origin")
        self.send_header(
            "Content-Security-Policy",
            "default-src 'self'; img-src 'self' https://upload.wikimedia.org https://thumb.wikimedia.org data:; "
            "style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; "
            "object-src 'none'; base-uri 'self'; frame-ancestors 'none'",
        )

    def send_json(self, status: int, data: object, *, cookies: list[str] | None = None) -> None:
        body = json_bytes(data)
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.security_headers()
        for value in cookies or []:
            self.send_header("Set-Cookie", value)
        self.end_headers()
        self.wfile.write(body)

    def send_error_json(self, status: int, message: str) -> None:
        self.send_json(status, {"error": message})

    def read_json(self) -> dict:
        length = int(self.headers.get("Content-Length", "0"))
        if length < 1 or length > MAX_BODY_BYTES:
            raise ValueError("Request body is empty or too large.")
        if "application/json" not in self.headers.get("Content-Type", ""):
            raise ValueError("Send JSON data.")
        try:
            value = json.loads(self.rfile.read(length))
        except (json.JSONDecodeError, UnicodeDecodeError):
            raise ValueError("The request could not be read.") from None
        if not isinstance(value, dict):
            raise ValueError("Send a JSON object.")
        return value

    def check_origin(self) -> bool:
        origin = self.headers.get("Origin")
        host = self.headers.get("Host")
        if not origin or not host:
            return True
        return urlsplit(origin).netloc.lower() == host.lower()

    def cookie_value(self, name: str) -> str:
        cookie = SimpleCookie()
        try:
            cookie.load(self.headers.get("Cookie", ""))
        except Exception:
            return ""
        morsel = cookie.get(name)
        return morsel.value if morsel else ""

    def current_session(self) -> sqlite3.Row | None:
        token = self.cookie_value("bernardo_session")
        if not token:
            return None
        token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()
        with db_connect() as conn:
            return conn.execute(
                "SELECT token_hash, csrf_token, expires_at FROM sessions WHERE token_hash=? AND expires_at>?",
                (token_hash, utc_text()),
            ).fetchone()

    def require_session(self, *, csrf: bool = False) -> sqlite3.Row | None:
        session = self.current_session()
        if session is None:
            self.send_error_json(HTTPStatus.UNAUTHORIZED, "Connecte-toi pour continuer.")
            return None
        if csrf:
            if not self.check_origin():
                self.send_error_json(HTTPStatus.FORBIDDEN, "Origine de requête non autorisée.")
                return None
            supplied = self.headers.get("X-CSRF-Token", "")
            if not supplied or not hmac.compare_digest(supplied, session["csrf_token"]):
                self.send_error_json(HTTPStatus.FORBIDDEN, "Session expirée. Recharge la page.")
                return None
        return session

    def set_session_cookie(self, value: str, max_age: int) -> str:
        parts = [f"bernardo_session={value}", "Path=/", "HttpOnly", "SameSite=Strict", f"Max-Age={max_age}"]
        if COOKIE_SECURE:
            parts.append("Secure")
        return "; ".join(parts)

    def set_csrf_cookie(self, value: str, max_age: int) -> str:
        # The UI also receives this value from /api/me and holds it in memory.
        parts = [f"bernardo_csrf={value}", "Path=/", "SameSite=Strict", f"Max-Age={max_age}"]
        if COOKIE_SECURE:
            parts.append("Secure")
        return "; ".join(parts)

    def do_GET(self) -> None:
        parsed = urlsplit(self.path)
        if parsed.path.startswith("/api/"):
            self.handle_api_get(parsed.path, parse_qs(parsed.query))
        else:
            self.serve_static(parsed.path)

    def do_POST(self) -> None:
        parsed = urlsplit(self.path)
        if not parsed.path.startswith("/api/"):
            self.send_error_json(HTTPStatus.NOT_FOUND, "Not found.")
            return
        self.handle_api_post(parsed.path)

    def do_PATCH(self) -> None:
        parsed = urlsplit(self.path)
        if not parsed.path.startswith("/api/"):
            self.send_error_json(HTTPStatus.NOT_FOUND, "Not found.")
            return
        self.handle_api_patch(parsed.path)

    def do_DELETE(self) -> None:
        parsed = urlsplit(self.path)
        if not parsed.path.startswith("/api/"):
            self.send_error_json(HTTPStatus.NOT_FOUND, "Not found.")
            return
        self.handle_api_delete(parsed.path)

    def serve_static(self, path: str) -> None:
        filename = STATIC_FILES.get(path)
        if filename is None:
            self.send_error_json(HTTPStatus.NOT_FOUND, "Not found.")
            return
        file_path = OUTPUT_DIR / filename
        try:
            body = file_path.read_bytes()
        except OSError:
            self.send_error_json(HTTPStatus.NOT_FOUND, "Page not found.")
            return
        content_type = mimetypes.guess_type(filename)[0] or "application/octet-stream"
        if content_type.startswith("text/") or content_type in ("application/javascript",):
            content_type += "; charset=utf-8"
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", content_type)
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.security_headers()
        self.end_headers()
        self.wfile.write(body)

    def handle_api_get(self, path: str, query: dict) -> None:
        if path == "/api/health":
            self.send_json(HTTPStatus.OK, {"ok": True})
            return

        if path == "/api/me":
            session = self.require_session()
            if session is None:
                return
            with db_connect() as conn:
                admin = conn.execute("SELECT username FROM admins WHERE id=1").fetchone()
            self.send_json(HTTPStatus.OK, {"authenticated": True, "username": admin["username"], "csrfToken": session["csrf_token"]})
            return

        if path == "/api/posts":
            language = query.get("lang", [""])[0]
            with db_connect() as conn:
                if language in ("es", "fr", "en"):
                    rows = conn.execute(
                        "SELECT id, slug, title, language, summary, status, created_at, updated_at, published_at FROM posts WHERE status='published' AND language=? ORDER BY published_at DESC",
                        (language,),
                    ).fetchall()
                else:
                    rows = conn.execute(
                        "SELECT id, slug, title, language, summary, status, created_at, updated_at, published_at FROM posts WHERE status='published' ORDER BY published_at DESC"
                    ).fetchall()
            self.send_json(HTTPStatus.OK, {"posts": [dict(row) for row in rows]})
            return

        if path.startswith("/api/posts/"):
            slug = unquote(path.removeprefix("/api/posts/"))
            with db_connect() as conn:
                row = conn.execute(
                    "SELECT slug, title, language, summary, body, published_at FROM posts WHERE slug=? AND status='published'",
                    (slug,),
                ).fetchone()
            if row is None:
                self.send_error_json(HTTPStatus.NOT_FOUND, "Publication introuvable.")
            else:
                self.send_json(HTTPStatus.OK, {"post": dict(row)})
            return

        if path == "/api/admin/posts":
            if self.require_session() is None:
                return
            with db_connect() as conn:
                rows = conn.execute("SELECT * FROM posts ORDER BY updated_at DESC").fetchall()
            self.send_json(HTTPStatus.OK, {"posts": [dict(row) for row in rows]})
            return

        if path == "/api/admin/lessons":
            if self.require_session() is None:
                return
            with db_connect() as conn:
                rows = conn.execute(
                    "SELECT * FROM tour_lessons ORDER BY CASE status WHEN 'open' THEN 0 ELSE 1 END, tour_date DESC, created_at DESC"
                ).fetchall()
            self.send_json(HTTPStatus.OK, {"lessons": [dict(row) for row in rows]})
            return

        if path == "/api/admin/calendars":
            if self.require_session() is None:
                return
            with db_connect() as conn:
                rows = conn.execute("SELECT id, provider, account_label, external_calendar_id, status, last_synced_at FROM calendar_connections ORDER BY provider, account_label").fetchall()
            self.send_json(HTTPStatus.OK, {
                "connections": [dict(row) for row in rows],
                "providers": [],
                "setupRequired": True,
                "message": "Choisis les plateformes pour activer les connexions."
            })
            return

        if path == "/api/admin/calendar/events":
            if self.require_session() is None:
                return
            with db_connect() as conn:
                rows = conn.execute(
                    "SELECT e.*, c.provider, c.account_label FROM calendar_events e JOIN calendar_connections c ON c.id=e.connection_id ORDER BY e.starts_at"
                ).fetchall()
            events = []
            for row in rows:
                item = dict(row)
                item["sources"] = [row["account_label"] or row["provider"]]
                events.append(item)
            combined, conflicts = merge_calendar_events(events)
            self.send_json(HTTPStatus.OK, {"events": combined, "conflicts": conflicts})
            return

        self.send_error_json(HTTPStatus.NOT_FOUND, "Not found.")

    def handle_api_post(self, path: str) -> None:
        if path == "/api/login":
            self.login()
            return

        if path == "/api/logout":
            session = self.require_session(csrf=True)
            if session is None:
                return
            with db_connect() as conn:
                conn.execute("DELETE FROM sessions WHERE token_hash=?", (session["token_hash"],))
            self.send_json(HTTPStatus.OK, {"ok": True}, cookies=[
                self.set_session_cookie("", 0),
                self.set_csrf_cookie("", 0),
            ])
            return

        session = self.require_session(csrf=True)
        if session is None:
            return
        try:
            payload = self.read_json()
        except ValueError as exc:
            self.send_error_json(HTTPStatus.BAD_REQUEST, str(exc))
            return

        if path == "/api/admin/posts":
            self.create_post(payload)
            return
        if path == "/api/admin/lessons":
            self.create_lesson(payload)
            return
        if path == "/api/admin/calendars/sync":
            self.send_json(HTTPStatus.SERVICE_UNAVAILABLE, {
                "error": "Aucune plateforme de calendrier n’est configurée."
            })
            return
        self.send_error_json(HTTPStatus.NOT_FOUND, "Not found.")

    def handle_api_patch(self, path: str) -> None:
        session = self.require_session(csrf=True)
        if session is None:
            return
        try:
            payload = self.read_json()
        except ValueError as exc:
            self.send_error_json(HTTPStatus.BAD_REQUEST, str(exc))
            return

        post_match = re.fullmatch(r"/api/admin/posts/(\d+)", path)
        if post_match:
            self.update_post(int(post_match.group(1)), payload)
            return
        lesson_match = re.fullmatch(r"/api/admin/lessons/(\d+)", path)
        if lesson_match:
            self.update_lesson(int(lesson_match.group(1)), payload)
            return
        self.send_error_json(HTTPStatus.NOT_FOUND, "Not found.")

    def handle_api_delete(self, path: str) -> None:
        if self.require_session(csrf=True) is None:
            return
        post_match = re.fullmatch(r"/api/admin/posts/(\d+)", path)
        if post_match:
            with db_connect() as conn:
                cursor = conn.execute("DELETE FROM posts WHERE id=?", (int(post_match.group(1)),))
            if cursor.rowcount == 0:
                self.send_error_json(HTTPStatus.NOT_FOUND, "Publication introuvable.")
            else:
                self.send_json(HTTPStatus.OK, {"ok": True})
            return
        self.send_error_json(HTTPStatus.NOT_FOUND, "Not found.")

    def login(self) -> None:
        if not self.check_origin():
            self.send_error_json(HTTPStatus.FORBIDDEN, "Origine de requête non autorisée.")
            return
        client = self.client_address[0]
        now = time.time()
        with LOGIN_LOCK:
            attempts = [stamp for stamp in LOGIN_ATTEMPTS.get(client, []) if now - stamp < 900]
            LOGIN_ATTEMPTS[client] = attempts
            if len(attempts) >= 6:
                self.send_error_json(HTTPStatus.TOO_MANY_REQUESTS, "Trop de tentatives. Réessaie dans quelques minutes.")
                return
        try:
            payload = self.read_json()
            username = clean_text(payload.get("username"), 48).lower()
            password = clean_text(payload.get("password"), 512)
        except ValueError as exc:
            self.send_error_json(HTTPStatus.BAD_REQUEST, str(exc))
            return

        with db_connect() as conn:
            admin = conn.execute("SELECT username, salt, password_hash FROM admins WHERE id=1").fetchone()
        correct = False
        if admin is not None and hmac.compare_digest(username, admin["username"]):
            correct = hmac.compare_digest(password_digest(password, admin["salt"]), admin["password_hash"])
        if not correct:
            with LOGIN_LOCK:
                LOGIN_ATTEMPTS.setdefault(client, []).append(now)
            self.send_error_json(HTTPStatus.UNAUTHORIZED, "Nom d’utilisateur ou mot de passe incorrect.")
            return

        with LOGIN_LOCK:
            LOGIN_ATTEMPTS.pop(client, None)
        token = secrets.token_urlsafe(32)
        csrf_token = secrets.token_urlsafe(24)
        expires = utc_text(utc_now() + timedelta(hours=SESSION_HOURS))
        token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()
        with db_connect() as conn:
            conn.execute("DELETE FROM sessions WHERE expires_at<=?", (utc_text(),))
            conn.execute(
                "INSERT INTO sessions(token_hash,csrf_token,expires_at,created_at) VALUES (?,?,?,?)",
                (token_hash, csrf_token, expires, utc_text()),
            )
        self.send_json(HTTPStatus.OK, {"authenticated": True, "username": admin["username"], "csrfToken": csrf_token}, cookies=[
            self.set_session_cookie(token, SESSION_HOURS * 3600),
            self.set_csrf_cookie(csrf_token, SESSION_HOURS * 3600),
        ])

    def create_post(self, payload: dict) -> None:
        try:
            title = clean_text(payload.get("title"), 160, required=True)
            language = clean_text(payload.get("language"), 2)
            if language not in ("es", "fr", "en"):
                raise ValueError("Choisis la langue de la publication.")
            summary = clean_text(payload.get("summary"), 600)
            body = clean_text(payload.get("body"), 24000, required=True)
            status = clean_text(payload.get("status"), 12)
            if status not in ("draft", "published"):
                raise ValueError("Choisis brouillon ou publié.")
            slug = slugify(clean_text(payload.get("slug"), 120) or title)
            now = utc_text()
            with db_connect() as conn:
                conn.execute(
                    "INSERT INTO posts(slug,title,language,summary,body,status,created_at,updated_at,published_at) VALUES (?,?,?,?,?,?,?,?,?)",
                    (slug,title,language,summary,body,status,now,now,now if status == "published" else None),
                )
                post_id = conn.execute("SELECT last_insert_rowid()").fetchone()[0]
            self.send_json(HTTPStatus.CREATED, {"id": post_id, "slug": slug, "status": status})
        except sqlite3.IntegrityError:
            self.send_error_json(HTTPStatus.CONFLICT, "Cette adresse courte existe déjà.")
        except ValueError as exc:
            self.send_error_json(HTTPStatus.BAD_REQUEST, str(exc))

    def update_post(self, post_id: int, payload: dict) -> None:
        try:
            title = clean_text(payload.get("title"), 160, required=True)
            language = clean_text(payload.get("language"), 2)
            if language not in ("es", "fr", "en"):
                raise ValueError("Choisis la langue de la publication.")
            summary = clean_text(payload.get("summary"), 600)
            body = clean_text(payload.get("body"), 24000, required=True)
            status = clean_text(payload.get("status"), 12)
            if status not in ("draft", "published"):
                raise ValueError("Choisis brouillon ou publié.")
            slug = slugify(clean_text(payload.get("slug"), 120) or title)
            now = utc_text()
            with db_connect() as conn:
                old = conn.execute("SELECT published_at FROM posts WHERE id=?", (post_id,)).fetchone()
                if old is None:
                    self.send_error_json(HTTPStatus.NOT_FOUND, "Publication introuvable.")
                    return
                published_at = (old["published_at"] or now) if status == "published" else None
                conn.execute(
                    "UPDATE posts SET slug=?,title=?,language=?,summary=?,body=?,status=?,updated_at=?,published_at=? WHERE id=?",
                    (slug,title,language,summary,body,status,now,published_at,post_id),
                )
            self.send_json(HTTPStatus.OK, {"id": post_id, "slug": slug, "status": status})
        except sqlite3.IntegrityError:
            self.send_error_json(HTTPStatus.CONFLICT, "Cette adresse courte existe déjà.")
        except ValueError as exc:
            self.send_error_json(HTTPStatus.BAD_REQUEST, str(exc))

    def create_lesson(self, payload: dict) -> None:
        try:
            tour_date = clean_text(payload.get("tour_date"), 10)
            tour_name = clean_text(payload.get("tour_name"), 120)
            category = clean_text(payload.get("category"), 32) or "other"
            situation = clean_text(payload.get("situation"), 3000, required=True)
            learning = clean_text(payload.get("learning"), 3000, required=True)
            next_action = clean_text(payload.get("next_action"), 2000)
            tags = clean_text(payload.get("tags"), 240)
            now = utc_text()
            with db_connect() as conn:
                conn.execute(
                    "INSERT INTO tour_lessons(tour_date,tour_name,category,situation,learning,next_action,tags,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,'open',?,?)",
                    (tour_date,tour_name,category,situation,learning,next_action,tags,now,now),
                )
                lesson_id = conn.execute("SELECT last_insert_rowid()").fetchone()[0]
            self.send_json(HTTPStatus.CREATED, {"id": lesson_id, "status": "open"})
        except ValueError as exc:
            self.send_error_json(HTTPStatus.BAD_REQUEST, str(exc))

    def update_lesson(self, lesson_id: int, payload: dict) -> None:
        status = clean_text(payload.get("status"), 12)
        if status not in ("open", "resolved"):
            self.send_error_json(HTTPStatus.BAD_REQUEST, "État de leçon invalide.")
            return
        with db_connect() as conn:
            cursor = conn.execute(
                "UPDATE tour_lessons SET status=?,updated_at=? WHERE id=?",
                (status,utc_text(),lesson_id),
            )
        if cursor.rowcount == 0:
            self.send_error_json(HTTPStatus.NOT_FOUND, "Leçon introuvable.")
        else:
            self.send_json(HTTPStatus.OK, {"id": lesson_id, "status": status})


def run_server() -> None:
    init_db()
    server = BernardoServer((HOST, PORT), Handler)
    print(f"Bernardo's site is available at http://{HOST}:{PORT}/")
    print("Use Ctrl+C to stop. This development server is bound to localhost by default.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    init_db()
    if len(sys.argv) > 1 and sys.argv[1] in ("set-admin", "create-admin"):
        set_admin()
    else:
        run_server()

