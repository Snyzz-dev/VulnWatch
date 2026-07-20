import sqlite3
import os
import sys

DB_PATH = os.path.join(os.path.dirname(__file__), "vulnwatch.db")

SCHEMA = """
CREATE TABLE IF NOT EXISTS vulnerabilities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cve_id TEXT NOT NULL,
    title TEXT NOT NULL,
    severity TEXT NOT NULL CHECK(severity IN ('Critical','High','Medium','Low')),
    cvss_score REAL NOT NULL,
    affected_assets INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL CHECK(status IN ('Open','In Progress','Resolved')) DEFAULT 'Open',
    first_detected TEXT NOT NULL,
    last_detected TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS assets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    risk_score REAL NOT NULL DEFAULT 0,
    vulnerabilities INTEGER NOT NULL DEFAULT 0,
    connectivity TEXT NOT NULL CHECK(connectivity IN ('Online','Offline','Unmanaged')) DEFAULT 'Online'
);

CREATE TABLE IF NOT EXISTS scans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('Completed','In Progress','Failed','Scheduled')) DEFAULT 'Scheduled',
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS compliance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    framework TEXT NOT NULL,
    percentage INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS risk_trend (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    day_label TEXT NOT NULL UNIQUE,
    risk_value REAL NOT NULL
);
"""


def init_db(reset=False):
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    if reset:
        cur.executescript(
            "DROP TABLE IF EXISTS vulnerabilities;"
            "DROP TABLE IF EXISTS assets;"
            "DROP TABLE IF EXISTS scans;"
            "DROP TABLE IF EXISTS compliance;"
            "DROP TABLE IF EXISTS risk_trend;"
        )
    cur.executescript(SCHEMA)
    conn.commit()
    conn.close()
    print(f"Base de donnees initialisee (vide): {DB_PATH}")


if __name__ == "__main__":
    init_db(reset="--reset" in sys.argv)
