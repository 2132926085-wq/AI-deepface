import React, { useMemo, useState } from "react";
import { App as AntApp, Button, Calendar, Card, Col, Row, Select, Space, Table, Tag, Typography } from "antd";
import { ReloadOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import { ui } from "../lib/ui";
import {
  consentInfo, group, groupNames, ipInfo, personHasGroupName, personHasProjectName, personProjectNames,
  recordGroupNamesArr, recordGroupNamesText, recordHasGroupName, recordHasProjectName,
  recordProjectNamesArr, recordProjectNamesText, recordsScoped, statusInfo, supplierName
} from "../lib/helpers";

const { Title, Text } = Typography;

export default function RecordsPage(props) {
  const db = props.db;
  const session = props.session;
  const { message } = AntApp.useApp();
  const today = window.FaceStore.localDateString();
  const [day, setDay] = useState(ui.rec.date || today);
  const [sup, setSup] = useState(ui.rec.sup);
  const [grp, setGrp] = useState(ui.rec.grp);
  const [prj, setPrj] = useState(ui.rec.prj);
  const [tab, setTab] = useState(ui.rec.tab || "done");

  const isTerm = session.role === "terminal";
  const isVm = session.role === "vm";
  const isGlobal = session.role === "global_admin";
  const hasTabs = isTerm || isVm || isGlobal;

  const scoped = useMemo(function () { return recordsScoped(db, session); }, [db, session]);

  const supOptions = useMemo(function () {
    var seen = [];
    if (isGlobal || session.role === "vm") {
      db.suppliers.forEach(function (s) { if (s.id && seen.indexOf(s.id) < 0) seen.push(s.id); });
    } else {
      scoped.forEach(function (r) { if (r.supplier_id && seen.indexOf(r.supplier_id) < 0) seen.push(r.supplier_id); });
    }
    return seen.map(function (id) { return { label: supplierName(db, id), value: id }; });
  }, [scoped, db, session, isGlobal]);

  const grpOptions = useMemo(function () {
    var seen = [];
    if (isGlobal) {
      db.groups.forEach(function (g) { if (g && seen.indexOf(g.name) < 0) seen.push(g.name); });
    } else if (isVm) {
      (session.group_ids || []).forEach(function (gid) {
        var g = group(db, gid);
        if (g && g.is_active !== false && seen.indexOf(g.name) < 0) seen.push(g.name);
      });
    } else {
      scoped.forEach(function (r) { recordGroupNamesArr(r).forEach(function (n) { if (n && seen.indexOf(n) < 0) seen.push(n); }); });
    }
    return seen.map(function (n) { return { label: n, value: n }; });
  }, [scoped, db, session, isVm, isGlobal]);

  const prjOptions = useMemo(function () {
    var seen = [];
    if (isGlobal) {
      db.projects.forEach(function (pr) { if (pr && seen.indexOf(pr.name) < 0) seen.push(pr.name); });
    } else if (isVm) {
      var gids = session.group_ids || [];
      var grpObj = grp ? (db.groups.find(function (g) { return g && g.name === grp; }) || null) : null;
      db.projects.forEach(function (pr) {
        if (pr.is_active === false) return;
        var inScope = grpObj ? (pr.group_id === grpObj.id) : (gids.indexOf(pr.group_id) >= 0);
        if (inScope && seen.indexOf(pr.name) < 0) seen.push(pr.name);
      });
    } else {
      scoped.forEach(function (r) { recordProjectNamesArr(r).forEach(function (n) { if (n && seen.indexOf(n) < 0) seen.push(n); }); });
    }
    return seen.map(function (n) { return { label: n, value: n }; });
  }, [scoped, db, session, grp, isVm, isGlobal]);

  const dayRecords = useMemo(function () {
    return scoped.filter(function (r) {
      if (!r.occurred_at || r.occurred_at.slice(0, 10) !== day) return false;
      if (sup && r.supplier_id !== sup) return false;
      if (grp && !recordHasGroupName(r, grp)) return false;
      if (prj && !recordHasProjectName(r, prj)) return false;
      return true;
    }).sort(function (a, b) { return b.occurred_at.localeCompare(a.occurred_at); });
  }, [scoped, day, sup, grp, prj]);

  const anomalyRecords = dayRecords.filter(function (r) {
    return r.status === "unknown" || r.status === "blocked" || r.status === "inactive";
  });
  const tableRecords = (hasTabs && tab === "done")
    ? dayRecords.filter(function (r) { return r.status === "recognized"; })
    : dayRecords;

  const missingPeople = useMemo(function () {
    if (!hasTabs || tab !== "missing") return [];
    var clockin = window.FaceStore.clockinSetForDay(db, day);
    var list = db.people.filter(function (p) { return p.is_active; });
    if (isTerm) list = list.filter(function (p) { return p.supplier_id === session.supplier_id; });
    if (isVm) list = list.filter(function (p) { return (p.group_ids || []).some(function (g) { return (session.group_ids || []).indexOf(g) >= 0; }); });
    list = list.filter(function (p) { return !clockin[p.id]; });
    if (sup) list = list.filter(function (p) { return p.supplier_id === sup; });
    if (grp) list = list.filter(function (p) { return personHasGroupName(db, p, grp); });
    if (prj) list = list.filter(function (p) { return personHasProjectName(db, p, prj); });
    return list;
  }, [db, session, day, sup, grp, prj, hasTabs, tab, isTerm, isVm]);

  function changeSup(v) { setSup(v); ui.rec.sup = v; }
  function changeGrp(v) {
    setGrp(v);
    ui.rec.grp = v;
    if (v) {
      var g = db.groups.find(function (x) { return x && x.name === v; });
      var ok = !prj || !g || db.projects.some(function (p) { return p && p.name === prj && p.group_id === g.id; });
      if (!ok) { setPrj(""); ui.rec.prj = ""; }
    }
  }
  function changePrj(v) { setPrj(v); ui.rec.prj = v; }
  function changeTab(t) { setTab(t); ui.rec.tab = t; }
  function selectDay(d) {
    var ds = d.format("YYYY-MM-DD");
    setDay(ds);
    ui.rec.date = ds;
    ui.rec.month = ds.slice(0, 7);
  }
  function onPanelChange(d) {
    ui.rec.month = d.format("YYYY-MM-DD").slice(0, 7);
  }
  function refresh() {
    props.refresh();
    message.success("数据已刷新");
  }

  function cellRender(date, info) {
    if (!info || info.type !== "date") return null;
    var ds = date.format("YYYY-MM-DD");
    var has = scoped.some(function (r) { return r.occurred_at && r.occurred_at.slice(0, 10) === ds; });
    return has ? <div className="cal-dot" /> : null;
  }

  function recordColumns() {
    return [
      { title: "时间", dataIndex: "occurred_at", width: 160 },
      {
        title: "状态", width: 120,
        render: function (_, r) { var s = statusInfo(r.status); return <Tag color={s.color}>{s.text}</Tag>; }
      },
      {
        title: "人员", width: 150,
        render: function (_, r) {
          return (
            <div>
              <span>{r.person_id ? r.person_name : <Text type="secondary">未知人员</Text>}</span>
              {r.consent_pending ? <Tag style={{ marginLeft: 6 }}>未激活</Tag> : null}
            </div>
          );
        }
      },
      {
        title: "编号", width: 90,
        render: function (_, r) {
          var p = db.people.find(function (x) { return x.id === r.person_id; });
          return p ? p.employee_code : "—";
        }
      },
      { title: "项目组", render: function (_, r) { return recordGroupNamesText(r); } },
      { title: "项目名称", render: function (_, r) { return recordProjectNamesText(r); } },
      {
        title: "IP校验", width: 100,
        render: function (_, r) {
          var i = ipInfo(r);
          return i.text === "—" ? <Text type="secondary">—</Text> : <Tag color={i.color}>{i.text}</Tag>;
        }
      },
      { title: "当前IP", width: 130, render: function (_, r) { return r.current_ip || "—"; } },
      { title: "供应商", render: function (_, r) { return r.supplier_name || "—"; } },
      { title: "终端账号", render: function (_, r) { return r.terminal_name || "—"; } }
    ];
  }

  function missingColumns() {
    var cols = [];
    if (isVm || isGlobal) cols.push({ title: "供应商", render: function (_, p) { return supplierName(db, p.supplier_id); } });
    cols.push({ title: "人员", render: function (_, p) { return p.name; } });
    cols.push({ title: "编号", dataIndex: "employee_code", width: 100 });
    cols.push({ title: "项目组", render: function (_, p) { return groupNames(db, p.group_ids); } });
    cols.push({ title: "项目名称", render: function (_, p) { return personProjectNames(db, p); } });
    cols.push({
      title: "状态", width: 110,
      render: function (_, p) {
        var c = consentInfo(p);
        return <Tag color={c.color}>{c.text}</Tag>;
      }
    });
    return cols;
  }

  function lead() {
    if (session.role === "terminal") return "终端账号查看所属供应商的人脸核验记录：先按日期选择，再查看当天的已人脸核验 / 未人脸核验 / 异常事件（未知人员、IP 禁止），不按项目组 / 项目筛选；页面醒目显示所属供应商。";
    if (session.role === "vm") return "VM 查看自己项目组人员的人脸核验记录：先按日期选择，再查看当天的已人脸核验记录 / 未人脸核验人员名单 / 异常事件（支持项目组 / 项目 / 供应商筛选）；记录同时显示该人员的项目组与项目名称。";
    if (session.role === "supplier_admin") return "供应商管理员查看本供应商人员的人脸核验记录（支持项目组 / 项目 / 供应商筛选），以及本供应商终端的未知 / IP 禁止事件。";
    if (session.role === "global_admin") return "全局管理员查看全平台人脸核验记录：参考 VM 页签，可查看已人脸核验 / 未人脸核验 / 异常事件；支持按全部供应商 / 项目组 / 项目筛选。";
    return "全平台人脸核验记录：显示人员、项目组、项目名称与 IP 校验结果；支持项目组 / 项目 / 供应商筛选。";
  }

  return (
    <div>
      <div className="topbar">
        <div>
          <div className="eyebrow">Attendance</div>
          <Title level={3} style={{ margin: 0 }}>人脸核验记录</Title>
          <Text type="secondary" style={{ display: "block", marginTop: 4 }}>{lead()}</Text>
        </div>
        <Space>
          {session.supplier_id ? <Tag color="blue">供应商：{supplierName(db, session.supplier_id)}</Tag> : null}
          <Button icon={<ReloadOutlined />} onClick={refresh}>刷新</Button>
        </Space>
      </div>

      <Card className="page-card" style={{ marginTop: 16, marginBottom: 16 }} title="日历 · 按日期查看"
        extra={<Text type="secondary" style={{ fontSize: 12 }}>当前选择：{day} · 点击日期切换当天记录，带圆点的日期表示有人脸核验记录</Text>}>
        <Calendar
          fullscreen={false}
          value={dayjs(day)}
          onSelect={selectDay}
          onPanelChange={onPanelChange}
          cellRender={cellRender}
          style={{ maxWidth: 920 }}
        />
      </Card>

      {!isTerm ? (
        <Card className="page-card" style={{ marginBottom: 16 }}>
          <Space wrap size={12}>
            <div>
              <div className="filter-label">项目组</div>
              <Select style={{ width: 180 }} value={grp} onChange={changeGrp}
                options={[{ label: "全部项目组", value: "" }].concat(grpOptions)} />
            </div>
            <div>
              <div className="filter-label">项目名称</div>
              <Select style={{ width: 180 }} value={prj} onChange={changePrj}
                options={[{ label: "全部项目名称", value: "" }].concat(prjOptions)} />
            </div>
            <div>
              <div className="filter-label">供应商</div>
              <Select style={{ width: 180 }} value={sup} onChange={changeSup}
                options={[{ label: "全部供应商", value: "" }].concat(supOptions)} />
            </div>
          </Space>
        </Card>
      ) : null}

      {hasTabs ? (
        <>
          <div className="page-card" style={{ marginBottom: 8 }}>
            <Tag color={tab === "done" ? "blue" : "default"} style={{ padding: "4px 14px", borderRadius: 6, cursor: "pointer", marginRight: 8 }}
              onClick={function () { changeTab("done"); }}>
              已人脸核验
            </Tag>
            <Tag color={tab === "missing" ? "blue" : "default"} style={{ padding: "4px 14px", borderRadius: 6, cursor: "pointer", marginRight: 8 }}
              onClick={function () { changeTab("missing"); }}>
              未人脸核验
            </Tag>
            <Tag color={tab === "anomaly" ? "orange" : "default"} style={{ padding: "4px 14px", borderRadius: 6, cursor: "pointer" }}
              onClick={function () { changeTab("anomaly"); }}>
              异常事件
            </Tag>
          </div>
          {tab === "done" ? (
            <Card className="page-card" title={day} extra={<Text type="secondary">共 {tableRecords.length} 条成功人脸核验记录</Text>}>
              <Table rowKey="id" columns={recordColumns()} dataSource={tableRecords} scroll={{ x: 1100 }}
                pagination={{ pageSize: 10, showTotal: function (t) { return "共 " + t + " 条"; } }}
                locale={{ emptyText: <Text type="secondary">这一天没有符合条件的人脸核验记录。</Text> }} />
            </Card>
          ) : tab === "anomaly" ? (
            <Card className="page-card" title={day + " 异常事件"}
              extra={<Text type="secondary">共 {anomalyRecords.length} 条 · 未知人员 / IP 禁止 / 未激活</Text>}>
              <Table rowKey="id" columns={recordColumns()} dataSource={anomalyRecords} scroll={{ x: 1100 }}
                pagination={{ pageSize: 10, showTotal: function (t) { return "共 " + t + " 条"; } }}
                locale={{ emptyText: <Text type="secondary">这一天没有异常事件。</Text> }} />
            </Card>
          ) : (
            <Card className="page-card" title={day + " 未人脸核验人员名单"}
              extra={<Text type="secondary">共 {missingPeople.length} 人 · 未激活按未人脸核验计算</Text>}>
              <Table rowKey="id" columns={missingColumns()} dataSource={missingPeople} scroll={{ x: "max-content" }}
                pagination={{ pageSize: 10, hideOnSinglePage: true }}
                locale={{ emptyText: <Text type="secondary">所选日期所有人员都已人脸核验。</Text> }} />
            </Card>
          )}
        </>
      ) : (
        <Card className="page-card" title={day} extra={<Text type="secondary">共 {tableRecords.length} 条记录</Text>}>
          <Table rowKey="id" columns={recordColumns()} dataSource={tableRecords} scroll={{ x: 1100 }}
            pagination={{ pageSize: 10, showTotal: function (t) { return "共 " + t + " 条"; } }}
            locale={{ emptyText: <Text type="secondary">这一天没有符合条件的人脸核验记录。</Text> }} />
        </Card>
      )}
    </div>
  );
}