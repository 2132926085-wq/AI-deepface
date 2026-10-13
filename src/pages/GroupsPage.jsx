import React, { useEffect, useMemo, useState } from "react";
import { App as AntApp, Avatar, Button, Calendar, Card, Form, Input, InputNumber, Modal, Select, Space, Table, Tag, Typography } from "antd";
import { PlusOutlined, ReloadOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import { ui } from "../lib/ui";
import {
  assignPersonToGroup, group, groupNames, person, personHasProject, personProjectNames,
  project, removePersonFromProject, supplier, supplierName
} from "../lib/helpers";

const { Title, Text } = Typography;

function PersonFace(props) {
  const p = props.p;
  if (p && p.photos && p.photos.length) {
    return <img src={p.photos[0]} alt={p.name || ""} style={{ width: props.small ? 36 : 40, height: props.small ? 36 : 40, borderRadius: 8, objectFit: "cover", flexShrink: 0 }} />;
  }
  return (
    <Avatar shape="square" size={props.small ? 36 : 40} style={{ background: "#e6f4ff", color: "#1677ff", fontWeight: 600, flexShrink: 0 }}>
      {String(p && p.name ? p.name : "?").slice(0, 1)}
    </Avatar>
  );
}

function MemberTable(props) {
  const { db, session, gid, prjId, members, refresh } = props;
  const { message, modal } = AntApp.useApp();

  function remove(p) {
    props.onRemove && props.onRemove(gid, p.id);
  }

  const columns = [
    {
      title: "人员", key: "person", width: 260,
      render: function (_, p) {
        return (
          <div
            className="person-row clickable"
            style={{ cursor: "pointer" }}
            onClick={function () { props.onOpenPerson(p.id); }}
            title="点击查看人脸核验记录"
          >
            <PersonFace p={p} small />
            <div className="info">
              <div className="name">{p.name}</div>
              <div className="sub">{groupNames(db, p.group_ids)}</div>
            </div>
            <span className="person-go">记录 ›</span>
          </div>
        );
      }
    },
    { title: "编号", dataIndex: "employee_code", width: 110 },
    { title: "供应商", key: "sup", width: 150, render: function (_, p) { return supplierName(db, p.supplier_id); } },
    { title: "项目名称", key: "prjs", render: function (_, p) { return personProjectNames(db, p); } },
    {
      title: "操作", key: "action", width: 90,
      render: function (_, p) { return <Button size="small" danger onClick={function () { remove(p); }}>移出</Button>; }
    }
  ];

  return (
    <Table
      rowKey="id"
      size="small"
      scroll={{ x: "max-content" }}
      columns={columns}
      dataSource={members}
      pagination={false}
      locale={{ emptyText: prjId ? "该项目下还没有成员。" : "该项目组还没有成员。" }}
    />
  );
}

function PersonDetail(props) {
  const { db, session, pid, refresh } = props;
  const { message } = AntApp.useApp();
  const today = window.FaceStore.localDateString();
  const [day, setDay] = useState(ui.personRec.date || today);
  const [month, setMonth] = useState(ui.personRec.month || (ui.personRec.date || today).slice(0, 7));
  const p = person(db, pid);
  if (!p) {
    return (
      <Card className="page-card"><div className="empty">人员不存在或已移除。</div></Card>
    );
  }

  const dayRecords = db.records.filter(function (r) {
    return r.person_id === pid && r.occurred_at && r.occurred_at.slice(0, 10) === day;
  }).sort(function (a, b) { return b.occurred_at.localeCompare(a.occurred_at); });

  function cellRender(date, info) {
    if (!info || info.type !== "date") return null;
    var ds = date.format("YYYY-MM-DD");
    var recs = db.records.filter(function (r) { return r.person_id === pid && r.occurred_at && r.occurred_at.slice(0, 10) === ds; });
    if (recs.length === 0) return null;
    var warn = recs.some(function (r) { return r.ip_check === "mismatch" || r.status === "inactive"; });
    return <div className="cal-dot" style={{ background: warn ? "#faad14" : "#1677ff" }} />;
  }

  const columns = [
    { title: "时间", dataIndex: "occurred_at", width: 170 },
    {
      title: "状态", key: "status", width: 130,
      render: function (_, r) {
        if (r.status === "recognized") return <Tag color="success">已识别</Tag>;
        if (r.status === "unknown") return <Tag color="warning">未知人员</Tag>;
        if (r.status === "blocked") return <Tag color="error">IP 禁止</Tag>;
        if (r.status === "missing") return <Tag>未人脸核验</Tag>;
        if (r.status === "inactive") return <Tag color="error">未激活 · 禁止人脸核验</Tag>;
        return <Tag>—</Tag>;
      }
    },
    { title: "项目组", key: "g", render: function (_, r) { return r.group_names && r.group_names.length ? r.group_names.join("、") : "—"; } },
    { title: "项目名称", key: "p", render: function (_, r) { return r.project_names && r.project_names.length ? r.project_names.join("、") : "—"; } },
    { title: "终端账号", dataIndex: "terminal_name", width: 120, render: function (v) { return v || "—"; } },
    {
      title: "IP校验", key: "ip", width: 90,
      render: function (_, r) {
        if (r.ip_check === "mismatch") return <Tag color="error">不一致</Tag>;
        if (r.status === "blocked") return <Tag color="error">禁止</Tag>;
        if (r.ip_check === "ok") return <Tag color="success">一致</Tag>;
        return <Tag>—</Tag>;
      }
    },
    { title: "当前IP", dataIndex: "current_ip", width: 130, render: function (v) { return v || "—"; } }
  ];

  return (
    <div>
      <Card className="page-card" style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div className="person-row">
            <PersonFace p={p} />
            <div className="info">
              <div className="name">{p.name} <Text type="secondary" style={{ fontWeight: 400, fontSize: 12 }}>{p.employee_code}</Text></div>
              <div className="sub">
                {supplierName(db, p.supplier_id)} · {groupNames(db, p.group_ids)} · {personProjectNames(db, p) === "—" ? "未分配项目" : personProjectNames(db, p)} · {p.consent_status === "agreed" ? <Tag color="success">已激活</Tag> : <Tag>未激活</Tag>}
              </div>
            </div>
          </div>
          <Button onClick={function () { ui.vmPerson = ""; props.onBack(); }}>返回成员列表</Button>
        </div>
      </Card>
      <Card className="page-card" style={{ marginBottom: 16 }} title="日历 · 按日期查看">
        <Text type="secondary" style={{ display: "block", fontSize: 12, marginBottom: 8 }}>
          当前选择：{day} · 蓝点=有人脸核验记录，黄点=IP异常或未激活 · 点击日期查看当天记录
        </Text>
        <Calendar
          fullscreen={false}
          value={dayjs(day)}
          onSelect={function (d) {
            var ds = d.format("YYYY-MM-DD");
            ui.personRec.date = ds;
            ui.personRec.month = ds.slice(0, 7);
            setDay(ds);
            setMonth(ds.slice(0, 7));
          }}
          onPanelChange={function (d) {
            var ym = d.format("YYYY-MM-DD").slice(0, 7);
            ui.personRec.month = ym;
            setMonth(ym);
          }}
          cellRender={cellRender}
        />
      </Card>
      <Card
        className="page-card"
        title={<div>{day}<Text type="secondary" style={{ fontSize: 12, marginLeft: 8 }}>共 {dayRecords.length} 条记录</Text></div>}
        extra={<Button size="small" icon={<ReloadOutlined />} onClick={refresh}>刷新</Button>}
      >
        <Table rowKey="id" size="small" scroll={{ x: "max-content" }} columns={columns} dataSource={dayRecords} pagination={false} locale={{ emptyText: "这一天没有人脸核验记录。" }} />
      </Card>
    </div>
  );
}

export default function GroupsPage(props) {
  const db = props.db;
  const session = props.session;
  const { message, modal } = AntApp.useApp();
  const isVm = session.role === "vm";
  const [form] = Form.useForm();
  const [tab, setTab] = useState(ui.vmTab);
  const [grp, setGrp] = useState(ui.vmGrp);
  const [prj, setPrj] = useState(ui.vmPrj);
  const [pid, setPid] = useState(ui.vmPerson);
  const [libGid, setLibGid] = useState(null);
  const [libPrj, setLibPrj] = useState(null);
  const [addPrjOpen, setAddPrjOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [addGrpOpen, setAddGrpOpen] = useState(false);
  const [renamePrj, setRenamePrj] = useState(null);
  const [daysPrj, setDaysPrj] = useState(null);
  const [renameGrp, setRenameGrp] = useState(null);
  const [bindGrp, setBindGrp] = useState(null);
  const [bindVmIds, setBindVmIds] = useState([]);
  const [removeOpen, setRemoveOpen] = useState(null);
  const [rmPid, setRmPid] = useState("");
  const [rmPrjId, setRmPrjId] = useState("");
  const [addPrjForm] = Form.useForm();
  const [libForm] = Form.useForm();
  const [libPerson, setLibPerson] = useState("");
  const [libSup, setLibSup] = useState("");

  useEffect(function () { setPid(ui.vmPerson); }, [db]);

  function refresh() { props.refresh(); }

  function openPerson(personId) {
    ui.vmPerson = personId;
    ui.personRec = { date: window.FaceStore.localDateString(), month: window.FaceStore.localDateString().slice(0, 7) };
    setPid(personId);
  }

  function goBack() {
    ui.vmPerson = "";
    setPid("");
  }

  function switchTab(t) {
    ui.vmTab = t;
    ui.vmPerson = "";
    setTab(t);
    setPid("");
  }

  function clickGroup(gid) {
    ui.vmTab = "people";
    ui.vmGrp = gid;
    ui.vmPrj = "";
    ui.vmPerson = "";
    setTab("people");
    setGrp(gid);
    setPrj("");
    setPid("");
  }

  function clickProject(prjId) {
    var pr = project(db, prjId);
    ui.vmTab = "people";
    ui.vmGrp = pr ? pr.group_id : "";
    ui.vmPrj = pr ? pr.id : "";
    ui.vmPerson = "";
    setTab("people");
    setGrp(pr ? pr.group_id : "");
    setPrj(pr ? pr.id : "");
    setPid("");
  }

  function createGroup(values) {
    db.groups.push({ id: window.FaceStore.uid("grp"), name: String(values.name || "").trim(), is_active: true });
    window.FaceStore.persist(db);
    window.FaceStore.auditLog(session.display_name || session.username, session.role, "创建项目组", "创建项目组「" + String(values.name || "").trim() + "」");
    message.success("项目组已创建");
    setAddGrpOpen(false);
    form.resetFields();
    refresh();
  }

  function saveRenameGrp() {
    var g = group(db, renameGrp.id);
    if (!g) { setRenameGrp(null); return; }
    var next = String(renameGrp.name || "").trim();
    var oldName = g.name;
    if (!next || next === oldName) { setRenameGrp(null); return; }
    g.name = next;
    window.FaceStore.persist(db);
    window.FaceStore.auditLog(session.display_name || session.username, session.role, "修改项目组", "项目组改名：原「" + oldName + "」改为「" + next + "」");
    message.success("项目组已改名");
    setRenameGrp(null);
    refresh();
  }

  function toggleGroup(g) {
    var action = g.is_active ? "停用" : "启用";
    modal.confirm({
      title: "确认" + action + "项目组「" + g.name + "」？",
      content: g.is_active ? "停用后该项目组不再可选，已有成员与记录保留。" : "启用后该项目组恢复可选。",
      okText: action,
      okButtonProps: { danger: g.is_active },
      cancelText: "取消",
      onOk: function () {
        g.is_active = !g.is_active;
        window.FaceStore.persist(db);
        window.FaceStore.auditLog(session.display_name || session.username, session.role, action + "项目组", "项目组「" + g.name + "」" + action);
        message.success("项目组已" + action);
        refresh();
      }
    });
  }

  const myGroups = useMemo(function () {
    return isVm ? session.group_ids.map(function (gid) { return group(db, gid); }).filter(Boolean) : [];
  }, [db, session, isVm]);

  const myProjects = useMemo(function () {
    return db.projects.filter(function (pr) { return pr.group_id && session.group_ids.indexOf(pr.group_id) >= 0; });
  }, [db, session]);

  function membersOf(gid, prjId) {
    return db.people.filter(function (p) {
      if (!p.is_active || (p.group_ids || []).indexOf(gid) < 0) return false;
      return !prjId || personHasProject(p, prjId);
    });
  }
  function addableOf(gid, prjId) {
    return db.people.filter(function (p) {
      if (!p.is_active) return false;
      if (prjId) return !personHasProject(p, prjId);
      var prjIds = db.projects.filter(function (pr) { return pr.group_id === gid && pr.is_active; }).map(function (pr) { return pr.id; });
      return !prjIds.some(function (pid) { return personHasProject(p, pid); });
    });
  }

  function openLib(gid, prjId) {
    setLibGid(gid);
    setLibPrj(prjId || null);
    setLibSup("");
    libForm.setFieldsValue({ sup: "", person: "" });
    setLibPerson("");
  }

  function libPrjOptions() {
    return db.projects.filter(function (pr) { return pr.group_id === libGid && pr.is_active !== false; })
      .map(function (pr) { return { label: pr.name, value: pr.id }; });
  }

  function removeProjectOptions(gid, p) {
    if (!p) return [];
    return db.projects.filter(function (pr) { return pr.group_id === gid && personHasProject(p, pr.id); })
      .map(function (pr) { return { label: pr.name, value: pr.id }; });
  }

  function removePersonOptions() {
    var ctx = removeOpen;
    if (!ctx) return [];
    return membersOf(ctx.gid, prj || null).map(function (p) {
      return { label: p.name + "（" + p.employee_code + " · " + supplierName(db, p.supplier_id) + "）", value: p.id };
    });
  }

  function openRemove(gid, pid) {
    var p = person(db, pid);
    var opts = removeProjectOptions(gid, p);
    var def = (prj && opts.some(function (o) { return o.value === prj; })) ? prj : (opts.length ? opts[0].value : "");
    setRemoveOpen({ gid: gid, pid: pid });
    setRmPid(pid);
    setRmPrjId(def);
  }

  function confirmRemove() {
    var ctx = removeOpen;
    if (!ctx) return;
    var p = person(db, rmPid);
    if (!p) { message.error("请选择人员"); return; }
    if (!rmPrjId) { message.error("请选择要移出的具体项目"); return; }
    var pr = project(db, rmPrjId);
    var prjName = pr ? pr.name : "";
    removePersonFromProject(db, p, ctx.gid, rmPrjId);
    window.FaceStore.persist(db);
    window.FaceStore.auditLog(session.display_name || session.username, session.role, "移出项目", p.name + " 从项目「" + prjName + "」移出");
    message.success(p.name + " 已从项目「" + prjName + "」移出");
    setRemoveOpen(null);
    if (ui.vmPerson === p.id) { ui.vmPerson = ""; setPid(""); }
    refresh();
  }

  function libPersonOptions() {
    var supId = libSup;
    var list = db.people.filter(function (p) { return p.is_active && (!libPrj || !personHasProject(p, libPrj)) && (!supId || p.supplier_id === supId); });
    return list.map(function (p) { return { label: p.name + "（" + p.employee_code + " · " + supplierName(db, p.supplier_id) + "）", value: p.id }; });
  }

  function libSupOptions() {
    var seen = [];
    db.people.forEach(function (p) {
      if (p.is_active && (!libPrj || !personHasProject(p, libPrj)) && seen.indexOf(p.supplier_id) < 0) seen.push(p.supplier_id);
    });
    return seen.map(function (id) { return { label: supplierName(db, id), value: id }; });
  }

  function libCount() {
    var supId = libSup;
    var list = db.people.filter(function (p) { return p.is_active && (!libPrj || !personHasProject(p, libPrj)) && (!supId || p.supplier_id === supId); });
    return list.length;
  }

  function libAddOne() {
    var p = person(db, libPerson);
    var g = group(db, libGid);
    if (!p) { message.error("请先选择人员"); return; }
    if (!libPrj) { message.error("请先选择要加入的具体项目"); return; }
    if (!project(db, libPrj)) { message.error("所选项目不存在或已停用"); return; }
    if (personHasProject(p, libPrj)) { message.error(p.name + " 已在项目「" + project(db, libPrj).name + "」中"); return; }
    assignPersonToGroup(db, p, libGid, libPrj);
    window.FaceStore.persist(db);
    window.FaceStore.auditLog(session.display_name || session.username, session.role, "加入项目组", p.name + " 加入项目组「" + g.name + "」" + (libPrj && project(db, libPrj) ? "· 项目「" + project(db, libPrj).name + "」" : "") + "（VM 从人员库加入）");
    message.success(p.name + " 已加入项目组");
    setLibGid(null);
    refresh();
  }

  function libAddAll() {
    var supId = libSup;
    var g = group(db, libGid);
    if (!supId) { message.error("请先选择供应商"); return; }
    if (!libPrj) { message.error("请先选择要加入的具体项目"); return; }
    var prjName = project(db, libPrj) ? project(db, libPrj).name : "";
    var targets = db.people.filter(function (p) { return p.is_active && p.supplier_id === supId && !personHasProject(p, libPrj); });
    if (targets.length === 0) { message.error("没有可加入的该供应商人员（全部已在该项目下）。"); return; }
    modal.confirm({
      title: "确认将 " + supplierName(db, supId) + " 的 " + targets.length + " 名未加入该项目人员一键加入「" + g.name + "」· 项目「" + prjName + "」？",
      okText: "一键加入",
      cancelText: "取消",
      onOk: function () {
        targets.forEach(function (p) { assignPersonToGroup(db, p, libGid, libPrj); });
        window.FaceStore.persist(db);
        window.FaceStore.auditLog(session.display_name || session.username, session.role, "加入项目组", "供应商「" + supplierName(db, supId) + "」" + targets.length + " 名人员一键加入项目组「" + g.name + "」" + (libPrj && project(db, libPrj) ? "· 项目「" + project(db, libPrj).name + "」" : "") + "（VM 从人员库加入）");
        message.success("已一键加入 " + targets.length + " 名人员");
        setLibGid(null);
        refresh();
      }
    });
  }

  function createProject(values) {
    var g = group(db, values.group_id);
    if (!g) return;
    db.projects.push({
      id: window.FaceStore.uid("prj"),
      name: String(values.name || "").trim(),
      supplier_id: null,
      group_id: g.id,
      leave_days: values.leave_days || 0,
      is_active: true
    });
    window.FaceStore.persist(db);
    window.FaceStore.auditLog(session.display_name || session.username, session.role, "创建项目名称", "创建项目「" + String(values.name || "").trim() + "」");
    message.success("项目名称已创建");
    setAddPrjOpen(false);
    addPrjForm.resetFields();
    refresh();
  }

  function saveRenamePrj() {
    var pr = project(db, renamePrj.id);
    var oldName = pr.name;
    var next = String(renamePrj.name || "").trim();
    if (!next || next === pr.name) { setRenamePrj(null); return; }
    pr.name = next;
    window.FaceStore.persist(db);
    window.FaceStore.auditLog(session.display_name || session.username, session.role, "修改项目名称", "项目「" + oldName + "」改名为「" + pr.name + "」");
    message.success("项目已改名");
    setRenamePrj(null);
    refresh();
  }

  function saveDaysPrj() {
    var pr = project(db, daysPrj.id);
    var n = parseInt(daysPrj.days, 10);
    if (isNaN(n) || n < 0) { message.error("请输入不小于 0 的整数"); return; }
    if (n === pr.leave_days) { setDaysPrj(null); return; }
    pr.leave_days = n;
    window.FaceStore.persist(db);
    window.FaceStore.auditLog(session.display_name || session.username, session.role, "修改项目", "项目「" + pr.name + "」离项申请时间改为申请日 + " + n + " 天");
    message.success("离项申请时间已修改");
    setDaysPrj(null);
    refresh();
  }

  function toggleProject(pr) {
    var action = pr.is_active ? "停用" : "启用";
    modal.confirm({
      title: "确认" + action + "项目「" + pr.name + "」？",
      content: pr.is_active ? "停用后该项目不再可用，已有成员与记录保留。" : "启用后该项目恢复可用。",
      okText: action,
      okButtonProps: { danger: pr.is_active },
      cancelText: "取消",
      onOk: function () {
        pr.is_active = !pr.is_active;
        window.FaceStore.persist(db);
        window.FaceStore.auditLog(session.display_name || session.username, session.role, action + "项目", "项目「" + pr.name + "」" + action);
        message.success("项目已" + action);
        refresh();
      }
    });
  }

  const manageColumns = [
    { title: "项目", dataIndex: "name", width: 180 },
    { title: "所属项目组", key: "g", width: 150, render: function (_, pr) { var g = group(db, pr.group_id); return g ? g.name : "—"; } },
    { title: "供应商", key: "sup", width: 140, render: function (_, pr) { return supplierName(db, pr.supplier_id); } },
    { title: "离项申请时间", key: "days", width: 130, render: function (_, pr) { return "申请日 + " + pr.leave_days + " 天"; } },
    {
      title: "人员", key: "cnt", width: 80,
      render: function (_, pr) { return db.people.filter(function (p) { return personHasProject(p, pr.id) && p.is_active; }).length + " 人"; }
    },
    { title: "状态", key: "st", width: 90, render: function (_, pr) { return pr.is_active ? <Tag color="success">启用</Tag> : <Tag>已停用</Tag>; } },
    {
      title: "操作", key: "action", width: 230,
      render: function (_, pr) {
        return (
          <Space size={4}>
            <Button size="small" onClick={function () { setRenamePrj({ id: pr.id, name: pr.name }); }}>改名</Button>
            <Button size="small" onClick={function () { setDaysPrj({ id: pr.id, days: String(pr.leave_days) }); }}>修改离项申请时间</Button>
            <Button size="small" danger={pr.is_active} onClick={function () { toggleProject(pr); }}>{pr.is_active ? "停用" : "启用"}</Button>
          </Space>
        );
      }
    }
  ];

  // ---------- VM 渲染 ----------
  if (isVm) {
    if (!session.group_ids || session.group_ids.length === 0) {
      return (
        <div>
          <div className="topbar">
            <div>
              <div className="eyebrow">Project groups</div>
              <Title level={3} style={{ margin: 0 }}>项目组与项目</Title>
              <Text type="secondary" style={{ display: "block", marginTop: 4 }}>
                「总览」可点击项目组 / 项目跳转到「具体人员」查看成员；「具体人员」页签按项目组 / 项目筛选，点击人员可查看其人脸核验记录。
              </Text>
            </div>
          </div>
          <Card className="page-card"><div className="empty">你的账号还没有绑定任何项目组，请联系全局管理员绑定。</div></Card>
        </div>
      );
    }

    return (
      <div>
        <div className="topbar">
          <div>
            <div className="eyebrow">Project groups</div>
            <Title level={3} style={{ margin: 0 }}>项目组与项目</Title>
            <Text type="secondary" style={{ display: "block", marginTop: 4 }}>
              「总览」可点击项目组 / 项目跳转到「具体人员」查看成员；「具体人员」页签按项目组 / 项目筛选，点击人员可查看其人脸核验记录（下拉 + 日历选日期）。
            </Text>
          </div>
        </div>

        <Card className="page-card" style={{ padding: 0, marginTop: 4 }}>
          <div style={{ display: "flex", gap: 8, padding: 12 }}>
            <Button type={tab !== "people" ? "primary" : "default"} onClick={function () { switchTab("overview"); }}>总览</Button>
            <Button type={tab === "people" ? "primary" : "default"} onClick={function () { switchTab("people"); }}>具体人员</Button>
          </div>
        </Card>

        {tab === "people" ? (
          <Card className="page-card" style={{ marginTop: 16 }}>
            <Space wrap style={{ marginBottom: 8 }}>
              <div>
                <div className="filter-label">项目组</div>
                <Select
                  style={{ width: 200 }}
                  value={grp || ""}
                  onChange={function (v) { ui.vmGrp = v || ""; setGrp(v || ""); ui.vmPrj = ""; setPrj(""); ui.vmPerson = ""; setPid(""); }}
                  options={[{ label: "全部项目组", value: "" }].concat(myGroups.map(function (g) { return { label: g.name, value: g.id }; }))}
                />
              </div>
              <div>
                <div className="filter-label">项目名称</div>
                <Select
                  style={{ width: 220 }}
                  value={prj || ""}
                  onChange={function (v) { ui.vmPrj = v || ""; setPrj(v || ""); ui.vmPerson = ""; setPid(""); }}
                  options={[{ label: "全部项目", value: "" }].concat(
                    db.projects.filter(function (pr) { return pr.is_active && pr.group_id && session.group_ids.indexOf(pr.group_id) >= 0 && (!grp || pr.group_id === grp); })
                      .map(function (pr) { return { label: pr.name, value: pr.id }; })
                  )}
                />
              </div>
              <Text type="secondary" style={{ fontSize: 12, alignSelf: "flex-end", paddingBottom: 2 }}>按项目组 / 项目筛选下方成员；点击成员可查看该人员的人脸核验记录（下拉 + 日历选日期）。</Text>
            </Space>
          </Card>
        ) : null}

        {tab === "overview" ? (
          <Card
            className="page-card"
            style={{ marginTop: 16 }}
            title={<div>项目组与项目总览<Text type="secondary" style={{ fontSize: 12, marginLeft: 8, fontWeight: 400 }}>你负责的项目组及其包含的项目（此处不显示具体人员）；点击项目组或项目跳转到「具体人员」查看成员；添加项目在所选项目组下新建；「管理项目」可改名、修改离项申请时间（离项提前天数）、启用/停用。</Text></div>}
            extra={
              <Space>
                <Button type="primary" icon={<PlusOutlined />} onClick={function () { setAddPrjOpen(true); }}>添加项目</Button>
                <Button onClick={function () { setManageOpen(true); }}>管理项目</Button>
              </Space>
            }
          >
            <div className="vm-ov">
              {myGroups.map(function (g) {
                var projects = db.projects.filter(function (pr) { return pr.group_id === g.id && pr.is_active; });
                return (
                  <div className="vm-ov-row" key={g.id}>
                    <button className="vm-ov-gbtn" onClick={function () { clickGroup(g.id); }} title="点击查看该项目组人员">
                      <div className="vm-ov-gname">{g.name}</div>
                      <div className="small">项目 {projects.length} 个 · 点击查看人员</div>
                    </button>
                    <div className="vm-ov-prjs">
                      {projects.length === 0 ? <span className="vm-ov-empty">暂无项目</span> : projects.map(function (pr) {
                        return (
                          <button className="vm-ov-prj" key={pr.id} onClick={function () { clickProject(pr.id); }} title="点击查看该项目人员">
                            <b>{pr.name}</b>
                            <span className="small">离项提前 {pr.leave_days} 天 · 点击查看人员</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        ) : pid ? (
          <PersonDetail db={db} session={session} pid={pid} refresh={refresh} onBack={goBack} />
        ) : (
          <div>
            {myGroups.map(function (g) {
              if (grp && grp !== g.id) return null;
              var members = membersOf(g.id, prj || null);
              var addable = addableOf(g.id, prj || null);
              var scope = prj && project(db, prj) ? " · 项目：" + project(db, prj).name : "";
              return (
                <Card
                  className="page-card"
                  key={g.id}
                  style={{ marginBottom: 16 }}
                  title={<div>{g.name}<Text type="secondary" style={{ fontSize: 12, marginLeft: 8, fontWeight: 400 }}>成员 {members.length} 人 · 可加入 {addable.length} 人 · 点击人员查看人脸核验记录{scope}</Text></div>}
                  extra={<Button size="small" onClick={function () { openLib(g.id, prj || null); }}>从人员库加入</Button>}
                >
                  <MemberTable db={db} session={session} gid={g.id} prjId={prj || null} members={members} refresh={refresh} onOpenPerson={openPerson} onPersonClear={goBack} onRemove={openRemove} />
                </Card>
              );
            })}
            {!grp && myGroups.length === 0 ? <Card className="page-card"><div className="empty">没有匹配的项目组。</div></Card> : null}
            {grp && !myGroups.some(function (g) { return g.id === grp; }) ? <Card className="page-card"><div className="empty">没有匹配的项目组。</div></Card> : null}
          </div>
        )}

        {/* 从人员库加入 */}
        <Modal
          open={!!libGid}
          title={"从人员库加入" + (libGid && group(db, libGid) ? "「" + group(db, libGid).name + "」" : "") + (libPrj && project(db, libPrj) ? " · 项目「" + project(db, libPrj).name + "」" : "")}
          footer={null}
          onCancel={function () { setLibGid(null); }}
          destroyOnClose
        >
          <Text type="secondary" style={{ display: "block", marginBottom: 12 }}>
            {libPrj && project(db, libPrj) ? "将人员加入指定项目「" + project(db, libPrj).name + "」（项目组「" + (libGid && group(db, libGid) ? group(db, libGid).name : "") + "」）：请先确认项目，再按供应商筛选人员；无需审批，操作写入审计日志。" : "将人员库中的人员加入项目组「" + (libGid && group(db, libGid) ? group(db, libGid).name : "") + "」：请先选择要加入的具体项目，再按供应商筛选人员；无需审批，操作写入审计日志。"}
          </Text>
          <Form form={libForm} layout="vertical">
            <div style={{ marginBottom: 16 }}>
              <div className="filter-label">项目 *</div>
              <Select
                value={libPrj || ""}
                placeholder="请选择具体项目"
                style={{ width: "100%" }}
                options={[{ label: "请选择项目", value: "" }].concat(libPrjOptions())}
                onChange={function (v) { setLibPrj(v || null); setLibPerson(""); libForm.setFieldsValue({ person: "" }); }}
              />
            </div>
            <Form.Item name="sup" label="供应商">
              <Select
                options={[{ label: "全部供应商", value: "" }].concat(libSupOptions())}
                onChange={function (v) { setLibSup(v || ""); setLibPerson(""); libForm.setFieldsValue({ person: "" }); }}
              />
            </Form.Item>
            <Form.Item name="person" label="人员">
              <Select
                value={libPerson}
                onChange={setLibPerson}
                options={[{ label: "请选择人员", value: "" }].concat(libPersonOptions())}
              />
            </Form.Item>
          </Form>
          {libPrjOptions().length === 0 ? (
            <Text type="warning" style={{ display: "block", fontSize: 12, marginBottom: 12 }}>该项目组下还没有可用项目，请先在「总览」中添加项目。</Text>
          ) : (
            <Text type="secondary" style={{ display: "block", fontSize: 12, marginBottom: 12 }}>{libCount() > 0 ? "当前可选 " + libCount() + " 名未加入该项目的人员" : "当前没有可加入的人员"}</Text>
          )}
          <Space>
            <Button type="primary" onClick={libAddOne}>加入选中人员</Button>
            <Button onClick={libAddAll}>一键添加该供应商全部人员</Button>
            <Button onClick={function () { setLibGid(null); }}>取消</Button>
          </Space>
        </Modal>

        {/* 移出人员（按具体项目） */}
        <Modal
          open={!!removeOpen}
          title="移出人员（按具体项目）"
          okText="移出"
          okButtonProps={{ danger: true }}
          cancelText="取消"
          onOk={confirmRemove}
          onCancel={function () { setRemoveOpen(null); }}
          destroyOnClose
        >
          <Text type="secondary" style={{ display: "block", marginBottom: 12 }}>
            选择要移出的人员和具体项目：只从所选项目移出；若该人员在该项目组下不再有其他项目，会同时移出项目组。无需审批，操作写入审计日志。
          </Text>
          <Form layout="vertical">
            <Form.Item label="人员" required>
              <Select
                value={rmPid}
                onChange={function (v) {
                  setRmPid(v);
                  var opts = removeProjectOptions(removeOpen ? removeOpen.gid : "", person(db, v));
                  setRmPrjId(opts.length ? opts[0].value : "");
                }}
                options={[{ label: "请选择人员", value: "" }].concat(removePersonOptions())}
              />
            </Form.Item>
            <Form.Item label="项目组" required>
              <Select
                value={removeOpen ? removeOpen.gid : ""}
                options={removeOpen && group(db, removeOpen.gid) ? [{ label: group(db, removeOpen.gid).name, value: removeOpen.gid }] : []}
                disabled
              />
            </Form.Item>
            <Form.Item label="项目" required>
              <Select
                value={rmPrjId}
                onChange={setRmPrjId}
                options={[{ label: "请选择具体项目", value: "" }].concat(removeProjectOptions(removeOpen ? removeOpen.gid : "", person(db, rmPid)))}
              />
            </Form.Item>
          </Form>
        </Modal>

        {/* 添加项目 */}
        <Modal
          open={addPrjOpen}
          title="添加项目"
          okText="创建项目名称"
          cancelText="取消"
          onOk={function () { addPrjForm.submit(); }}
          onCancel={function () { setAddPrjOpen(false); }}
          destroyOnClose
        >
          <Form form={addPrjForm} layout="vertical" onFinish={createProject}>
            <Form.Item name="group_id" label="所属项目组" rules={[{ required: true, message: "请选择项目组" }]}>
              <Select
                options={myGroups.map(function (g) { return { label: g.name, value: g.id }; })}
                placeholder="请选择项目组"
              />
            </Form.Item>
            <Form.Item name="name" label="项目名称" rules={[{ required: true, message: "请输入项目名称" }]}>
              <Input placeholder="如 园区一期保洁" />
            </Form.Item>
            <Form.Item name="leave_days" label="离项提前天数（离项申请生效日 = 申请日 + 该天数）" initialValue={7}>
              <InputNumber min={0} style={{ width: "100%" }} />
            </Form.Item>
            <Text type="secondary" style={{ fontSize: 12 }}>只列你负责的项目组；新增项目不绑定供应商。</Text>
          </Form>
        </Modal>

        {/* 管理项目 */}
        <Modal
          open={manageOpen}
          title="管理项目"
          width={980}
          footer={null}
          onCancel={function () { setManageOpen(false); }}
          destroyOnClose
        >
          <Table rowKey="id" size="small" scroll={{ x: "max-content" }} columns={manageColumns} dataSource={myProjects} pagination={false} />
        </Modal>

        {/* 改名 */}
        <Modal
          open={!!renamePrj}
          title="修改项目名称"
          okText="保存"
          cancelText="取消"
          onOk={saveRenamePrj}
          onCancel={function () { setRenamePrj(null); }}
          destroyOnClose
        >
          <Text style={{ display: "block", marginBottom: 8 }}>新的项目名称：</Text>
          <Input value={renamePrj ? renamePrj.name : ""} onChange={function (e) { setRenamePrj({ id: renamePrj.id, name: e.target.value }); }} />
        </Modal>

        {/* 修改离项申请时间 */}
        <Modal
          open={!!daysPrj}
          title="修改离项申请时间"
          okText="保存"
          cancelText="取消"
          onOk={saveDaysPrj}
          onCancel={function () { setDaysPrj(null); }}
          destroyOnClose
        >
          {daysPrj ? (
            <div>
              <Text style={{ display: "block", marginBottom: 8 }}>项目「{project(db, daysPrj.id) ? project(db, daysPrj.id).name : ""}」当前为「申请日 + {project(db, daysPrj.id) ? project(db, daysPrj.id).leave_days : 0} 天」（离项提前天数）。请输入新的提前天数：</Text>
              <InputNumber min={0} value={parseInt(daysPrj.days, 10)} onChange={function (v) { setDaysPrj({ id: daysPrj.id, days: String(v == null ? "" : v) }); }} style={{ width: "100%" }} />
            </div>
          ) : null}
        </Modal>
      </div>
    );
  }

  // ---------- VM 绑定（全局管理员） ----------
  function boundVms(g) {
    return db.users.filter(function (u) { return u.role === "vm" && (u.group_ids || []).indexOf(g.id) >= 0; });
  }

  function openBindVm(g) {
    setBindGrp(g);
    setBindVmIds(boundVms(g).filter(function (u) { return u.is_active; }).map(function (u) { return u.id; }));
  }

  function saveBindVm() {
    var g = bindGrp ? group(db, bindGrp.id) : null;
    if (!g) { setBindGrp(null); return; }
    var activeVms = db.users.filter(function (u) { return u.role === "vm" && u.is_active; });
    activeVms.forEach(function (u) {
      if (!u.group_ids) u.group_ids = [];
      var idx = u.group_ids.indexOf(g.id);
      var selected = bindVmIds.indexOf(u.id) >= 0;
      if (selected && idx < 0) u.group_ids.push(g.id);
      if (!selected && idx >= 0) u.group_ids.splice(idx, 1);
    });
    var names = db.users.filter(function (u) { return bindVmIds.indexOf(u.id) >= 0; })
      .map(function (u) { return u.display_name || u.username; })
      .join("、") || "无";
    window.FaceStore.persist(db);
    window.FaceStore.auditLog(session.display_name || session.username, session.role, "绑定VM", "项目组「" + g.name + "」绑定 VM：" + names);
    message.success("已更新项目组「" + g.name + "」的绑定 VM");
    setBindGrp(null);
    refresh();
  }

  // ---------- 全局管理员渲染 ----------
  const groupRows = db.groups.map(function (g) {
    return {
      g: g,
      count: db.people.filter(function (p) { return (p.group_ids || []).indexOf(g.id) >= 0 && p.is_active; }).length
    };
  });

  const groupColumns = [
    { title: "名称", dataIndex: ["g", "name"], width: 200, render: function (v) { return <b>{v}</b>; } },
    { title: "成员", dataIndex: "count", width: 100, render: function (v) { return v + " 人"; } },
    {
      title: "已绑定VM", key: "vms", width: 240,
      render: function (_, r) {
        var list = boundVms(r.g);
        if (!list.length) return <Text type="secondary">—</Text>;
        return (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {list.map(function (u) {
              return u.is_active
                ? <Tag key={u.id} color="blue">{u.display_name || u.username}</Tag>
                : <Tag key={u.id}>{u.display_name || u.username}（停用）</Tag>;
            })}
          </div>
        );
      }
    },
    {
      title: "状态", dataIndex: ["g", "is_active"], width: 100,
      render: function (v) { return v ? <Tag color="success">启用</Tag> : <Tag>已停用</Tag>; }
    },
    {
      title: "操作", key: "action", width: 260,
      render: function (_, r) {
        return (
          <Space size={4}>
            <Button size="small" onClick={function () { openBindVm(r.g); }}>绑定VM</Button>
            <Button size="small" onClick={function () { setRenameGrp({ id: r.g.id, name: r.g.name }); }}>改名</Button>
            <Button size="small" danger={r.g.is_active} onClick={function () { toggleGroup(r.g); }}>{r.g.is_active ? "停用" : "启用"}</Button>
          </Space>
        );
      }
    }
  ];

  return (
    <div>
      <div className="topbar">
        <div>
          <div className="eyebrow">Project groups</div>
          <Title level={3} style={{ margin: 0 }}>项目组</Title>
          <Text type="secondary" style={{ display: "block", marginTop: 4 }}>
            全局管理员创建项目组；供应商发起入项需要对应 VM 审批。项目组不归属供应商。
          </Text>
        </div>
        <Space>
          <Button type="primary" icon={<PlusOutlined />} onClick={function () { setAddGrpOpen(true); }}>新增项目组</Button>
          <Button icon={<ReloadOutlined />} onClick={refresh}>刷新</Button>
        </Space>
      </div>

      <div style={{ marginTop: 16 }}>
        <Card
          className="page-card"
          style={{ marginTop: 0 }}
          title={<div>项目组列表<Text type="secondary" style={{ fontSize: 12, marginLeft: 8 }}>共 {db.groups.length} 个</Text></div>}
        >
          <Table rowKey={function (r) { return r.g.id; }} scroll={{ x: "max-content" }} columns={groupColumns} dataSource={groupRows} pagination={false} />
        </Card>
      </div>

      <Modal
        open={addGrpOpen}
        title="新增项目组"
        footer={null}
        onCancel={function () { setAddGrpOpen(false); }}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={createGroup}>
          <Form.Item name="name" label="项目组名称" rules={[{ required: true, message: "请输入项目组名称" }]}>
            <Input placeholder="如 A园区项目组" />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0 }}>
            <Button type="primary" htmlType="submit" icon={<PlusOutlined />}>创建项目组</Button>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        open={!!bindGrp}
        title={bindGrp ? "绑定VM · 项目组「" + bindGrp.name + "」" : "绑定VM"}
        okText="保存"
        cancelText="取消"
        onOk={saveBindVm}
        onCancel={function () { setBindGrp(null); }}
        destroyOnClose
      >
        <Text type="secondary" style={{ display: "block", marginBottom: 12 }}>
          选择可查看该项目组记录（看板、人脸核验记录、项目组与项目）的 VM 账号；支持多选，取消勾选即解除绑定。
        </Text>
        <Select
          mode="multiple"
          style={{ width: "100%" }}
          placeholder="请选择要绑定的 VM 账号"
          value={bindVmIds}
          onChange={setBindVmIds}
          options={db.users.filter(function (u) { return u.role === "vm" && u.is_active; })
            .map(function (u) { return { label: u.display_name || u.username, value: u.id }; })}
        />
      </Modal>

      <Modal
        open={!!renameGrp}
        title="修改项目组名称"
        okText="保存"
        cancelText="取消"
        onOk={saveRenameGrp}
        onCancel={function () { setRenameGrp(null); }}
        destroyOnClose
      >
        <Text style={{ display: "block", marginBottom: 8 }}>新的项目组名称：</Text>
        <Input value={renameGrp ? renameGrp.name : ""} onChange={function (e) { setRenameGrp({ id: renameGrp.id, name: e.target.value }); }} />
      </Modal>
    </div>
  );
}
