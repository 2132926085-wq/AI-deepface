import React, { useMemo, useState } from "react";
import { App as AntApp, Button, Card, Checkbox, Form, Input, Modal, Select, Space, Table, Tag, Typography } from "antd";
import { PlusOutlined, ReloadOutlined } from "@ant-design/icons";
import { groupNames, roleLabel, supplierName, userScopeUsers, vmSupplierNames } from "../lib/helpers";

function roleTag(u) {
  var info = {
    global_admin: { text: "全局管理员", color: "gold" },
    vm: { text: "VM 账号", color: "purple" },
    supplier_admin: { text: "供应商管理员", color: "blue" },
    terminal: { text: "终端账号", color: "green" }
  }[u.role] || { text: roleLabel(u), color: "default" };
  return <Tag color={info.color}>{info.text}</Tag>;
}

const { Title, Text } = Typography;

export default function UsersPage(props) {
  const db = props.db;
  const session = props.session;
  const { message, modal } = AntApp.useApp();
  const isGlobal = session.role === "global_admin";
  const [form] = Form.useForm();
  const [batchForm] = Form.useForm();
  const [role, setRole] = useState("supplier_admin");
  const [vmGroups, setVmGroups] = useState([]);
  const [vmSupIds, setVmSupIds] = useState([]);
  const [resetUser, setResetUser] = useState(null);
  const [resetVal, setResetVal] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [batchOpen, setBatchOpen] = useState(false);
  const [roleFilter, setRoleFilter] = useState("all");

  const rows = useMemo(function () {
    return userScopeUsers(db, session).map(function (u) {
      return {
        u: u,
        gnames: u.role === "vm" ? groupNames(db, u.group_ids) : "—"
      };
    }).sort(function (a, b) { return a.u.username.localeCompare(b.u.username); });
  }, [db, session]);

  const filteredRows = useMemo(function () {
    return roleFilter === "all" ? rows : rows.filter(function (r) { return r.u.role === roleFilter; });
  }, [rows, roleFilter]);

  function changeRole(r) {
    setRole(r);
    setVmGroups([]);
    setVmSupIds([]);
    form.setFieldsValue({ supplier_id: undefined, supplier_ids: undefined, standard_ip: undefined });
  }

  function submitCreate() {
    form.validateFields().then(function (values) {
      var username = String(values.username || "").trim();
      var password = String(values.password || "");
      var displayName = String(values.display_name || "").trim();
      if (username.length < 3) { message.error("登录账号至少 3 个字符"); return; }
      if (password.length < 6) { message.error("初始密码至少 6 位"); return; }
      if (role === "global_admin") {
        db.users.push({ id: window.FaceStore.uid("u"), username: username, password: password, role: "global_admin", display_name: displayName || username, supplier_id: null, group_ids: [], terminal_id: null, person_id: null, is_active: true, created_at: window.FaceStore.nowString(), last_login_at: null });
      } else if (role === "vm") {
        var vmSupId = isGlobal ? values.supplier_id : session.supplier_id;
        var vmSupList = isGlobal ? vmSupIds.slice() : (vmSupId ? [vmSupId] : []);
        if (vmSupList.length < 1) { message.error("请至少选择一个供应商"); return; }
        db.users.push({ id: window.FaceStore.uid("u"), username: username, password: password, role: "vm", display_name: displayName || username, supplier_id: vmSupList[0] || null, supplier_ids: vmSupList, group_ids: vmGroups.slice(), terminal_id: null, person_id: null, is_active: true, created_at: window.FaceStore.nowString(), last_login_at: null });
      } else if (role === "supplier_admin") {
        var supId = isGlobal ? values.supplier_id : session.supplier_id;
        if (!supId) { message.error("请选择供应商"); return; }
        db.users.push({ id: window.FaceStore.uid("u"), username: username, password: password, role: "supplier_admin", display_name: displayName || username, supplier_id: supId, group_ids: [], terminal_id: null, person_id: null, is_active: true, created_at: window.FaceStore.nowString(), last_login_at: null });
      } else if (role === "terminal") {
        supId = isGlobal ? values.supplier_id : session.supplier_id;
        if (!supId) { message.error("请选择供应商"); return; }
        var termName = displayName;
        if (!termName) { message.error("请输入终端名称（即人脸核验点名称）"); return; }
        db.users.push({ id: window.FaceStore.uid("u"), username: username, password: password, role: "terminal", display_name: termName, supplier_id: supId, group_ids: [], terminal_id: null, standard_ip: String(values.standard_ip || "").trim() || null, person_id: null, is_active: true, created_at: window.FaceStore.nowString(), last_login_at: null });
      }
      window.FaceStore.persist(db);
      window.FaceStore.auditLog(session.display_name || session.username, session.role, "创建账号", "创建账号 " + username + "（" + roleLabel({ role: role }) + "）");
      message.success("账号已创建");
      setCreateOpen(false);
      form.resetFields();
      setRole("supplier_admin");
      setVmGroups([]);
      setVmSupIds([]);
      props.refresh();
    }).catch(function () {});
  }

  function submitBatch() {
    batchForm.validateFields().then(function (values) {
      var lines = String(values.lines || "").split(/\r?\n/).map(function (s) { return s.trim(); }).filter(Boolean);
      var created = 0, failed = 0;
      lines.forEach(function (line) {
        var parts = line.split(/[\s,，]+/).filter(Boolean);
        if (parts.length < 3) { failed++; return; }
        var username = parts[0], password = parts[1], kw = parts[2].toLowerCase(), extra = parts[3] || "";
        var role = null, supId = isGlobal ? null : session.supplier_id, termId = null, termIp = null, termName = null;
        if (/^(global|全局|admin)$/.test(kw)) role = "global_admin";
        else if (kw === "vm") role = "vm";
        else if (/^(sup|供应商)/.test(kw)) role = "supplier_admin";
        else if (/^(term|terminal|终端)/.test(kw)) role = "terminal";
        if (role === "global_admin" || role === "vm") {
          if (!isGlobal) { failed++; return; }
        } else if (role === "supplier_admin") {
          if (!isGlobal) supId = session.supplier_id;
          if (!supId) { failed++; return; }
        } else if (role === "terminal") {
          if (!isGlobal) { failed++; return; }
          termName = extra;
          var supForTerm = db.suppliers.find(function (s) { return s.name === (parts[4] || ""); });
          if (!termName || !supForTerm) { failed++; return; }
          supId = supForTerm.id;
          termIp = (parts[5] || "").trim() || null;
        } else {
          failed++; return;
        }
        if (role === "vm") {
          var supForVm = null;
          if (extra) {
            supForVm = db.suppliers.find(function (s) { return s.name === extra; });
            if (!supForVm) { failed++; return; }
          }
          db.users.push({ id: window.FaceStore.uid("u"), username: username, password: password, role: "vm", display_name: username, supplier_id: supForVm ? supForVm.id : null, supplier_ids: supForVm ? [supForVm.id] : [], group_ids: [], terminal_id: null, person_id: null, is_active: true, created_at: window.FaceStore.nowString(), last_login_at: null });
        } else if (role === "terminal") {
          db.users.push({ id: window.FaceStore.uid("u"), username: username, password: password, role: "terminal", display_name: termName, supplier_id: supId, group_ids: [], terminal_id: null, standard_ip: termIp, person_id: null, is_active: true, created_at: window.FaceStore.nowString(), last_login_at: null });
        } else {
          db.users.push({ id: window.FaceStore.uid("u"), username: username, password: password, role: role, display_name: username, supplier_id: supId, group_ids: [], terminal_id: termId, person_id: null, is_active: true, created_at: window.FaceStore.nowString(), last_login_at: null });
        }
        created++;
      });
      window.FaceStore.persist(db);
      window.FaceStore.auditLog(session.display_name || session.username, session.role, "批量创建账号", "批量创建账号 " + created + " 个" + (failed ? "，跳过 " + failed + " 行" : ""));
      message.success("已创建 " + created + " 个账号" + (failed ? "，跳过 " + failed + " 行" : ""));
      setBatchOpen(false);
      batchForm.resetFields();
      props.refresh();
    }).catch(function () {});
  }

  function saveReset() {
    var u = resetUser;
    var next = String(resetVal || "").trim();
    if (!next || next.length < 6) { message.error("密码至少 6 位"); return; }
    u.password = next;
    window.FaceStore.persist(db);
    window.FaceStore.auditLog(session.display_name || session.username, session.role, "重置密码", "重置账号 " + u.username + " 的密码");
    message.success("密码已重置");
    setResetUser(null);
    setResetVal("");
    props.refresh();
  }

  function toggle(u) {
    var action = u.is_active ? "停用" : "启用";
    modal.confirm({
      title: action + "账号 " + u.username + "？",
      okText: action,
      okButtonProps: { danger: u.is_active },
      cancelText: "取消",
      onOk: function () {
        u.is_active = !u.is_active;
        window.FaceStore.persist(db);
        window.FaceStore.auditLog(session.display_name || session.username, session.role, action + "账号", "账号 " + u.username);
        message.success("账号已" + action);
        props.refresh();
      }
    });
  }

  const columns = [
    { title: "账号", dataIndex: ["u", "username"], width: 140, render: function (v) { return <b>{v}</b>; } },
    { title: "角色", key: "role", width: 120, render: function (_, r) { return roleTag(r.u); } },
    { title: "显示名称", dataIndex: ["u", "display_name"], width: 150, render: function (v) { return v || "—"; } },
    { title: "供应商", key: "sup", width: 180, render: function (_, r) { return r.u.role === "vm" ? vmSupplierNames(db, r.u) : (r.u.supplier_id ? supplierName(db, r.u.supplier_id) : "—"); } },
    { title: "终端名称", key: "term", width: 130, render: function (_, r) { return r.u.role === "terminal" ? (r.u.display_name || r.u.username) : "—"; } },
    { title: "项目组", key: "grps", width: 160, render: function (_, r) { return r.gnames; } },
    { title: "状态", key: "active", width: 90, render: function (_, r) { return r.u.is_active ? <Tag color="success">启用</Tag> : <Tag>已停用</Tag>; } },
    { title: "最后登录", key: "last", width: 160, render: function (_, r) { return r.u.last_login_at || "—"; } },
    {
      title: "操作", key: "action", width: 180,
      render: function (_, r) {
        return (
          <Space>
            <Button size="small" onClick={function () { setResetUser(r.u); setResetVal(""); }}>重置密码</Button>
            <Button size="small" danger={r.u.is_active} onClick={function () { toggle(r.u); }}>{r.u.is_active ? "停用" : "启用"}</Button>
          </Space>
        );
      }
    }
  ];

  const supOptions = db.suppliers.map(function (s) { return { label: s.name, value: s.id }; });
  const dispLabel = role === "terminal" ? "终端名称（即人脸核验点名称）*" : "显示名称";
  const dispPlaceholder = role === "terminal" ? "如 一号门岗" : "默认与登录账号相同";

  return (
    <div>
      <div className="topbar">
        <div>
          <div className="eyebrow">Accounts</div>
          <Title level={3} style={{ margin: 0 }}>账号管理</Title>
          <Text type="secondary" style={{ display: "block", marginTop: 4 }}>
            全局管理员统一创建全局管理员 / VM / 供应商管理员 / 终端账号（终端账号即人脸核验点），并绑定项目组；支持批量创建；供应商账号不显示「账号」管理页面。
          </Text>
        </div>
        <Space>
          {isGlobal ? (
            <>
              <Button type="primary" icon={<PlusOutlined />} onClick={function () { setRole("supplier_admin"); setVmGroups([]); setVmSupIds([]); setCreateOpen(true); }}>新增账号</Button>
              <Button icon={<PlusOutlined />} onClick={function () { setBatchOpen(true); }}>批量创建账号</Button>
            </>
          ) : null}
          <Button icon={<ReloadOutlined />} onClick={props.refresh}>刷新</Button>
        </Space>
      </div>

      <Card className="page-card" style={{ marginTop: 16 }}
        title={<div>账号列表<Text type="secondary" style={{ fontSize: 12, marginLeft: 8 }}>共 {filteredRows.length} 个账号</Text></div>}>
        <Space style={{ marginBottom: 12 }} wrap>
          <Text type="secondary">账号类型：</Text>
          <Select
            value={roleFilter}
            onChange={setRoleFilter}
            style={{ width: 180 }}
            options={[
              { label: "全部账号", value: "all" },
              { label: "全局管理员", value: "global_admin" },
              { label: "VM 账号", value: "vm" },
              { label: "供应商管理员", value: "supplier_admin" },
              { label: "终端账号", value: "terminal" }
            ]}
          />
        </Space>
        <Table rowKey={function (r) { return r.u.id; }} columns={columns} dataSource={filteredRows} scroll={{ x: 1180 }} pagination={{ pageSize: 10, showTotal: function (t) { return "共 " + t + " 个"; } }} />
      </Card>

      <Modal open={resetUser !== null} title={"重置密码 · " + (resetUser ? resetUser.username : "")} okText="保存" cancelText="取消" onOk={saveReset} onCancel={function () { setResetUser(null); setResetVal(""); }} destroyOnClose>
        <Text style={{ display: "block", marginBottom: 8 }}>为账号 {resetUser ? resetUser.username : ""} 设置新密码（至少 6 位）：</Text>
        <Input.Password value={resetVal} onChange={function (e) { setResetVal(e.target.value); }} placeholder="新密码" />
      </Modal>

      {isGlobal ? (
        <Modal
          open={createOpen}
          title="新增账号"
          footer={null}
          onCancel={function () { setCreateOpen(false); }}
          destroyOnClose
        >
          <Form form={form} layout="vertical" onFinish={submitCreate} initialValues={{ role: "supplier_admin" }}>
            <Form.Item name="username" label="登录账号 *" rules={[{ required: true, message: "请输入登录账号" }]}>
              <Input placeholder="至少 3 个字符" />
            </Form.Item>
            <Form.Item name="password" label="初始密码 *" rules={[{ required: true, message: "请输入初始密码" }]}>
              <Input.Password placeholder="至少 6 位" />
            </Form.Item>
            <Form.Item name="display_name" label={dispLabel}>
              <Input placeholder={dispPlaceholder} />
            </Form.Item>
            <Form.Item name="role" label="角色">
              <Select
                options={[
                  { label: "供应商管理员", value: "supplier_admin" },
                  { label: "终端账号", value: "terminal" },
                  { label: "全局管理员", value: "global_admin" },
                  { label: "VM 账号", value: "vm" }
                ]}
                onChange={changeRole}
              />
            </Form.Item>
            {role === "vm" ? (
              <>
                <Form.Item label="绑定供应商（可多选）*" required style={{ marginBottom: 8 }}>
                  <Select
                    mode="multiple"
                    style={{ width: "100%" }}
                    placeholder="请选择供应商，可多选"
                    value={vmSupIds}
                    onChange={setVmSupIds}
                    options={supOptions}
                  />
                </Form.Item>
                <Form.Item label="绑定项目组（可多选）">
                  <Checkbox.Group
                    style={{ display: "flex", flexDirection: "column", gap: 8, padding: 12, border: "1px solid #f0f0f0", borderRadius: 8, background: "#fafafa" }}
                    options={db.groups.map(function (g) { return { label: g.name, value: g.id }; })}
                    value={vmGroups}
                    onChange={setVmGroups}
                  />
                </Form.Item>
              </>
            ) : null}
            {role === "supplier_admin" ? (
              <Form.Item name="supplier_id" label="供应商 *" rules={[{ required: true, message: "请选择供应商" }]}>
                <Select options={supOptions} placeholder="请选择供应商" />
              </Form.Item>
            ) : null}
            {role === "terminal" ? (
              <>
                <Form.Item name="supplier_id" label="供应商 *" rules={[{ required: true, message: "请选择供应商" }]}>
                  <Select options={supOptions} placeholder="请选择供应商" />
                </Form.Item>
                <Form.Item name="standard_ip" label="标准 IP">
                  <Input placeholder="如 192.168.1.10" />
                </Form.Item>
              </>
            ) : null}
            <Form.Item style={{ marginBottom: 0 }}>
              <Button type="primary" htmlType="submit" icon={<PlusOutlined />}>创建账号</Button>
            </Form.Item>
          </Form>
        </Modal>
      ) : null}

      {isGlobal ? (
        <Modal
          open={batchOpen}
          title="批量创建账号"
          width={680}
          footer={null}
          onCancel={function () { setBatchOpen(false); }}
          destroyOnClose
        >
          <Form form={batchForm} layout="vertical" onFinish={submitBatch}>
            <Form.Item name="lines" label="每行：账号 密码 角色（角色：全局/VM/供应商/终端；VM：第 4 列供应商名称可选；终端：第 4 列终端名称、第 5 列供应商、第 6 列标准 IP 可选）">
              <Input.TextArea className="batch-box" placeholder="term2 123456 终端 二号门岗 甲辰保洁服务 192.168.1.12" />
            </Form.Item>
            <Form.Item style={{ marginBottom: 0 }}>
              <Button htmlType="submit">批量创建</Button>
            </Form.Item>
          </Form>
        </Modal>
      ) : null}
    </div>
  );
}
