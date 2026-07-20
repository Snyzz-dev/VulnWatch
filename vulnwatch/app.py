import sqlite3
import os
import datetime
from flask import Flask, jsonify, render_template, g, request, abort

DB_PATH = os.path.join(os.path.dirname(__file__), "vulnwatch.db")

app = Flask(__name__)

SEVERITIES = ["Critical", "High", "Medium", "Low"]
VULN_STATUSES = ["Open", "In Progress", "Resolved"]
SCAN_STATUSES = ["Completed", "In Progress", "Failed", "Scheduled"]
CONNECTIVITY = ["Online", "Offline", "Unmanaged"]


def get_db():
    if "db" not in g:
        g.db = sqlite3.connect(DB_PATH)
        g.db.row_factory = sqlite3.Row
        g.db.execute("PRAGMA foreign_keys = ON")
    return g.db


@app.teardown_appcontext
def close_db(exception=None):
    db = g.pop("db", None)
    if db is not None:
        db.close()


def bad_request(msg):
    return jsonify({"error": msg}), 400


def not_found():
    return jsonify({"error": "Not found"}), 404


@app.route("/")
def dashboard():
    return render_template("dashboard.html")


# ---------------------------------------------------------------------------
# VULNERABILITIES
# ---------------------------------------------------------------------------

@app.route("/api/vulnerabilities", methods=["GET"])
def list_vulnerabilities():
    db = get_db()
    rows = db.execute(
        "SELECT * FROM vulnerabilities ORDER BY cvss_score DESC, id DESC"
    ).fetchall()
    return jsonify([dict(r) for r in rows])


