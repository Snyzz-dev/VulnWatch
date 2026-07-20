// ---------- Helpers ----------
const SVG_NS = "http://www.w3.org/2000/svg";

function el(tag, attrs) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const k in attrs) node.setAttribute(k, attrs[k]);
  return node;
}

function fmt(n) {
  return n.toLocaleString("en-US");
}

async function api(path, options = {}) {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error((data && data.error) || "Erreur serveur");
  return data;
}

// Draws a multi-segment donut chart into an <svg viewBox="0 0 120 120">
function drawDonut(svgId, segments, strokeWidth = 14) {
  const svg = document.getElementById(svgId);
  svg.innerHTML = "";
  const size = 120;
  const r = (size - strokeWidth) / 2;
  const cx = size / 2, cy = size / 2;
  const circumference = 2 * Math.PI * r;
  const total = segments.reduce((s, x) => s + x.value, 0);

  svg.appendChild(el("circle", { cx, cy, r, fill: "none", stroke: "#1c2330", "stroke-width": strokeWidth }));

  if (total === 0) return;

  let offset = 0;
  segments.forEach(seg => {
    if (seg.value <= 0) return;
    const frac = seg.value / total;
    const dash = frac * circumference;
    const gap = circumference - dash;
    svg.appendChild(el("circle", {
      cx, cy, r, fill: "none", stroke: seg.color, "stroke-width": strokeWidth,
      "stroke-dasharray": `${dash} ${gap}`, "stroke-dashoffset": -offset, "stroke-linecap": "butt",
    }));
    offset += dash;
  });
}

function drawSparkline(svgId, values, color = "#eab308") {
  const svg = document.getElementById(svgId);
  svg.innerHTML = "";
  if (!values.length) return;
  const w = 220, h = 70, pad = 4;
  const max = Math.max(...values), min = Math.min(...values);
  const range = (max - min) || 1;
  const stepX = values.length > 1 ? (w - pad * 2) / (values.length - 1) : 0;

  const points = values.map((v, i) => {
    const x = pad + i * stepX;
    const y = h - pad - ((v - min) / range) * (h - pad * 2);
    return [x, y];
  });

  const linePath = "M" + points.map(p => p.join(",")).join(" L");
  const areaPath = linePath + ` L${points[points.length - 1][0]},${h} L${points[0][0]},${h} Z`;

  const gradId = svgId + "-grad";
  const defs = el("defs", {});
  const grad = el("linearGradient", { id: gradId, x1: "0", y1: "0", x2: "0", y2: "1" });
  grad.appendChild(el("stop", { offset: "0%", "stop-color": color, "stop-opacity": "0.35" }));
  grad.appendChild(el("stop", { offset: "100%", "stop-color": color, "stop-opacity": "0" }));
  defs.appendChild(grad);
  svg.appendChild(defs);

  svg.appendChild(el("path", { d: areaPath, fill: `url(#${gradId})`, stroke: "none" }));
  svg.appendChild(el("path", { d: linePath, fill: "none", stroke: color, "stroke-width": "2" }));
}

function drawRiskTrend(svgId, trend, color = "#ef4444") {
  const svg = document.getElementById(svgId);
  svg.innerHTML = "";
  const w = 400, h = 260;
  const padL = 28, padR = 10, padT = 10, padB = 28;
  const plotW = w - padL - padR;
  const plotH = h - padT - padB;
  const maxVal = 10, minVal = 0;

  const gridVals = [0, 2, 4, 6, 8, 10];
  gridVals.forEach(gv => {
    const y = padT + plotH - (gv / maxVal) * plotH;
    svg.appendChild(el("line", { x1: padL, x2: w - padR, y1: y, y2: y, stroke: "#1c2330", "stroke-width": "1" }));
    const label = document.createElementNS(SVG_NS, "text");
    label.setAttribute("x", padL - 8);
    label.setAttribute("y", y + 4);
    label.setAttribute("text-anchor", "end");
    label.setAttribute("font-size", "10");
    label.setAttribute("fill", "#6b7688");
    label.textContent = gv;
    svg.appendChild(label);
  });

  if (!trend.length) {
    const label = document.createElementNS(SVG_NS, "text");
    label.setAttribute("x", w / 2);
    label.setAttribute("y", h / 2);
    label.setAttribute("text-anchor", "middle");
    label.setAttribute("font-size", "12");
    label.setAttribute("fill", "#6b7688");
    label.textContent = "Pas encore de donnees";
    svg.appendChild(label);
    return;
  }

  const stepX = trend.length > 1 ? plotW / (trend.length - 1) : 0;
  const points = trend.map((t, i) => {
    const x = padL + i * stepX;
    const y = padT + plotH - ((t.value - minVal) / (maxVal - minVal)) * plotH;
    return [x, y];
  });

  const linePath = "M" + points.map(p => p.join(",")).join(" L");
  const areaPath = linePath + ` L${points[points.length - 1][0]},${padT + plotH} L${points[0][0]},${padT + plotH} Z`;

  const gradId = svgId + "-grad";
  const defs = el("defs", {});
  const grad = el("linearGradient", { id: gradId, x1: "0", y1: "0", x2: "0", y2: "1" });
  grad.appendChild(el("stop", { offset: "0%", "stop-color": color, "stop-opacity": "0.30" }));
  grad.appendChild(el("stop", { offset: "100%", "stop-color": color, "stop-opacity": "0" }));
  defs.appendChild(grad);
  svg.appendChild(defs);

  svg.appendChild(el("path", { d: areaPath, fill: `url(#${gradId})`, stroke: "none" }));
  svg.appendChild(el("path", { d: linePath, fill: "none", stroke: color, "stroke-width": "2" }));

  points.forEach(([x, y]) => {
    svg.appendChild(el("circle", { cx: x, cy: y, r: 3.5, fill: "#0b0e14", stroke: color, "stroke-width": "2" }));
  });

  trend.forEach((t, i) => {
    const label = document.createElementNS(SVG_NS, "text");
    label.setAttribute("x", padL + i * stepX);
    label.setAttribute("y", h - 6);
    label.setAttribute("text-anchor", "middle");
    label.setAttribute("font-size", "10");
    label.setAttribute("fill", "#6b7688");
    label.textContent = t.day;
    svg.appendChild(label);
  });
}

