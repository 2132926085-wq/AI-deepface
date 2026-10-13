// 从现有 demo（js/app.js）抽出的纯函数，保持原逻辑不变；渲染层只调用、不修改。
export function supplier(db, id) {
  return db.suppliers.find(function (x) { return x.id === id; });
}
export function supplierName(db, id) {
  var s = supplier(db, id);
  return s ? s.name : "—";
}
// VM 可绑定多个供应商；兼容旧数据的单值 supplier_id
export function vmSupplierIds(u) {
  if (!u) return [];
  if (u.supplier_ids && u.supplier_ids.length) return u.supplier_ids.slice();
  if (u.supplier_id) return [u.supplier_id];
  return [];
}
export function vmSupplierNames(db, u) {
  return vmSupplierIds(u).map(function (id) {
    var s = supplier(db, id);
    return s ? s.name : null;
  }).filter(Boolean).join("、") || "—";
}
export function group(db, id) {
  return db.groups.find(function (x) { return x.id === id; });
}
export function project(db, id) {
  return db.projects.find(function (x) { return x.id === id; });
}
export function person(db, id) {
  return db.people.find(function (x) { return x.id === id; });
}
export function groupNames(db, ids) {
  return (ids || []).map(function (gid) { var g = group(db, gid); return g ? g.name : null; }).filter(Boolean).join("、") || "—";
}
export function personProjectIds(p) {
  if (!p) return [];
  if (p.project_ids && p.project_ids.length) return p.project_ids.slice();
  return p.project_id ? [p.project_id] : [];
}
export function personProjectNames(db, p) {
  return personProjectIds(p).map(function (pid) { var pr = project(db, pid); return pr ? pr.name : null; }).filter(Boolean).join("、") || "—";
}
export function groupsForProjects(db, ids) {
  var seen = [];
  (ids || []).forEach(function (pid) {
    var pr = project(db, pid);
    if (pr && pr.group_id && seen.indexOf(pr.group_id) < 0) seen.push(pr.group_id);
  });
  return seen;
}
export function supplierCodePrefix(db, supId) {
  var sup = supplier(db, supId);
  var code = sup && sup.code ? String(sup.code) : "";
  var parts = code.split("-");
  return (parts.length > 1 ? parts[parts.length - 1] : code).toUpperCase() || "X";
}
export function nextEmployeeCode(db, supId) {
  var prefix = supplierCodePrefix(db, supId);
  var max = 0;
  db.people.forEach(function (p) {
    if (p.supplier_id !== supId) return;
    var m = /^([A-Za-z]+)-(\d+)$/.exec(String(p.employee_code || "").trim());
    if (m && m[1].toUpperCase() === prefix) {
      var n = parseInt(m[2], 10);
      if (!isNaN(n) && n > max) max = n;
    }
  });
  return prefix + "-" + ("000" + (max + 1)).slice(-3);
}
export function photoCountText(p) {
  var n = p && p.photos ? p.photos.length : 0;
  return n ? n + " 张" : "未上传";
}
export function roleLabel(u) {
  if (!u) return "";
  if (u.role === "global_admin") return "全局管理员";
  if (u.role === "supplier_admin") return "供应商管理员";
  if (u.role === "vm") return "VM 账号";
  if (u.role === "terminal") return "终端账号";
  return u.role || "";
}
export function menus(u) {
  if (!u) return [];
  var role = u.role;
  var isGlobal = role === "global_admin";
  var isSup = role === "supplier_admin";
  var isVm = role === "vm";
  var isTerminal = role === "terminal";
  var m = [];
  m.push({ hash: "dashboard", label: isSup ? "欢迎" : "总览" });
  if (isGlobal || isVm) m.push({ hash: "board", label: "看板" });
  if (isTerminal) m.push({ hash: "clock", label: "人脸核验" });
  if (!isSup) m.push({ hash: "records", label: "人脸核验记录" });
  if (isGlobal) m.push({ hash: "suppliers", label: "供应商" });
  if (isGlobal) m.push({ hash: "groups", label: "项目组" });
  if (isVm) m.push({ hash: "groups", label: "项目组与项目" });
  if (isVm) m.push({ hash: "supplier", label: "供应商管理" });
  if (isGlobal || isSup) m.push({ hash: "projects", label: "项目管理" });
  if (isSup) m.push({ hash: "myvm", label: "对应VM" });
  if (isGlobal || isSup || isVm) m.push({ hash: "people", label: "人员库" });
  if (isGlobal) m.push({ hash: "users", label: "账号" });
  if (isGlobal) m.push({ hash: "ip", label: "IP管控" });
  if (isGlobal || isSup || isVm) m.push({ hash: "leave", label: "申请" });
  if (isGlobal || isVm) m.push({ hash: "audit", label: "审计日志" });
  return m;
}
export function defaultRoute(u) {
  return "dashboard";
}
export function route() {
  var r = (location.hash || "").replace(/^#\/?/, "");
  return r || "dashboard";
}
export function nav(hash) {
  location.hash = "#" + hash;
}
export function recordsScoped(db, session) {
  var all = db.records.slice();
  if (session.role === "global_admin") return all;
  if (session.role === "supplier_admin") return all.filter(function (r) { return r.supplier_id === session.supplier_id; });
  if (session.role === "terminal") return all.filter(function (r) { return r.terminal_id === session.id; });
  if (session.role === "vm") {
    return all.filter(function (r) {
      if (!r.person_id) return false;
      var p = db.people.find(function (x) { return x.id === r.person_id; });
      return p && (p.group_ids || []).some(function (g) { return (session.group_ids || []).indexOf(g) >= 0; });
    });
  }
  return [];
}
export function recordGroupNamesArr(r) {
  if (!r) return [];
  if (r.group_names && r.group_names.length) return r.group_names;
  if (r.group_name) return [r.group_name];
  return [];
}
export function recordProjectNamesArr(r) {
  if (!r) return [];
  if (r.project_names && r.project_names.length) return r.project_names;
  if (r.project_name) return [r.project_name];
  return [];
}
export function recordGroupNamesText(r) { var a = recordGroupNamesArr(r); return a.length ? a.join("、") : "—"; }
export function recordProjectNamesText(r) { var a = recordProjectNamesArr(r); return a.length ? a.join("、") : "—"; }
export function recordHasGroupName(r, name) { return !!name && recordGroupNamesArr(r).indexOf(name) >= 0; }
export function recordHasProjectName(r, name) { return !!name && recordProjectNamesArr(r).indexOf(name) >= 0; }
export function statusInfo(status) {
  if (status === "recognized") return { text: "已识别", color: "success" };
  if (status === "unknown") return { text: "未知人员", color: "warning" };
  if (status === "blocked") return { text: "IP 禁止", color: "error" };
  if (status === "missing") return { text: "未人脸核验", color: "default" };
  if (status === "inactive") return { text: "未激活 · 禁止人脸核验", color: "error" };
  return { text: "—", color: "default" };
}
export function ipInfo(r) {
  if (r.ip_check === "mismatch") return { text: "不一致", color: "error" };
  if (r.status === "blocked") return { text: "禁止", color: "error" };
  if (r.ip_check === "ok") return { text: "一致", color: "success" };
  return { text: "—", color: "default" };
}
export function consentInfo(p) {
  if (!p) return null;
  if (p.consent_status === "agreed") return { text: "已激活", color: "success" };
  return { text: "未激活", color: "default" };
}
export function personHasProject(p, prjId) {
  return !!prjId && personProjectIds(p).indexOf(prjId) >= 0;
}
export function personHasGroupName(db, p, name) {
  if (!name) return false;
  return (p.group_ids || []).some(function (gid) { var g = group(db, gid); return g && g.name === name; });
}
export function personHasProjectName(db, p, name) {
  if (!name) return false;
  return personProjectIds(p).some(function (pid) { var pr = project(db, pid); return pr && pr.name === name; });
}
export function boardScopePeople(db, session) {
  var list = db.people.filter(function (p) { return p.is_active; });
  if (session.role === "supplier_admin") list = list.filter(function (p) { return p.supplier_id === session.supplier_id; });
  if (session.role === "vm") list = list.filter(function (p) { return (p.group_ids || []).some(function (g) { return (session.group_ids || []).indexOf(g) >= 0; }); });
  return list;
}
export function boardFilteredPeople(db, session, f) {
  var list = boardScopePeople(db, session);
  if (f.sup) list = list.filter(function (p) { return p.supplier_id === f.sup; });
  if (f.grp) list = list.filter(function (p) { return (p.group_ids || []).indexOf(f.grp) >= 0; });
  if (f.prj) list = list.filter(function (p) { return personHasProject(p, f.prj); });
  return list;
}
// 项目组成员关系操作（沿用原 demo assignPersonToGroup 逻辑；直接修改 db 对象，调用方负责 persist）
export function assignPersonToGroup(db, p, gid, prjId) {
  if (!p || !gid) return;
  if (!p.group_ids) p.group_ids = [];
  if (p.group_ids.indexOf(gid) < 0) p.group_ids.push(gid);
  var pr = prjId ? db.projects.find(function (x) { return x.id === prjId && x.group_id === gid; }) : null;
  if (!pr) pr = db.projects.find(function (x) { return x.group_id === gid; });
  if (pr && personProjectIds(p).indexOf(pr.id) < 0) {
    if (!p.project_ids) p.project_ids = [];
    p.project_ids.push(pr.id);
    p.project_id = p.project_ids[0] || pr.id;
  }
}
export function removePersonFromGroup(db, p, gid) {
  if (!p || !gid) return;
  var grpPrjIds = db.projects.filter(function (pr) { return pr.group_id === gid; }).map(function (pr) { return pr.id; });
  p.group_ids = (p.group_ids || []).filter(function (g) { return g !== gid; });
  var prjIds = personProjectIds(p).filter(function (pid) { return grpPrjIds.indexOf(pid) < 0; });
  p.project_ids = prjIds;
  p.project_id = prjIds[0] || null;
}
export function removePersonFromProject(db, p, gid, prjId) {
  if (!p || !gid || !prjId) return;
  var prjIds = personProjectIds(p).filter(function (pid) { return pid !== prjId; });
  p.project_ids = prjIds;
  p.project_id = prjIds[0] || null;
  var grpPrjIds = db.projects.filter(function (pr) { return pr.group_id === gid; }).map(function (pr) { return pr.id; });
  var remaining = prjIds.filter(function (pid) { return grpPrjIds.indexOf(pid) >= 0; });
  if (remaining.length === 0) {
    p.group_ids = (p.group_ids || []).filter(function (g) { return g !== gid; });
  }
}
export function userScopeUsers(db, session) {
  if (session.role === "supplier_admin") return db.users.filter(function (u) { return u.supplier_id === session.supplier_id; });
  return db.users;
}