@app.route("/api/vulnerabilities", methods=["POST"])
def create_vulnerability():
    data = request.get_json(force=True, silent=True) or {}
    required = ["cve_id", "title", "severity", "cvss_score", "first_detected", "last_detected"]
    for f in required:
        if not str(data.get(f, "")).strip():
            return bad_request(f"Champ requis manquant: {f}")
    if data["severity"] not in SEVERITIES:
        return bad_request("Severite invalide")
    status = data.get("status", "Open")
    if status not in VULN_STATUSES:
        return bad_request("Statut invalide")
    try:
        cvss = float(data["cvss_score"])
        affected = int(data.get("affected_assets", 0) or 0)
    except (TypeError, ValueError):
        return bad_request("Valeurs numeriques invalides")

    db = get_db()
    cur = db.execute(
        """INSERT INTO vulnerabilities
           (cve_id, title, severity, cvss_score, affected_assets, status, first_detected, last_detected)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
        (data["cve_id"], data["title"], data["severity"], cvss, affected, status,
         data["first_detected"], data["last_detected"]),
    )
    db.commit()
    row = db.execute("SELECT * FROM vulnerabilities WHERE id = ?", (cur.lastrowid,)).fetchone()
    return jsonify(dict(row)), 201


@app.route("/api/vulnerabilities/<int:vuln_id>", methods=["PATCH"])
def update_vulnerability(vuln_id):
    db = get_db()
    row = db.execute("SELECT * FROM vulnerabilities WHERE id = ?", (vuln_id,)).fetchone()
    if row is None:
        return not_found()
    data = request.get_json(force=True, silent=True) or {}
    status = data.get("status", row["status"])
    if status not in VULN_STATUSES:
        return bad_request("Statut invalide")
    db.execute("UPDATE vulnerabilities SET status = ? WHERE id = ?", (status, vuln_id))
    db.commit()
    row = db.execute("SELECT * FROM vulnerabilities WHERE id = ?", (vuln_id,)).fetchone()
    return jsonify(dict(row))


@app.route("/api/vulnerabilities/<int:vuln_id>", methods=["DELETE"])
def delete_vulnerability(vuln_id):
    db = get_db()
    db.execute("DELETE FROM vulnerabilities WHERE id = ?", (vuln_id,))
    db.commit()
    return "", 204


# ---------------------------------------------------------------------------
# ASSETS
# ---------------------------------------------------------------------------

@app.route("/api/assets", methods=["GET"])
def list_assets():
    db = get_db()
    rows = db.execute("SELECT * FROM assets ORDER BY risk_score DESC, id DESC").fetchall()
    return jsonify([dict(r) for r in rows])


@app.route("/api/assets", methods=["POST"])
def create_asset():
    data = request.get_json(force=True, silent=True) or {}
    for f in ["name", "type"]:
        if not str(data.get(f, "")).strip():
            return bad_request(f"Champ requis manquant: {f}")
    connectivity = data.get("connectivity", "Online")
    if connectivity not in CONNECTIVITY:
        return bad_request("Statut de connectivite invalide")
    try:
        risk_score = float(data.get("risk_score", 0) or 0)
        vulnerabilities = int(data.get("vulnerabilities", 0) or 0)
    except (TypeError, ValueError):
        return bad_request("Valeurs numeriques invalides")

    db = get_db()
    cur = db.execute(
        "INSERT INTO assets (name, type, risk_score, vulnerabilities, connectivity) VALUES (?, ?, ?, ?, ?)",
        (data["name"], data["type"], risk_score, vulnerabilities, connectivity),
    )
    db.commit()
    row = db.execute("SELECT * FROM assets WHERE id = ?", (cur.lastrowid,)).fetchone()
    return jsonify(dict(row)), 201


@app.route("/api/assets/<int:asset_id>", methods=["DELETE"])
def delete_asset(asset_id):
    db = get_db()
    db.execute("DELETE FROM assets WHERE id = ?", (asset_id,))
    db.commit()
    return "", 204


# ---------------------------------------------------------------------------
# SCANS
# ---------------------------------------------------------------------------

@app.route("/api/scans", methods=["GET"])
def list_scans():
    db = get_db()
    rows = db.execute("SELECT * FROM scans ORDER BY id DESC").fetchall()
    items = [dict(r) for r in rows]
    total = len(items)
    counts = {s: 0 for s in SCAN_STATUSES}
    for r in items:
        counts[r["status"]] = counts.get(r["status"], 0) + 1
    summary = [{"status": s, "count": counts[s], "pct": round(counts[s] / total * 100) if total else 0}
               for s in SCAN_STATUSES]
    return jsonify({"total": total, "items": items, "summary": summary})


@app.route("/api/scans", methods=["POST"])
def create_scan():
    data = request.get_json(force=True, silent=True) or {}
    if not str(data.get("name", "")).strip():
        return bad_request("Champ requis manquant: name")
    status = data.get("status", "Scheduled")
    if status not in SCAN_STATUSES:
        return bad_request("Statut invalide")

    db = get_db()
    created_at = datetime.date.today().isoformat()
    cur = db.execute(
        "INSERT INTO scans (name, status, created_at) VALUES (?, ?, ?)",
        (data["name"], status, created_at),
    )
    db.commit()
    row = db.execute("SELECT * FROM scans WHERE id = ?", (cur.lastrowid,)).fetchone()
    return jsonify(dict(row)), 201


@app.route("/api/scans/<int:scan_id>", methods=["DELETE"])
def delete_scan(scan_id):
    db = get_db()
    db.execute("DELETE FROM scans WHERE id = ?", (scan_id,))
    db.commit()
    return "", 204


# ---------------------------------------------------------------------------
# COMPLIANCE
# ---------------------------------------------------------------------------

@app.route("/api/compliance", methods=["GET"])
def list_compliance():
    db = get_db()
    rows = db.execute("SELECT * FROM compliance ORDER BY id").fetchall()
    return jsonify([dict(r) for r in rows])


@app.route("/api/compliance", methods=["POST"])
def create_compliance():
    data = request.get_json(force=True, silent=True) or {}
    if not str(data.get("framework", "")).strip():
        return bad_request("Champ requis manquant: framework")
    try:
        pct = int(data.get("percentage", 0) or 0)
    except (TypeError, ValueError):
        return bad_request("Pourcentage invalide")
    pct = max(0, min(100, pct))

    db = get_db()
    cur = db.execute(
        "INSERT INTO compliance (framework, percentage) VALUES (?, ?)",
        (data["framework"], pct),
    )
    db.commit()
    row = db.execute("SELECT * FROM compliance WHERE id = ?", (cur.lastrowid,)).fetchone()
    return jsonify(dict(row)), 201


@app.route("/api/compliance/<int:comp_id>", methods=["PATCH"])
def update_compliance(comp_id):
    db = get_db()
    row = db.execute("SELECT * FROM compliance WHERE id = ?", (comp_id,)).fetchone()
    if row is None:
        return not_found()
    data = request.get_json(force=True, silent=True) or {}
    try:
        pct = int(data.get("percentage", row["percentage"]))
    except (TypeError, ValueError):
        return bad_request("Pourcentage invalide")
    pct = max(0, min(100, pct))
    db.execute("UPDATE compliance SET percentage = ? WHERE id = ?", (pct, comp_id))
    db.commit()
    row = db.execute("SELECT * FROM compliance WHERE id = ?", (comp_id,)).fetchone()
    return jsonify(dict(row))


@app.route("/api/compliance/<int:comp_id>", methods=["DELETE"])
def delete_compliance(comp_id):
    db = get_db()
    db.execute("DELETE FROM compliance WHERE id = ?", (comp_id,))
    db.commit()
    return "", 204


# ---------------------------------------------------------------------------
# DASHBOARD AGGREGATES (100% calcules depuis la base, aucune valeur figee)
# ---------------------------------------------------------------------------

@app.route("/api/overview")
def api_overview():
    db = get_db()
    rows = db.execute(
        "SELECT severity, COUNT(*) as cnt FROM vulnerabilities GROUP BY severity"
    ).fetchall()
    counts = {s: 0 for s in SEVERITIES}
    for r in rows:
        counts[r["severity"]] = r["cnt"]
    total = sum(counts.values())
    return jsonify({"total": total, "severity_counts": counts})


@app.route("/api/remediation")
def api_remediation():
    db = get_db()
    rows = db.execute(
        "SELECT status, COUNT(*) as cnt FROM vulnerabilities GROUP BY status"
    ).fetchall()
    counts = {s: 0 for s in VULN_STATUSES}
    for r in rows:
        counts[r["status"]] = r["cnt"]
    total = sum(counts.values())
    pct = round(counts["Resolved"] / total * 100) if total else 0
    return jsonify({
        "percentage": pct,
        "resolved": counts["Resolved"],
        "in_progress": counts["In Progress"],
        "pending": counts["Open"],
    })


@app.route("/api/risk-score")
def api_risk_score():
    db = get_db()
    row = db.execute(
        "SELECT AVG(cvss_score) as avg_score FROM vulnerabilities WHERE status != 'Resolved'"
    ).fetchone()
    current = round(row["avg_score"], 1) if row["avg_score"] is not None else 0.0

    today = datetime.date.today()
    day_label = today.strftime("%b %d")
    db.execute(
        "INSERT INTO risk_trend (day_label, risk_value) VALUES (?, ?) "
        "ON CONFLICT(day_label) DO UPDATE SET risk_value = excluded.risk_value",
        (day_label, current),
    )
    db.commit()

    trend_rows = db.execute(
        "SELECT day_label, risk_value FROM risk_trend ORDER BY id DESC LIMIT 7"
    ).fetchall()
    trend = [{"day": r["day_label"], "value": r["risk_value"]} for r in reversed(trend_rows)]

    delta = 0.0
    if len(trend) >= 2:
        delta = round(trend[-1]["value"] - trend[0]["value"], 1)

    if current >= 7:
        level = "High"
    elif current >= 4:
        level = "Medium"
    elif current > 0:
        level = "Low"
    else:
        level = "None"

    return jsonify({"current": current, "delta": delta, "trend": trend, "level": level})


@app.route("/api/assets-summary")
def api_assets_summary():
    db = get_db()
    rows = db.execute(
        "SELECT connectivity, COUNT(*) as cnt FROM assets GROUP BY connectivity"
    ).fetchall()
    counts = {c: 0 for c in CONNECTIVITY}
    for r in rows:
        counts[r["connectivity"]] = r["cnt"]
    total = sum(counts.values())
    return jsonify({
        "total": total,
        "online": counts["Online"],
        "offline": counts["Offline"],
        "unmanaged": counts["Unmanaged"],
    })


@app.route("/api/assets-at-risk")
def api_assets_at_risk():
    db = get_db()
    rows = db.execute(
        "SELECT * FROM assets ORDER BY risk_score DESC, id DESC LIMIT 5"
    ).fetchall()
    return jsonify([dict(r) for r in rows])


if __name__ == "__main__":
    if not os.path.exists(DB_PATH):
        from init_db import init_db
        init_db()
    app.run(debug=True, host="0.0.0.0", port=5000)
