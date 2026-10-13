import React, { useEffect, useMemo, useState } from "react";
import { App as AntApp, Button, Card, Form, Input, Select, Space, Table, Tabs, Tag, Typography } from "antd";
import { ReloadOutlined } from "@ant-design/icons";
import { ui } from "../lib/ui";
import { group, person, personHasProject, personProjectIds, project, supplierName } from "../lib/helpers";

const { Title, Text } = Typography;

export default function RequestsPage(props) {
  const db = props.db;
  const session = props.session;
  const { message, modal } = AntApp.useApp();
  const isSup = session.role === "supplier_admin";
  const isVm = session.role === "vm";
  const mySupName = session.supplier_name || supplierName(db, session.supplier_id);
  const [tab, setTab] = useState(ui.reqTab || "join");
  const [joinPerson, setJoinPerson] = useState(null);
  const [joinProject, setJoinProject] = useState(null);
  const [joinNote, setJoinNote] = useState("");
  const [leavePerson, setLeavePerson] = useState(null);
  const [leaveProject, setLeaveProject] = useState(null);
  const [leaveNote, setLeaveNote] = useState("");
  const [leavePersonPrjIds, setLeavePersonPrjIds] = useState(null);

  function changeTab(t) { setTab(t); ui.reqTab = t; }

  // 从人员库「申请入项」跳转过来时，预选当前人员并定位到入项页签
  useEffect(function () {
    if (ui.reqJoinPerson) {
      var p = person(db, ui.reqJoinPerson);
      var ok = p && p.is_active && (!isSup || p.supplier_id === session.supplier_id);
      if (ok) {
        setTab("join");
        ui.reqTab = "join";
        setJoinPerson(p.id);
        ui.reqJoinPerson = null;
      }
    }
  }, [db, session, isSup]);

  const myPeople = useMemo(function () {
    if (session.role === "global_admin") return db.people.filter(function (p) { return p.is_active; });
    return db.people.filter(function (p) { return p.is_active && p.supplier_id === session.supplier_id; });
  }, [db, session]);

  const allProjects = useMemo(function () {
    return db.projects.filter(function (pr) { return pr.is_active; });
  }, [db]);

  const myProjects = useMemo(function () {
    return db.projects.filter(function (pr) { return pr.is_active && pr.supplier_id === session.supplier_id; });
  }, [db, session]);

  const joinScopeApps = useMemo(function () {
    var apps = db.applications.filter(function (a) { return a.type === "join_group"; });
    if (isVm) apps = apps.filter(function (a) { return a.group_id && session.group_ids.indexOf(a.group_id) >= 0; });
    return apps;
  }, [db, session, isVm]);

  const leaveScopeApps = useMemo(function () {
    var apps = db.applications.filter(function (a) { return a.type === "leave_project"; });
    if (isVm) {
      apps = apps.filter(function (a) {
        var p = person(db, a.person_id);
        return p && (p.group_ids || []).some(function (g) { return (session.group_ids || []).indexOf(g) >= 0; });
      });
    }
    return apps;
  }, [db, session, isVm]);

  function joinSubmit() {
    var p = person(db, joinPerson);
    var pr = project(db, joinProject);
    var g = pr ? group(db, pr.group_id) : null;
    if (!p || !pr || !g) { message.error("请选择人员和项目"); return; }
    if (personHasProject(p, pr.id)) { message.error(p.name + " 已在项目「" + pr.name + "」中"); return; }
    var dupJoin = db.applications.some(function (a) {
      return a.type === "join_group" && a.status === "pending" && a.person_id === p.id && a.project_id === pr.id;
    });
    if (dupJoin) { message.error(p.name + " 已有待审批的「" + pr.name + "」入项申请，请勿重复提交"); return; }
    db.applications.unshift({
      id: window.FaceStore.uid("app"), type: "join_group", status: "pending",
      person_id: p.id, person_name: p.name, group_id: pr.group_id, group_name: g.name,
      project_id: pr.id, project_name: pr.name,
      apply_date: window.FaceStore.localDateString(), effective_date: window.FaceStore.localDateString(), leave_days: null,
      submitter: session.display_name || session.username, submitter_supplier: mySupName,
      note: String(joinNote || "").trim() || "", created_at: window.FaceStore.nowString(), reviewed_at: null, reviewer: null
    });
    window.FaceStore.persist(db);
    window.FaceStore.auditLog(session.display_name || session.username, session.role, "提交入项申请", p.name + " 申请入项「" + pr.name + "（" + g.name + "）」");
    message.success("已提交入项申请，等待 VM 审批");
    setJoinPerson(null);
    setJoinProject(null);
    setJoinNote("");
    props.refresh();
    ui.reqJoinPerson = null;
  }

  function leaveSubmit() {
    var p = person(db, leavePerson);
    var pr = project(db, leaveProject);
    if (!p || !pr) { message.error("请选择人员和项目"); return; }
    if (!personHasProject(p, pr.id)) { message.error(p.name + " 当前不在项目「" + pr.name + "」中，无需申请离项"); return; }
    var dupLeave = db.applications.some(function (a) {
      return a.type === "leave_project" && a.status === "pending" && a.person_id === p.id && a.project_id === pr.id;
    });
    if (dupLeave) { message.error(p.name + " 已有待审批的「" + pr.name + "」离项申请，请勿重复提交"); return; }
    db.applications.unshift({
      id: window.FaceStore.uid("app"), type: "leave_project", status: "pending",
      person_id: p.id, person_name: p.name, group_id: null, group_name: null,
      project_id: pr.id, project_name: pr.name,
      apply_date: window.FaceStore.localDateString(), effective_date: window.FaceStore.addDays(window.FaceStore.localDateString(), pr.leave_days), leave_days: pr.leave_days,
      submitter: session.display_name || session.username, submitter_supplier: mySupName,
      note: String(leaveNote || "").trim() || "", created_at: window.FaceStore.nowString(), reviewed_at: null, reviewer: null
    });
    window.FaceStore.persist(db);
    window.FaceStore.auditLog(session.display_name || session.username, session.role, "提交离项申请", p.name + " 申请离开项目「" + pr.name + "」（提前 " + pr.leave_days + " 天）");
    message.success("离项申请已提交，等待 VM 审批");
    setLeavePerson(null);
    setLeaveProject(null);
    setLeaveNote("");
    setLeavePersonPrjIds(null);
    props.refresh();
  }

  function cancelDupApps(type, personId, projectId, exceptId, by) {
    db.applications.forEach(function (a) {
      if (a.id !== exceptId && a.type === type && a.status === "pending" && a.person_id === personId && a.project_id === projectId) {
        a.status = "rejected";
        a.reviewed_at = window.FaceStore.nowString();
        a.reviewer = by + "（重复申请，随同单自动驳回）";
      }
    });
  }

  function reviewJoin(appId, ok) {
    var a = db.applications.find(function (x) { return x.id === appId; });
    if (!a) return;
    a.status = ok ? "approved" : "rejected";
    a.reviewed_at = window.FaceStore.nowString();
    a.reviewer = session.display_name || session.username;
    if (ok) {
      var p = person(db, a.person_id);
      if (p) {
        if (a.group_id && (p.group_ids || []).indexOf(a.group_id) < 0) {
          if (!p.group_ids) p.group_ids = [];
          p.group_ids.push(a.group_id);
        }
        var prj = project(db, a.project_id);
        if (prj && personProjectIds(p).indexOf(prj.id) < 0) {
          if (!p.project_ids) p.project_ids = [];
          p.project_ids.push(prj.id);
          p.project_id = p.project_ids[0] || prj.id;
        }
      }
    }
    if (ok) cancelDupApps("join_group", a.person_id, a.project_id, a.id, session.display_name || session.username);
    window.FaceStore.persist(db);
    window.FaceStore.auditLog(session.display_name || session.username, session.role, ok ? "审批通过·入项" : "审批驳回·入项", a.person_name + " " + (ok ? "入项" : "未入项") + "「" + (a.project_name || a.group_name) + (a.project_name && a.group_name ? "（" + a.group_name + "）" : "") + "」");
    message.success(ok ? "已通过 " + a.person_name + " 的入项申请" : "已驳回 " + a.person_name + " 的入项申请");
    props.refresh();
  }

  function reviewLeave(appId, ok) {
    var a = db.applications.find(function (x) { return x.id === appId; });
    if (!a) return;
    a.status = ok ? "approved" : "rejected";
    a.reviewed_at = window.FaceStore.nowString();
    a.reviewer = session.display_name || session.username;
    if (ok) {
      var p = person(db, a.person_id);
      if (p) {
        var pr = project(db, a.project_id);
        var gid = pr ? pr.group_id : null;
        var prjIds = personProjectIds(p).filter(function (pid) { return pid !== a.project_id; });
        p.project_ids = prjIds;
        p.project_id = prjIds[0] || null;
        if (gid) {
          var stillInGroup = prjIds.some(function (pid) { var x = project(db, pid); return x && x.group_id === gid; });
          if (!stillInGroup) p.group_ids = (p.group_ids || []).filter(function (g) { return g !== gid; });
        }
      }
    }
    if (ok) cancelDupApps("leave_project", a.person_id, a.project_id, a.id, session.display_name || session.username);
    window.FaceStore.persist(db);
    window.FaceStore.auditLog(session.display_name || session.username, session.role, ok ? "审批通过·离项" : "审批驳回·离项", a.person_name + " " + (ok ? "已离项（仅移出该项目及其项目组，其他项目保留）" : "未离项") + " · 项目「" + a.project_name + "」");
    message.success(ok ? "已通过 " + a.person_name + " 的离项申请" : "已驳回 " + a.person_name + " 的离项申请");
    props.refresh();
  }

  function confirmReview(type, a, ok) {
    modal.confirm({
      title: (ok ? "通过" : "驳回") + (type === "join" ? "入项" : "离项") + "申请？",
      content: a.person_name + " · " + (type === "join" ? (a.project_name || a.group_name) : a.project_name),
      okText: ok ? "通过" : "驳回",
      okButtonProps: { danger: !ok },
      cancelText: "取消",
      onOk: function () { if (type === "join") reviewJoin(a.id, ok); else reviewLeave(a.id, ok); }
    });
  }

  const appColumns = [
    {
      title: "类型", key: "type", width: 80,
      render: function (_, a) { return a.type === "join_group" ? <Tag color="blue">入项</Tag> : <Tag color="purple">离项</Tag>; }
    },
    { title: "时间", dataIndex: "created_at", width: 170 },
    { title: "人员", dataIndex: "person_name", width: 120 },
    {
      title: "项目 / 项目组", key: "prj", width: 220,
      render: function (_, a) {
        if (a.type === "join_group") {
          return <span>{a.project_name || a.group_name}{a.project_name && a.group_name ? "（" + a.group_name + "）" : ""}</span>;
        }
        return <span>{a.project_name}</span>;
      }
    },
    { title: "生效日期", dataIndex: "effective_date", width: 120 },
    { title: "提交方", dataIndex: "submitter_supplier", width: 150 },
    {
      title: "状态", key: "status", width: 100,
      render: function (_, a) {
        if (a.status === "pending") return <Tag color="processing">待审批</Tag>;
        if (a.status === "approved") return <Tag color="success">已通过</Tag>;
        return <Tag>已驳回</Tag>;
      }
    },
  ];
  if (!isSup) {
    appColumns.push({
      title: "操作", key: "action", width: 160,
      render: function (_, a) {
        if (a.status === "pending") {
          return (
            <Space>
              <Button size="small" type="primary" onClick={function () { confirmReview(a.type === "join_group" ? "join" : "leave", a, true); }}>通过</Button>
              <Button size="small" onClick={function () { confirmReview(a.type === "join_group" ? "join" : "leave", a, false); }}>驳回</Button>
            </Space>
          );
        }
        return <Text type="secondary" style={{ fontSize: 12 }}>{a.reviewer ? "由 " + a.reviewer + " 处理" : "—"}</Text>;
      }
    });
  }

  function applicationsTable(apps) {
    return (
      <Table
        rowKey="id"
        size="small"
        scroll={{ x: "max-content" }}
        columns={appColumns}
        dataSource={apps}
        pagination={{ pageSize: 10, showTotal: function (t) { return "共 " + t + " 条"; } }}
        locale={{ emptyText: "暂无申请。" }}
      />
    );
  }

  function joinFormCard() {
    var joinPrj = joinProject ? project(db, joinProject) : null;
    return (
      <Card className="page-card" title="发起入项申请" style={{ marginTop: 0 }}>
        <Form layout="vertical">
          <Form.Item label="人员 *">
            <Select
              showSearch
              optionFilterProp="label"
              placeholder="请选择人员"
              value={joinPerson || undefined}
              options={myPeople.map(function (p) { return { label: p.name + "（" + p.employee_code + "）", value: p.id }; })}
              onChange={function (v) { setJoinPerson(v); }}
            />
          </Form.Item>
          <Form.Item label="项目名称 *">
            <Select
              placeholder="请选择项目"
              value={joinProject || undefined}
              options={allProjects.map(function (pr) {
                var g = group(db, pr.group_id);
                return { label: pr.name + (g ? "（" + g.name + "）" : ""), value: pr.id };
              })}
              onChange={function (v) { setJoinProject(v); }}
            />
          </Form.Item>
          <Form.Item label="备注">
            <Input.TextArea rows={2} placeholder="申请入项的原因" value={joinNote} onChange={function (e) { setJoinNote(e.target.value); }} />
          </Form.Item>
          <div className="notice">
            {joinPrj
              ? <span>自动关联项目组：<b>{joinPrj.group_id && group(db, joinPrj.group_id) ? group(db, joinPrj.group_id).name : "—"}</b> · 项目：<b>{joinPrj.name}</b></span>
              : <span>选择项目后自动显示所属项目组；申请入项按项目发起，提交后自动关联该项目所属项目组。同一人员同一项目仅保留一份待审批申请。</span>}
          </div>
          <Button type="primary" onClick={joinSubmit}>提交申请（待 VM 审批）</Button>
        </Form>
      </Card>
    );
  }

  function leaveFormCard() {
    var leavePrj = leaveProject ? project(db, leaveProject) : null;
    var prjOptions = leavePersonPrjIds
      ? db.projects.filter(function (pr) { return pr.is_active && leavePersonPrjIds.indexOf(pr.id) >= 0; })
      : myProjects;
    return (
      <Card className="page-card" title="发起离项申请" style={{ marginTop: 0 }}>
        <Form layout="vertical">
          <Form.Item label="人员 *">
            <Select
              showSearch
              optionFilterProp="label"
              placeholder="请选择人员"
              value={leavePerson || undefined}
              options={myPeople.map(function (p) { return { label: p.name + "（" + p.employee_code + "）", value: p.id }; })}
              onChange={function (v) {
                var p = person(db, v);
                var ids = p ? personProjectIds(p).filter(function (pid) { var pr = project(db, pid); return pr && pr.is_active; }) : [];
                setLeavePerson(v);
                setLeavePersonPrjIds(ids.length ? ids : null);
                if (ids.length === 1) {
                  var pr = project(db, ids[0]);
                  setLeaveProject(pr ? pr.id : null);
                } else {
                  setLeaveProject(null);
                }
              }}
            />
          </Form.Item>
          <Form.Item label="项目名称 *">
            <Select
              placeholder="请选择项目"
              value={leaveProject || undefined}
              options={prjOptions.map(function (pr) { return { label: pr.name + "（提前 " + pr.leave_days + " 天）", value: pr.id }; })}
              onChange={function (v) { setLeaveProject(v); }}
            />
          </Form.Item>
          <Form.Item label="备注">
            <Input.TextArea rows={2} placeholder="申请离项原因" value={leaveNote} onChange={function (e) { setLeaveNote(e.target.value); }} />
          </Form.Item>
          <div className="notice">
            {leavePrj
              ? <span>已自动关联人员所在项目：<b>{leavePrj.name}</b> · 生效日期：<b>{window.FaceStore.addDays(window.FaceStore.localDateString(), leavePrj.leave_days)}</b>（申请日 + {leavePrj.leave_days} 天）</span>
              : <span>选择人员后自动关联该人员所在项目；同一人员有多个项目时请手动选择。同一人员同一项目仅保留一份待审批申请。</span>}
          </div>
          <Button type="primary" onClick={leaveSubmit}>提交离项申请</Button>
        </Form>
      </Card>
    );
  }

  function renderJoin() {
    if (isSup) {
      var myJoins = db.applications.filter(function (a) {
        return a.type === "join_group" && a.submitter_supplier === mySupName;
      });
      return (
        <div className="split-grid">
          {joinFormCard()}
          <Card className="page-card" style={{ marginTop: 0 }}
            title={<div>我的入项申请<Text type="secondary" style={{ fontSize: 12, marginLeft: 8 }}>共 {myJoins.length} 条</Text></div>}>
            {applicationsTable(myJoins)}
          </Card>
        </div>
      );
    }
    return (
      <Card className="page-card" style={{ marginTop: 0 }}
        title={<div>{isVm ? "待我审批的入项申请" : "全部入项申请"}<Text type="secondary" style={{ fontSize: 12, marginLeft: 8 }}>共 {joinScopeApps.length} 条</Text></div>}>
        {applicationsTable(joinScopeApps)}
      </Card>
    );
  }

  function renderLeave() {
    if (isSup) {
      var myLeaves = db.applications.filter(function (a) { return a.type === "leave_project" && a.submitter_supplier === mySupName; });
      return (
        <div className="split-grid">
          {leaveFormCard()}
          <Card className="page-card" style={{ marginTop: 0 }}
            title={<div>我的离项申请<Text type="secondary" style={{ fontSize: 12, marginLeft: 8 }}>共 {myLeaves.length} 条</Text></div>}>
            {applicationsTable(myLeaves)}
          </Card>
        </div>
      );
    }
    return (
      <Card className="page-card" style={{ marginTop: 0 }}
        title={<div>{isVm ? "待我审批的离项申请" : "全部离项申请"}<Text type="secondary" style={{ fontSize: 12, marginLeft: 8 }}>共 {leaveScopeApps.length} 条</Text></div>}>
        {applicationsTable(leaveScopeApps)}
      </Card>
    );
  }

  var lead = isSup
    ? "供应商管理员按「项目名称」发起入项申请（自动关联项目组），或发起离项申请，待对应 VM 审批；页签切换查看各自的申请记录。"
    : (isVm
      ? "VM 账号审批自己项目组相关的「入项」与「离项」申请；通过离项后人员自动退出项目组、项目名称清空。"
      : "全局管理员不发起申请，可直接审批全部「入项」与「离项」申请；人员直接拉入 / 移除请到「项目管理」中操作。");

  return (
    <div>
      <div className="topbar">
        <div>
          <div className="eyebrow">Requests</div>
          <Title level={3} style={{ margin: 0 }}>申请中心</Title>
          <Text type="secondary" style={{ display: "block", marginTop: 4 }}>{lead}</Text>
        </div>
        <Button icon={<ReloadOutlined />} onClick={props.refresh}>刷新</Button>
      </div>

      <Tabs
        style={{ marginTop: 12 }}
        activeKey={tab}
        onChange={changeTab}
        items={[
          { key: "join", label: "入项" },
          { key: "leave", label: "离项" }
        ]}
      />
      <div style={{ marginTop: 8 }}>
        {tab === "join" ? renderJoin() : renderLeave()}
      </div>
    </div>
  );
}


