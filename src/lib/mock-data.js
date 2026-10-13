/* ============================================================
 * FaceOps 集中人脸核验 Demo — Mock 数据层
 * 纯前端演示：所有数据保存在浏览器 localStorage，不接任何后端接口。
 * 刷新页面数据不丢；点「重置演示数据」可恢复出厂种子数据。
 * ============================================================ */
(function (global) {
  "use strict";

  var STORAGE_KEY = "face_clockin_demo_v4";

  /* ---------- 小工具 ---------- */
  function uid(prefix) {
    return prefix + "_" + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
  }
  function pad(n) { return n < 10 ? "0" + n : "" + n; }
  // 本地日期 YYYY-MM-DD（与服务器版 localDateString 口径一致）
  function localDateString(d) {
    d = d || new Date();
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  }
  function nowString() {
    var d = new Date();
    return localDateString(d) + " " + pad(d.getHours()) + ":" + pad(d.getMinutes()) + ":" + pad(d.getSeconds());
  }
  function addDays(dateStr, days) {
    var d = new Date(dateStr + "T00:00:00");
    d.setDate(d.getDate() + days);
    return localDateString(d);
  }
  function fmtDateTime(s) {
    if (!s) return "—";
    return s;
  }
  function fmtDate(s) {
    if (!s) return "—";
    return s.slice(0, 10);
  }
  // 某天已人脸核验人员集合（只有成功识别 recognized 才计为已人脸核验；missing/blocked 等不计入）
  function clockinSetForDay(db, day) {
    day = day || localDateString();
    var set = {};
    (db.records || []).forEach(function (r) {
      if (r.occurred_at && r.occurred_at.slice(0, 10) === day && r.status === "recognized" && r.person_id) {
        set[r.person_id] = true;
      }
    });
    return set;
  }
  // 今天已人脸核验人员集合
  function todaysClockinSet(db) {
    return clockinSetForDay(db, localDateString());
  }

  /* ---------- 演示占位照片 ---------- */
  // 纯前端 demo：用 SVG 生成的卡通头像 data URI 代替真实照片，正式环境由供应商上传 1-3 张真实照片
  function seedPhoto(name, hue) {
    var ch = (name || "?").slice(0, 1);
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160">' +
      '<rect width="160" height="160" fill="hsl(' + hue + ',42%,68%)"/>' +
      '<circle cx="80" cy="64" r="30" fill="#fff" opacity=".9"/>' +
      '<path d="M26 152c9-40 30-56 54-56s45 16 54 56z" fill="#fff" opacity=".9"/>' +
      '<text x="80" y="152" font-size="64" text-anchor="middle" fill="#334" font-family="sans-serif">' + ch + '</text></svg>';
    return "data:image/svg+xml;utf8," + encodeURIComponent(svg);
  }

  /* ---------- 种子数据 ---------- */
  function seed() {
    var suppliers = [
      { id: "sup_a", code: "SUP-A", name: "甲辰保洁服务", clock_mode: "centralized", is_active: true },
      { id: "sup_b", code: "SUP-B", name: "星辰安防科技", clock_mode: "centralized", is_active: true }
    ];
    var groups = [
      { id: "grp_1", name: "A园区项目组", is_active: true },
      { id: "grp_2", name: "B商务区项目组", is_active: true }
    ];
    var projects = [
      { id: "prj_a1", name: "园区一期保洁", supplier_id: "sup_a", group_id: "grp_1", leave_days: 7, is_active: true },
      { id: "prj_a2", name: "写字楼保洁", supplier_id: "sup_a", group_id: "grp_2", leave_days: 3, is_active: true },
      { id: "prj_b1", name: "园区一期安防", supplier_id: "sup_b", group_id: "grp_1", leave_days: 5, is_active: true }
    ];
    var people = [
      { id: "p1", name: "张三", employee_code: "A-001", supplier_id: "sup_a", project_id: "prj_a1", project_ids: ["prj_a1", "prj_a2"], photos: [seedPhoto("张三", 10), seedPhoto("张三", 130), seedPhoto("张三", 250)], group_ids: ["grp_1", "grp_2"], is_active: true, consent_status: "agreed", consent_at: nowString() },
      { id: "p2", name: "李四", employee_code: "A-002", supplier_id: "sup_a", project_id: "prj_a1", photos: [seedPhoto("李四", 190)], group_ids: ["grp_1"], is_active: true, consent_status: "agreed", consent_at: nowString() },
      { id: "p3", name: "王五", employee_code: "A-003", supplier_id: "sup_a", project_id: "prj_a2", photos: [seedPhoto("王五", 40), seedPhoto("王五", 210)], group_ids: ["grp_2"], is_active: true, consent_status: "pending", consent_at: null },
      { id: "p4", name: "赵六", employee_code: "A-004", supplier_id: "sup_a", project_id: "prj_a2", photos: [seedPhoto("赵六", 300)], group_ids: ["grp_2"], is_active: true, consent_status: "agreed", consent_at: nowString() },
      { id: "p5", name: "孙七", employee_code: "A-005", supplier_id: "sup_a", project_id: "prj_a1", group_ids: ["grp_1"], is_active: true, consent_status: "agreed", consent_at: nowString() },
      { id: "p6", name: "周八", employee_code: "A-006", supplier_id: "sup_a", project_id: "prj_a1", photos: [seedPhoto("周八", 80), seedPhoto("周八", 160)], group_ids: ["grp_1"], is_active: true, consent_status: "agreed", consent_at: nowString() },
      { id: "p7", name: "吴九", employee_code: "B-001", supplier_id: "sup_b", project_id: "prj_b1", photos: [seedPhoto("吴九", 330)], group_ids: ["grp_1"], is_active: true, consent_status: "agreed", consent_at: nowString() },
      { id: "p8", name: "郑十", employee_code: "B-002", supplier_id: "sup_b", project_id: null, project_ids: [], group_ids: [], is_active: true, consent_status: "pending", consent_at: null },
      { id: "p9", name: "钱十一", employee_code: "B-003", supplier_id: "sup_b", project_id: "prj_b1", photos: [seedPhoto("钱十一", 60)], group_ids: ["grp_1"], is_active: true, consent_status: "agreed", consent_at: nowString() },
{ id: "p10", name: "陈十二", employee_code: "A-007", supplier_id: "sup_a", project_id: "prj_a2", photos: [seedPhoto("陈十二", 20), seedPhoto("陈十二", 140), seedPhoto("陈十二", 260)], group_ids: ["grp_2"], is_active: true, consent_status: "agreed", consent_at: nowString() },
{ id: "p11", name: "林十三", employee_code: "A-008", supplier_id: "sup_a", project_id: "prj_a1", photos: [seedPhoto("林十三", 90), seedPhoto("林十三", 200)], group_ids: ["grp_1"], is_active: true, consent_status: "pending", consent_at: null },
{ id: "p12", name: "黄十四", employee_code: "B-004", supplier_id: "sup_b", project_id: "prj_b1", photos: [seedPhoto("黄十四", 270)], group_ids: ["grp_1"], is_active: true, consent_status: "agreed", consent_at: nowString() },
{ id: "p13", name: "何十五", employee_code: "B-005", supplier_id: "sup_b", project_id: "prj_b1", group_ids: ["grp_1"], is_active: true, consent_status: "pending", consent_at: null },
      { id: "p14", name: "刘十六", employee_code: "A-009", supplier_id: "sup_a", project_id: "prj_a2", photos: [seedPhoto("刘十六", 50), seedPhoto("刘十六", 230)], group_ids: ["grp_2"], is_active: true, consent_status: "pending", consent_at: null },
      { id: "p15", name: "周十七", employee_code: "B-006", supplier_id: "sup_b", project_id: "prj_b1", photos: [seedPhoto("周十七", 110)], group_ids: ["grp_1"], is_active: true, consent_status: "pending", consent_at: null }
    ];
    var users = [
      { id: "u_admin", username: "admin", password: "admin123", role: "global_admin", display_name: "系统管理员", supplier_id: null, group_ids: [], terminal_id: null, person_id: null, is_active: true, created_at: nowString(), last_login_at: null },
      { id: "u_vm", username: "vm_li", password: "vm123", role: "vm", display_name: "李主管（VM）", supplier_id: null, supplier_ids: ["sup_a"], group_ids: ["grp_1"], terminal_id: null, person_id: null, is_active: true, created_at: nowString(), last_login_at: null },
      { id: "u_sup_a", username: "sup_a_admin", password: "a123", role: "supplier_admin", display_name: "甲辰管理员", supplier_id: "sup_a", group_ids: [], terminal_id: null, person_id: null, is_active: true, created_at: nowString(), last_login_at: null },
      { id: "u_sup_b", username: "sup_b_admin", password: "b123", role: "supplier_admin", display_name: "星辰管理员", supplier_id: "sup_b", group_ids: [], terminal_id: null, person_id: null, is_active: true, created_at: nowString(), last_login_at: null },
      { id: "u_term_a1", username: "terminal_a1", password: "t123", role: "terminal", display_name: "一号门岗", supplier_id: "sup_a", group_ids: [], terminal_id: null, standard_ip: "192.168.1.10", person_id: null, is_active: true, created_at: nowString(), last_login_at: null },
      { id: "u_term_a2", username: "terminal_a2", password: "t123", role: "terminal", display_name: "二号门岗", supplier_id: "sup_a", group_ids: [], terminal_id: null, standard_ip: "192.168.1.11", person_id: null, is_active: true, created_at: nowString(), last_login_at: null },
      { id: "u_term_b1", username: "terminal_b1", password: "t123", role: "terminal", display_name: "南门岗", supplier_id: "sup_b", group_ids: [], terminal_id: null, standard_ip: "10.20.30.40", person_id: null, is_active: true, created_at: nowString(), last_login_at: null }
    ];
    var today = localDateString();
    var records = [
      { id: uid("rec"), person_id: "p1", person_name: "张三", supplier_id: "sup_a", supplier_name: "甲辰保洁服务", terminal_id: "u_term_a1", terminal_name: "一号门岗", group_name: "A园区项目组", group_names: ["A园区项目组", "B商务区项目组"], project_name: "园区一期保洁", project_names: ["园区一期保洁", "写字楼保洁"], project_ids: ["prj_a1", "prj_a2"], status: "recognized", ip_check: "ok", current_ip: "192.168.1.10", occurred_at: today + " 08:32:11", consent_pending: false },
      { id: uid("rec"), person_id: "p2", person_name: "李四", supplier_id: "sup_a", supplier_name: "甲辰保洁服务", terminal_id: "u_term_a1", terminal_name: "一号门岗", group_name: "A园区项目组", project_name: "园区一期保洁", status: "recognized", ip_check: "ok", current_ip: "192.168.1.10", occurred_at: today + " 08:33:05", consent_pending: false },
      { id: uid("rec"), person_id: "p4", person_name: "赵六", supplier_id: "sup_a", supplier_name: "甲辰保洁服务", terminal_id: "u_term_a2", terminal_name: "二号门岗", group_name: "B商务区项目组", project_name: "写字楼保洁", status: "recognized", ip_check: "ok", current_ip: "192.168.1.11", occurred_at: today + " 08:41:47", consent_pending: false },
      { id: uid("rec"), person_id: "p5", person_name: "孙七", supplier_id: "sup_a", supplier_name: "甲辰保洁服务", terminal_id: "u_term_a1", terminal_name: "一号门岗", group_name: "A园区项目组", project_name: "园区一期保洁", status: "recognized", ip_check: "ok", current_ip: "192.168.1.10", occurred_at: today + " 08:55:02", consent_pending: false },
      { id: uid("rec"), person_id: "p7", person_name: "吴九", supplier_id: "sup_b", supplier_name: "星辰安防科技", terminal_id: "u_term_b1", terminal_name: "南门岗", group_name: "A园区项目组", project_name: "园区一期安防", status: "recognized", ip_check: "ok", current_ip: "10.20.30.40", occurred_at: today + " 08:48:19", consent_pending: false },
      { id: uid("rec"), person_id: null, person_name: null, supplier_id: "sup_a", supplier_name: "甲辰保洁服务", terminal_id: "u_term_a1", terminal_name: "一号门岗", group_name: null, project_name: null, status: "unknown", ip_check: "ok", current_ip: "192.168.1.10", occurred_at: today + " 09:12:33", consent_pending: false },
      { id: uid("rec"), person_id: null, person_name: null, supplier_id: "sup_b", supplier_name: "星辰安防科技", terminal_id: "u_term_b1", terminal_name: "南门岗", group_name: null, project_name: null, status: "blocked", ip_check: "mismatch", current_ip: "172.16.0.99", occurred_at: today + " 09:20:00", consent_pending: false },
      { id: uid("rec"), person_id: "p3", person_name: "王五", supplier_id: "sup_a", supplier_name: "甲辰保洁服务", terminal_id: "u_term_a1", terminal_name: "一号门岗", group_name: "B商务区项目组", group_names: ["B商务区项目组"], project_name: "写字楼保洁", project_names: ["写字楼保洁"], project_ids: ["prj_a2"], status: "missing", ip_check: "ok", current_ip: "192.168.1.10", occurred_at: today + " 10:05:00", consent_pending: true },
      { id: uid("rec"), person_id: "p1", person_name: "张三", supplier_id: "sup_a", supplier_name: "甲辰保洁服务", terminal_id: "u_term_a1", terminal_name: "一号门岗", group_name: "A园区项目组", group_names: ["A园区项目组", "B商务区项目组"], project_name: "园区一期保洁", project_names: ["园区一期保洁", "写字楼保洁"], project_ids: ["prj_a1", "prj_a2"], status: "blocked", ip_check: "mismatch", current_ip: "172.16.0.99", occurred_at: addDays(today, -1) + " 09:15:00", consent_pending: false },
      { id: uid("rec"), person_id: "p1", person_name: "张三", supplier_id: "sup_a", supplier_name: "甲辰保洁服务", terminal_id: "u_term_a1", terminal_name: "一号门岗", group_name: "A园区项目组", group_names: ["A园区项目组", "B商务区项目组"], project_name: "园区一期保洁", project_names: ["园区一期保洁", "写字楼保洁"], project_ids: ["prj_a1", "prj_a2"], status: "recognized", ip_check: "ok", current_ip: "192.168.1.10", occurred_at: addDays(today, -2) + " 08:45:00", consent_pending: false }
    ];
    var applications = [
      { id: uid("app"), type: "join_group", status: "pending", person_id: "p8", person_name: "郑十", group_id: "grp_1", group_name: "A园区项目组", project_id: "prj_b1", project_name: "园区一期安防", apply_date: today, effective_date: today, leave_days: null, submitter: "星辰管理员", submitter_supplier: "星辰安防科技", note: "申请入项 A园区项目组支援安防工作", created_at: today + " 09:30:00", reviewed_at: null, reviewer: null },
      { id: uid("app"), type: "leave_project", status: "pending", person_id: "p3", person_name: "王五", group_id: null, group_name: null, project_id: "prj_a2", project_name: "写字楼保洁", apply_date: today, effective_date: addDays(today, 3), leave_days: 3, submitter: "甲辰管理员", submitter_supplier: "甲辰保洁服务", note: "合同到期申请离项", created_at: today + " 09:45:00", reviewed_at: null, reviewer: null }
    ];
    var audit = [
      { id: uid("aud"), time: today + " 09:45:00", operator: "甲辰管理员", role: "supplier_admin", action: "提交离项申请", detail: "王五 申请离开项目「写字楼保洁」（提前 3 天）" },
      { id: uid("aud"), time: today + " 09:30:00", operator: "星辰管理员", role: "supplier_admin", action: "提交入项申请", detail: "郑十 申请入项「A园区项目组」" },
      { id: uid("aud"), time: today + " 09:20:00", operator: "南门岗", role: "terminal", action: "人脸核验被禁止", detail: "IP 172.16.0.99 与标准 IP 10.20.30.40 不一致，禁止人脸核验" }
    ];
    return { suppliers: suppliers, groups: groups, projects: projects, people: people, users: users, records: records, applications: applications, audit: audit, meta: { demo: true } };
  }

    /* ---------- 存储 ---------- */
  var memory = null; // localStorage 不可用时退回内存

  // 始终返回独立副本：页面在副本上修改后必须 FaceStore.persist(db) 写回，
  // 避免“改的是副本、存的是旧 memory”导致刷新后数据丢失。
  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  function load() {
    if (memory) return clone(memory);
    try {
      var raw = global.localStorage.getItem(STORAGE_KEY);
      if (raw) return (memory = clone(JSON.parse(raw)));
    } catch (e) { /* 忽略 */ }
    memory = seed();
    return clone(memory);
  }
  function save(o) {
    var target = arguments.length > 0 ? o : (memory || load());
    memory = clone(target);
    try {
      global.localStorage.setItem(STORAGE_KEY, JSON.stringify(memory));
    } catch (e) { /* 内存模式 */ }
  }
  function reset() {
    memory = seed();
    save(memory);
    return clone(memory);
  }
  function persist(db) { save(db); }

  /* ---------- 审计留痕（需求 4.5：拉入/移出审批等操作留痕） ---------- */
  function auditLog(operator, role, action, detail) {
    var db = load();
    db.audit.unshift({ id: uid("aud"), time: nowString(), operator: operator || "—", role: role || "—", action: action, detail: detail || "" });
    save(db);
  }

  /* ---------- 导出 ---------- */
  global.FaceStore = {
    STORAGE_KEY: STORAGE_KEY,
    load: load,
    save: save,
    reset: reset,
    persist: persist,
    auditLog: auditLog,
    uid: uid,
    localDateString: localDateString,
    nowString: nowString,
    addDays: addDays,
    fmtDateTime: fmtDateTime,
    fmtDate: fmtDate,
    clockinSetForDay: clockinSetForDay,
    todaysClockinSet: todaysClockinSet
  };
})(typeof window !== "undefined" ? window : globalThis);
