import React, { useMemo, useState } from "react";
import { App as AntApp, Button, Card, Divider, Form, Input, InputNumber, Modal, Select, Space, Table, Tag, Typography } from "antd";
import { PlusOutlined, ReloadOutlined, TeamOutlined, UserAddOutlined } from "@ant-design/icons";
import { assignPersonToGroup, group, person, personHasProject, personProjectNames, project, removePersonFromProject, supplierName } from "../lib/helpers";

const { Title, Text } = Typography;

function ListCard(props) {
  const { rows, canManage, canManageMembers, onEdit, onToggle, onMembers } = props;
  const columns = [
    { title: "名称", dataIndex: ["pr", "name"], width: 200, render: function (v) { return <b>{v}</b>; } },
    { title: "所属项目组", dataIndex: "groupName", width: 160 },
    { title: "离项申请时间", key: "days", width: 130, render: function (_, r) { return "申请日 + " + r.pr.leave_days + " 天"; } },
    { title: "人员", dataIndex: "people", width: 80, render: function (v) { return v + " 人"; } },
    { title: "状态", key: "st", width: 90, render: function (_, r) { return r.pr.is_active ? <Tag color="success">启用</Tag> : <Tag>已停用</Tag>; } }
  ];
  if (props.showSupplier) {
    columns.splice(2, 0, { title: "供应商", dataIndex: "supplierName", width: 160 });
  }
  if (canManage) {
    columns.push({
      title: "操作", key: "action", width: 230,
      render: function (_, r) {
        return (
          <Space size={4}>
            {canManageMembers ? <Button size="small" icon={<TeamOutlined />} onClick={function () { onMembers(r.pr); }}>成员</Button> : null}
            <Button size="small" onClick={function () { onEdit(r.pr); }}>修改</Button>
            <Button size="small" danger={r.pr.is_active} onClick={function () { onToggle(r.pr); }}>{r.pr.is_active ? "停用" : "启用"}</Button>
          </Space>
        );
      }
    });
  }
  return (
    <Card className="page-card" style={{ marginTop: 0 }}
      title={<div>项目名称列表<Text type="secondary" style={{ fontSize: 12, marginLeft: 8 }}>共 {rows.length} 个</Text></div>}>
      <Table rowKey={function (r) { return r.pr.id; }} scroll={{ x: "max-content" }} columns={columns} dataSource={rows} pagination={{ pageSize: 10, showTotal: function (t) { return "共 " + t + " 个"; } }} />
    </Card>
  );
}