const SEVERITY_COLORS = { Critical: "#ef4444", High: "#f59e0b", Medium: "#eab308", Low: "#22c55e" };
const SCAN_COLORS = { "Completed": "#22c55e", "In Progress": "#3b82f6", "Failed": "#ef4444", "Scheduled": "#4b5566" };

// ---------- Toggle add-forms ----------
function wireToggle(btnId, formId) {
  const btn = document.getElementById(btnId);
  const form = document.getElementById(formId);
  btn.addEventListener("click", () => {
    form.hidden = !form.hidden;
  });
}

// ---------- Vulnerabilities ----------
function severityPillClass(sev) {
  return { Critical: "pill-critical", High: "pill-high", Medium: "pill-medium", Low: "pill-low" }[sev] || "pill-low";
}
function statusSelectClass(status) {
  if (status === "Open") return "status-open";
  if (status === "In Progress") return "status-progress";
  return "status-resolved";
}

async function loadVulnerabilities() {
  const rows = await api("/api/vulnerabilities");
  const tbody = document.getElementById("vuln-table-body");
  const empty = document.getElementById("vuln-empty");
  tbody.innerHTML = "";
  empty.hidden = rows.length > 0;

  const criticalOpen = rows.filter(v => v.severity === "Critical" && v.status !== "Resolved").length;
  updateNotifBadge(criticalOpen);

  rows.slice(0, 8).forEach(v => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>
        <div class="vuln-name">${escapeHtml(v.cve_id)}</div>
        <div class="vuln-sub">${escapeHtml(v.title)}</div>
      </td>
      <td><span class="pill ${severityPillClass(v.severity)}">${v.severity}</span></td>
      <td>${v.cvss_score.toFixed(1)}</td>
      <td>${v.affected_assets}</td>
      <td>
        <select class="status-select ${statusSelectClass(v.status)}" data-id="${v.id}">
          <option value="Open" ${v.status === "Open" ? "selected" : ""}>Open</option>
          <option value="In Progress" ${v.status === "In Progress" ? "selected" : ""}>In Progress</option>
          <option value="Resolved" ${v.status === "Resolved" ? "selected" : ""}>Resolved</option>
        </select>
      </td>
      <td>${escapeHtml(v.first_detected)}</td>
      <td>${escapeHtml(v.last_detected)}</td>
      <td><button class="row-delete" data-id="${v.id}" title="Supprimer">✕</button></td>
    `;
    tbody.appendChild(tr);
  });

  tbody.querySelectorAll(".row-delete").forEach(btn => {
    btn.addEventListener("click", async () => {
      await api(`/api/vulnerabilities/${btn.dataset.id}`, { method: "DELETE" });
      await refreshAll();
    });
  });
  tbody.querySelectorAll(".status-select").forEach(sel => {
    sel.addEventListener("change", async () => {
      await api(`/api/vulnerabilities/${sel.dataset.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: sel.value }),
      });
      await refreshAll();
    });
  });
}

function wireVulnForm() {
  const form = document.getElementById("vuln-form");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const payload = Object.fromEntries(fd.entries());
    try {
      await api("/api/vulnerabilities", { method: "POST", body: JSON.stringify(payload) });
      form.reset();
      form.hidden = true;
      await refreshAll();
    } catch (err) {
      alert(err.message);
    }
  });
}