export default function ProjectsPage(props) {
  const db = props.db;
  const session = props.session;
  const { message, modal } = AntApp.useApp();
  const isSup = session.role === "supplier_admin";
  const isVm = session.role === "vm";
  const isGlobal = session.role === "global_admin";
  const [form] = Form.useForm();
  const [editForm] = Form.useForm();
  const [createOpen, setCreateOpen] = useState(false);
  const [editPrj, setEditPrj] = useState(null);
  const [membersPrj, setMembersPrj] = useState(null);
  const [memSup, setMemSup] = useState("");
  const [memPerson, setMemPerson] = useState("");
  const [memForm] = Form.useForm();

  const rows = useMemo(function () {
    var all = db.projects.slice();
    if (isSup) {
      all = all.filter(function (pr) {
        if (pr.supplier_id === session.supplier_id) return true;
        return db.people.some(function (p) {
          return p.is_active && p.supplier_id === session.supplier_id && personHasProject(p, pr.id);
        });
      });
    }
    if (isVm) all = all.filter(function (p) { return p.group_id && session.group_ids.indexOf(p.group_id) >= 0; });
    return all.map(function (pr) {
      var members = db.people.filter(function (p) { return p.is_active && personHasProject(p, pr.id); });
      return {
        pr: pr,
        groupName: pr.group_id && group(db, pr.group_id) ? group(db, pr.group_id).name : "—",
        supplierName: supplierName(db, pr.supplier_id),
        people: isSup
          ? members.filter(function (p) { return p.supplier_id === session.supplier_id; }).length
          : members.length
      };
    });
  }, [db, session, isSup, isVm]);

  const grpOptions = isVm
    ? (session.group_ids || []).map(function (gid) { var g = group(db, gid); return { label: g ? g.name : gid, value: gid }; })
    : db.groups.map(function (g) { return { label: g.name, value: g.id }; });

  function submitCreate() {
    form.validateFields().then(function (values) {
      var g = group(db, values.group_id);
      if (!g) { message.error("请选择项目组"); return; }
      db.projects.push({
        id: window.FaceStore.uid("prj"),
        name: String(values.name || "").trim(),
        supplier_id: null,
        group_id: values.group_id,
        leave_days: parseInt(values.leave_days, 10) || 0,
        is_active: true
      });
      window.FaceStore.persist(db);
      window.FaceStore.auditLog(session.display_name || session.username, session.role, "创建项目名称", "创建项目「" + String(values.name || "").trim() + "」");
      message.success("项目已创建");
      setCreateOpen(false);
      form.resetFields();
      props.refresh();
    }).catch(function () {});
  }

  function saveEdit() {
    editForm.validateFields().then(function (values) {
      var pr = project(db, editPrj.id);
      if (!pr) { setEditPrj(null); return; }
      var name = String(values.name || "").trim();
      if (!name) { message.error("请输入项目名称"); return; }
      var days = parseInt(values.leave_days, 10) || 0;
      pr.name = name;
      pr.leave_days = days;
      window.FaceStore.persist(db);
      window.FaceStore.auditLog(session.display_name || session.username, session.role, "修改项目", "修改项目「" + name + "」（离项申请时间 申请日 + " + days + " 天）");
      message.success("项目已修改");
      setEditPrj(null);
      props.refresh();
    }).catch(function () {});
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
        props.refresh();
      }
    });
  }

  function membersOf(prj) {
    if (!prj) return [];
    return db.people.filter(function (p) { return p.is_active && personHasProject(p, prj.id); });
  }

  function memSupOptions() {
    var seen = [];
    db.people.forEach(function (p) {
      if (p.is_active && !personHasProject(p, membersPrj ? membersPrj.id : "")) {
        if (seen.indexOf(p.supplier_id) < 0) seen.push(p.supplier_id);
      }
    });
    return seen.map(function (id) { return { label: supplierName(db, id), value: id }; });
  }

  function memPersonOptions() {
    var list = db.people.filter(function (p) {
      if (!p.is_active) return false;
      if (membersPrj && personHasProject(p, membersPrj.id)) return false;
      return !memSup || p.supplier_id === memSup;
    });
    return list.map(function (p) { return { label: p.name + "（" + p.employee_code + " · " + supplierName(db, p.supplier_id) + "）", value: p.id }; });
  }

  function openMembers(pr) {
    setMembersPrj(pr);
    setMemSup("");
    setMemPerson("");
    memForm.setFieldsValue({ sup: "", person: "" });
  }

  function addMember() {
    if (!membersPrj) return;
    var p = person(db, memPerson);
    var g = group(db, membersPrj.group_id);
    if (!p) { message.error("请选择要拉入的人员"); return; }
    if (personHasProject(p, membersPrj.id)) { message.error(p.name + " 已在项目「" + membersPrj.name + "」中"); return; }
    assignPersonToGroup(db, p, membersPrj.group_id, membersPrj.id);
    window.FaceStore.persist(db);
    window.FaceStore.auditLog(session.display_name || session.username, session.role, "拉入项目", p.name + " 直接拉入项目「" + membersPrj.name + "」（项目组「" + (g ? g.name : "") + "」，全局管理员操作）");
    message.success(p.name + " 已拉入项目「" + membersPrj.name + "」");
    setMemSup("");
    setMemPerson("");
    memForm.setFieldsValue({ sup: "", person: "" });
    props.refresh();
  }

  function addAllSupplier() {
    if (!membersPrj) return;
    if (!memSup) { message.error("请先选择供应商"); return; }
    var targets = db.people.filter(function (p) { return p.is_active && p.supplier_id === memSup && !personHasProject(p, membersPrj.id); });
    if (targets.length === 0) { message.error("没有可加入的该供应商人员（全部已在该项目下）。"); return; }
    modal.confirm({
      title: "确认将 " + supplierName(db, memSup) + " 的 " + targets.length + " 名未加入人员一键拉入项目「" + membersPrj.name + "」？",
      okText: "一键拉入",
      cancelText: "取消",
      onOk: function () {
        targets.forEach(function (p) { assignPersonToGroup(db, p, membersPrj.group_id, membersPrj.id); });
        window.FaceStore.persist(db);
        window.FaceStore.auditLog(session.display_name || session.username, session.role, "拉入项目", "供应商「" + supplierName(db, memSup) + "」" + targets.length + " 名人员一键拉入项目「" + membersPrj.name + "」（全局管理员操作）");
        message.success("已一键拉入 " + targets.length + " 名人员");
        setMembersPrj(null);
        props.refresh();
      }
    });
  }

  function removeMember(p) {
    if (!membersPrj) return;
    modal.confirm({
      title: "确认将 " + p.name + " 移出项目「" + membersPrj.name + "」？",
      content: "只从该项目移出；若该人员在该项目组下不再有其他项目，会同时移出项目组。无需审批，操作写入审计日志。",
      okText: "移出",
      okButtonProps: { danger: true },
      cancelText: "取消",
      onOk: function () {
        removePersonFromProject(db, p, membersPrj.group_id, membersPrj.id);
        window.FaceStore.persist(db);
        window.FaceStore.auditLog(session.display_name || session.username, session.role, "移出项目", p.name + " 从项目「" + membersPrj.name + "」直接移出（全局管理员操作）");
        message.success(p.name + " 已从项目「" + membersPrj.name + "」移出");
        props.refresh();
      }
    });
  }

  var lead = isSup
    ? "供应商管理员只读查看本供应商相关的项目：含绑定本供应商的项目，以及本供应商人员已加入的新项目（新增项目不绑定供应商）；不能新增项目，项目由 VM / 全局管理员创建。"
    : "一个项目组下可以有多个项目；项目名称决定人脸核验记录上显示的项目，以及离项申请要提前的天数。" + (isVm ? " VM 可以在自己负责的项目组下新建项目。" : " 全局管理员可创建项目并归属项目组，新增项目不绑定供应商；可直接通过「成员」将人员拉入或移出项目（无需申请）。");

  return (
    <div>
      <div className="topbar">
        <div>
          <div className="eyebrow">Projects</div>
          <Title level={3} style={{ margin: 0 }}>项目管理</Title>
          <Text type="secondary" style={{ display: "block", marginTop: 4 }}>{lead}</Text>
        </div>
        <Space>
          {!isSup ? <Button type="primary" icon={<PlusOutlined />} onClick={function () { setCreateOpen(true); }}>新增项目</Button> : null}
          <Button icon={<ReloadOutlined />} onClick={props.refresh}>刷新</Button>
        </Space>
      </div>

      <div style={{ marginTop: 16 }}>
        <ListCard db={db} rows={rows} showSupplier={!isSup} canManage={!isSup} canManageMembers={isGlobal} onEdit={function (pr) { setEditPrj({ id: pr.id, name: pr.name, leave_days: pr.leave_days }); editForm.setFieldsValue({ name: pr.name, leave_days: pr.leave_days }); }} onToggle={toggleProject} onMembers={openMembers} />
      </div>

      {!isSup ? (
        <Modal
          open={createOpen}
          title={isVm ? "新增项目（所属项目组）" : "新增项目"}
          footer={null}
          onCancel={function () { setCreateOpen(false); }}
          destroyOnClose
        >
          {isVm && (session.group_ids || []).length === 0 ? (
            <div className="empty">你的账号还没有绑定任何项目组，请联系全局管理员绑定后再新建项目。</div>
          ) : (
            <Form form={form} layout="vertical" onFinish={submitCreate} initialValues={{ leave_days: 7 }}>
              <Form.Item name="group_id" label="所属项目组 *" rules={[{ required: true, message: "请选择项目组" }]}>
                <Select options={grpOptions} placeholder="请选择项目组" />
              </Form.Item>
              <Form.Item name="name" label="项目名称 *" rules={[{ required: true, message: "请输入项目名称" }]}>
                <Input placeholder="如 园区一期保洁" />
              </Form.Item>
              <Form.Item name="leave_days" label="离项提前天数（离项申请生效日 = 申请日 + 该天数）">
                <InputNumber min={0} style={{ width: "100%" }} />
              </Form.Item>
              <Text type="secondary" style={{ fontSize: 12 }}>新增项目不绑定供应商，仅归属所选项目组。</Text>
              <Form.Item style={{ marginBottom: 0, marginTop: 8 }}>
                <Button type="primary" htmlType="submit" icon={<PlusOutlined />}>创建项目</Button>
              </Form.Item>
            </Form>
          )}
        </Modal>
      ) : null}

      <Modal
        open={!!editPrj}
        title="修改项目"
        okText="保存"
        cancelText="取消"
        onOk={saveEdit}
        onCancel={function () { setEditPrj(null); }}
        destroyOnClose
      >
        {editPrj ? (
          <Form form={editForm} layout="vertical" initialValues={{ name: editPrj.name, leave_days: editPrj.leave_days }}>
            <Form.Item name="name" label="项目名称" rules={[{ required: true, message: "请输入项目名称" }]}>
              <Input placeholder="如 园区一期保洁" />
            </Form.Item>
            <Form.Item name="leave_days" label="离项提前天数（离项申请生效日 = 申请日 + 该天数）">
              <InputNumber min={0} style={{ width: "100%" }} />
            </Form.Item>
          </Form>
        ) : null}
      </Modal>

      <Modal
        open={!!membersPrj}
        title={"项目成员管理" + (membersPrj ? "「" + membersPrj.name + "」" : "") + (membersPrj && group(db, membersPrj.group_id) ? " · 项目组「" + group(db, membersPrj.group_id).name + "」" : "")}
        footer={null}
        onCancel={function () { setMembersPrj(null); }}
        destroyOnClose
        width={760}
      >
        {membersPrj ? (
          <div>
            <Text type="secondary" style={{ display: "block", marginBottom: 12 }}>
              全局管理员无需申请，可直接将人员拉入或移出项目；操作写入审计日志，无需审批。
            </Text>
            <Divider orientation="left" style={{ marginTop: 0 }}>当前成员（{membersOf(membersPrj).length} 人）</Divider>
            <Table
              rowKey="id"
              size="small"
              scroll={{ x: "max-content" }}
              dataSource={membersOf(membersPrj)}
              pagination={false}
              locale={{ emptyText: "该项目下还没有成员。" }}
              columns={[
                { title: "人员", dataIndex: "name", width: 140 },
                { title: "编号", dataIndex: "employee_code", width: 110 },
                { title: "供应商", key: "sup", width: 160, render: function (_, p) { return supplierName(db, p.supplier_id); } },
                { title: "项目名称", key: "prjs", render: function (_, p) { return personProjectNames(db, p); } },
                {
                  title: "操作", key: "action", width: 80,
                  render: function (_, p) { return <Button size="small" danger onClick={function () { removeMember(p); }}>移出</Button>; }
                }
              ]}
            />
            <Divider orientation="left">从人员库拉入</Divider>
            <Form form={memForm} layout="vertical">
              <Form.Item name="sup" label="供应商">
                <Select
                  options={[{ label: "全部供应商", value: "" }].concat(memSupOptions())}
                  onChange={function (v) { setMemSup(v || ""); setMemPerson(""); memForm.setFieldsValue({ person: "" }); }}
                />
              </Form.Item>
              <Form.Item name="person" label="人员">
                <Select
                  showSearch
                  optionFilterProp="label"
                  value={memPerson}
                  onChange={setMemPerson}
                  options={[{ label: "请选择人员", value: "" }].concat(memPersonOptions())}
                  placeholder="请选择人员"
                />
              </Form.Item>
            </Form>
            <Text type="secondary" style={{ display: "block", fontSize: 12, marginBottom: 12 }}>
              当前可选 {memPersonOptions().length} 名未加入该项目的人员（未激活人员不参与项目，需先在人员库编辑启用）。
            </Text>
            <Space>
              <Button type="primary" icon={<UserAddOutlined />} onClick={addMember}>拉入选中人员</Button>
              <Button onClick={addAllSupplier}>一键拉入该供应商全部人员</Button>
              <Button onClick={function () { setMembersPrj(null); }}>关闭</Button>
            </Space>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