// ---------- Assets ----------
function riskTextClass(score) {
  if (score >= 8) return "risk-critical-text";
  if (score >= 6) return "risk-high-text";
  return "risk-ok-text";
}

async function loadAssetsAtRisk() {
  const rows = await api("/api/assets");
  const tbody = document.getElementById("assets-table-body");
  const empty = document.getElementById("asset-empty");
  tbody.innerHTML = "";
  empty.hidden = rows.length > 0;

  rows.slice(0, 6).forEach(a => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(a.name)}</td>
      <td>${escapeHtml(a.type)}</td>
      <td><span class="risk-badge ${riskTextClass(a.risk_score)}">${a.risk_score.toFixed(1)}</span></td>
      <td>${a.vulnerabilities}</td>
      <td><button class="row-delete" data-id="${a.id}" title="Supprimer">✕</button></td>
    `;
    tbody.appendChild(tr);
  });

  tbody.querySelectorAll(".row-delete").forEach(btn => {
    btn.addEventListener("click", async () => {
      await api(`/api/assets/${btn.dataset.id}`, { method: "DELETE" });
      await refreshAll();
    });
  });
}

function wireAssetForm() {
  const form = document.getElementById("asset-form");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const payload = Object.fromEntries(fd.entries());
    try {
      await api("/api/assets", { method: "POST", body: JSON.stringify(payload) });
      form.reset();
      form.hidden = true;
      await refreshAll();
    } catch (err) {
      alert(err.message);
    }
  });
}

async function loadAssetsSummary() {
  const data = await api("/api/assets-summary");
  document.getElementById("assets-total").textContent = fmt(data.total);
  const items = [
    { name: "Online", value: data.online, color: "#22c55e" },
    { name: "Offline", value: data.offline, color: "#4b5566" },
    { name: "Unmanaged", value: data.unmanaged, color: "#ef4444" },
  ];
  const list = document.getElementById("assets-breakdown");
  list.innerHTML = "";
  items.forEach(it => {
    const li = document.createElement("li");
    li.innerHTML = `<span class="dot" style="background:${it.color}"></span><span class="dname">${it.name}</span><span class="dvalue">${fmt(it.value)}</span>`;
    list.appendChild(li);
  });
}

// ---------- Scans ----------
async function loadScans() {
  const data = await api("/api/scans");
  document.getElementById("scans-total").textContent = data.total;

  const segments = data.summary.map(s => ({ name: s.status, value: s.count, color: SCAN_COLORS[s.status] }));
  drawDonut("chart-scans", segments);

  const legend = document.getElementById("scans-legend");
  legend.innerHTML = "";
  data.summary.forEach(s => {
    const li = document.createElement("li");
    li.innerHTML = `<span class="dot" style="background:${SCAN_COLORS[s.status]}"></span><span class="lname">${s.status}</span><span class="lvalue">${s.count} (${s.pct}%)</span>`;
    legend.appendChild(li);
  });

  const list = document.getElementById("scans-list");
  list.innerHTML = "";
  if (data.items.length === 0) {
    const li = document.createElement("li");
    li.innerHTML = `<span class="rname" style="color:var(--text-muted)">Aucun scan enregistre.</span>`;
    list.appendChild(li);
  }
  data.items.slice(0, 8).forEach(s => {
    const li = document.createElement("li");
    li.innerHTML = `
      <span class="rname">${escapeHtml(s.name)}</span>
      <span class="rstatus">${s.status} · ${escapeHtml(s.created_at)}</span>
      <button class="row-delete" data-id="${s.id}" title="Supprimer">✕</button>
    `;
    list.appendChild(li);
  });
  list.querySelectorAll(".row-delete").forEach(btn => {
    btn.addEventListener("click", async () => {
      await api(`/api/scans/${btn.dataset.id}`, { method: "DELETE" });
      await refreshAll();
    });
  });
}

function wireScanForm() {
  const form = document.getElementById("scan-form");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const payload = Object.fromEntries(fd.entries());
    try {
      await api("/api/scans", { method: "POST", body: JSON.stringify(payload) });
      form.reset();
      form.hidden = true;
      await refreshAll();
    } catch (err) {
      alert(err.message);
    }
  });
}

// ---------- Compliance ----------
async function loadCompliance() {
  const rows = await api("/api/compliance");
  const list = document.getElementById("compliance-list");
  const empty = document.getElementById("compliance-empty");
  list.innerHTML = "";
  empty.hidden = rows.length > 0;

  rows.forEach(r => {
    let color = r.percentage >= 70 ? "#22c55e" : "#f59e0b";
    const li = document.createElement("li");
    li.className = "bar-item";
    li.innerHTML = `
      <div class="bar-head">
        <span class="bname">${escapeHtml(r.framework)}</span>
        <input type="number" class="bpct-input" min="0" max="100" value="${r.percentage}" data-id="${r.id}">
        <span>%</span>
        <button class="row-delete" data-id="${r.id}" title="Supprimer">✕</button>
      </div>
      <div class="bar-track"><div class="bar-fill" style="width:${r.percentage}%;background:${color}"></div></div>
    `;
    list.appendChild(li);
  });

  list.querySelectorAll(".bpct-input").forEach(input => {
    input.addEventListener("change", async () => {
      await api(`/api/compliance/${input.dataset.id}`, {
        method: "PATCH",
        body: JSON.stringify({ percentage: parseInt(input.value, 10) || 0 }),
      });
      await refreshAll();
    });
  });
  list.querySelectorAll(".row-delete").forEach(btn => {
    btn.addEventListener("click", async () => {
      await api(`/api/compliance/${btn.dataset.id}`, { method: "DELETE" });
      await refreshAll();
    });
  });
}

function wireComplianceForm() {
  const form = document.getElementById("compliance-form");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const payload = Object.fromEntries(fd.entries());
    try {
      await api("/api/compliance", { method: "POST", body: JSON.stringify(payload) });
      form.reset();
      form.hidden = true;
      await refreshAll();
    } catch (err) {
      alert(err.message);
    }
  });
}

// ---------- Overview / Remediation / Risk score ----------
async function loadOverview() {
  const data = await api("/api/overview");
  document.getElementById("overview-total").textContent = fmt(data.total);
  const segments = Object.entries(data.severity_counts).map(([name, value]) => ({ name, value, color: SEVERITY_COLORS[name] }));
  drawDonut("chart-overview", segments);

  const legend = document.getElementById("overview-legend");
  legend.innerHTML = "";
  segments.forEach(s => {
    const li = document.createElement("li");
    li.innerHTML = `<span class="dot" style="background:${s.color}"></span><span class="lname">${s.name}</span><span class="lvalue">${fmt(s.value)}</span>`;
    legend.appendChild(li);
  });
}

async function loadRemediation() {
  const data = await api("/api/remediation");
  document.getElementById("remediation-pct").textContent = data.percentage + "%";
  const segments = [
    { name: "Resolved", value: data.resolved, color: "#22c55e" },
    { name: "In Progress", value: data.in_progress, color: "#3b82f6" },
    { name: "Open", value: data.pending, color: "#4b5566" },
  ];
  drawDonut("chart-remediation", segments);

  const legend = document.getElementById("remediation-legend");
  legend.innerHTML = "";
  segments.forEach(s => {
    const li = document.createElement("li");
    li.innerHTML = `<span class="dot" style="background:${s.color}"></span><span class="lname">${s.name}</span><span class="lvalue">${fmt(s.value)}</span>`;
    legend.appendChild(li);
  });
}

async function loadRiskScore() {
  const data = await api("/api/risk-score");
  document.getElementById("risk-score-num").textContent = data.current.toFixed(1);
  document.getElementById("risk-score-level").textContent = data.level;
  const deltaEl = document.getElementById("risk-score-delta");
  const sign = data.delta > 0 ? "+" : "";
  deltaEl.querySelector("span").textContent = `${sign}${data.delta} vs 7 derniers jours`;
  deltaEl.className = "risk-delta " + (data.delta > 0 ? "up" : data.delta < 0 ? "down" : "");
  drawSparkline("chart-sparkline", data.trend.map(t => t.value));
  drawRiskTrend("chart-risktrend", data.trend);
}

// ---------- Misc ----------
function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

function updateNotifBadge(vulnCount) {
  document.getElementById("notif-badge").textContent = vulnCount;
}

function setTodayLabel() {
  const today = new Date();
  const label = today.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  document.getElementById("today-label").textContent = label;
}

async function refreshAll() {
  await Promise.all([
    loadOverview(),
    loadRemediation(),
    loadRiskScore(),
    loadAssetsSummary(),
    loadVulnerabilities(),
    loadAssetsAtRisk(),
    loadScans(),
    loadCompliance(),
  ]);
}

// ---------- Init ----------
document.addEventListener("DOMContentLoaded", () => {
  setTodayLabel();
  wireToggle("toggle-vuln-form", "vuln-form");
  wireToggle("toggle-asset-form", "asset-form");
  wireToggle("toggle-scan-form", "scan-form");
  wireToggle("toggle-compliance-form", "compliance-form");
  wireVulnForm();
  wireAssetForm();
  wireScanForm();
  wireComplianceForm();

  document.getElementById("export-btn").addEventListener("click", () => {
    window.print();
  });

  refreshAll();
});
