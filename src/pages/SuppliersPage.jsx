import React, { useMemo, useState } from "react";
import { App as AntApp, Button, Card, Form, Input, Modal, Select, Space, Table, Tag, Typography } from "antd";
import { PlusOutlined, ReloadOutlined } from "@ant-design/icons";
import { supplier, vmSupplierIds } from "../lib/helpers";

const { Title, Text } = Typography;

function modeText(m) {
  if (m === "centralized") return "集中人脸核验";
  if (m === "individual") return "个人人脸核验";
  if (m === "mixed") return "混合";
  return "—";
}

export default function SuppliersPage(props) {
  const db = props.db;
  const session = props.session;
  const { message, modal } = AntApp.useApp();
  const [form] = Form.useForm();
  const [rename, setRename] = useState(null); // supplier
  const [createOpen, setCreateOpen] = useState(false);
  const [bindSup, setBindSup] = useState(null);
  const [bindVmIds, setBindVmIds] = useState([]);

  const rows = useMemo(function () {
    return db.suppliers.map(function (s) {
      return {
        s: s,
        people: db.people.filter(function (p) { return p.supplier_id === s.id; }).length,
        terminals: db.users.filter(function (u) { return u.role === "terminal" && u.supplier_id === s.id; }).length,
        accounts: db.users.filter(function (u) {
          if (u.role === "vm") return vmSupplierIds(u).indexOf(s.id) >= 0;
          return u.supplier_id === s.id;
        }).length,
        vms: db.users.filter(function (u) { return u.role === "vm" && vmSupplierIds(u).indexOf(s.id) >= 0; })
      };
    });
  }, [db]);

  function createSupplier(values) {
    db.suppliers.push({
      id: window.FaceStore.uid("sup"),
      code: String(values.code || "").trim(),
      name: String(values.name || "").trim(),
      clock_mode: values.clock_mode || "centralized",
      is_active: true
    });
    window.FaceStore.persist(db);
    window.FaceStore.auditLog(session.display_name || session.username, session.role, "创建供应商", "创建供应商「" + String(values.name || "").trim() + "」（" + String(values.code || "").trim() + "）");
    message.success("供应商已创建");
    setCreateOpen(false);
    form.resetFields();
    props.refresh();
  }

  function saveRename() {
    var s = supplier(db, rename.id);
    var name = rename.name.trim();
    if (!name || name === s.name) { setRename(null); return; }
    s.name = name;
    window.FaceStore.persist(db);
    window.FaceStore.auditLog(session.display_name || session.username, session.role, "修改供应商", "供应商「" + s.name + "」改名");
    message.success("供应商已改名");
    setRename(null);
    props.refresh();
  }

  function toggle(s) {
    var action = s.is_active ? "停用" : "启用";
    modal.confirm({
      title: action + "供应商「" + s.name + "」？",
      content: action === "停用" ? "停用后该供应商账号无法登录。" : "启用后该供应商账号恢复登录。",
      okText: action,
      okButtonProps: { danger: s.is_active },
      cancelText: "取消",
      onOk: function () {
        s.is_active = !s.is_active;
        window.FaceStore.persist(db);
        window.FaceStore.auditLog(session.display_name || session.username, session.role, action + "供应商", "供应商「" + s.name + "」");
        message.success("供应商已" + action);
        props.refresh();
      }
    });
  }

  function boundVms(s) {
    return db.users.filter(function (u) { return u.role === "vm" && vmSupplierIds(u).indexOf(s.id) >= 0; });
  }

  function openBindVm(s) {
    setBindSup(s);
    setBindVmIds(boundVms(s).filter(function (u) { return u.is_active; }).map(function (u) { return u.id; }));
  }

  function saveBindVm() {
    var s = bindSup ? db.suppliers.find(function (x) { return x.id === bindSup.id; }) : null;
    if (!s) { setBindSup(null); return; }
    var activeVms = db.users.filter(function (u) { return u.role === "vm" && u.is_active; });
    activeVms.forEach(function (u) {
      var selected = bindVmIds.indexOf(u.id) >= 0;
      var ids = vmSupplierIds(u);
      var idx = ids.indexOf(s.id);
      if (selected && idx < 0) ids.push(s.id);
      if (!selected && idx >= 0) ids.splice(idx, 1);
      u.supplier_ids = ids;
      u.supplier_id = ids[0] || null;
    });
    var names = db.users.filter(function (u) { return bindVmIds.indexOf(u.id) >= 0; })
      .map(function (u) { return u.display_name || u.username; })
      .join("、") || "无";
    window.FaceStore.persist(db);
    window.FaceStore.auditLog(session.display_name || session.username, session.role, "绑定VM", "供应商「" + s.name + "」绑定 VM：" + names);
    message.success("已更新供应商「" + s.name + "」的绑定 VM");
    setBindSup(null);
    props.refresh();
  }

  const columns = [
    { title: "名称", dataIndex: ["s", "name"], width: 200, render: function (v, r) { return <b>{v}</b>; } },
    { title: "编码", dataIndex: ["s", "code"], width: 120 },
    { title: "人脸核验模式", dataIndex: ["s", "clock_mode"], width: 110, render: function (m) { return modeText(m); } },
    { title: "人员", dataIndex: "people", width: 80 },
    { title: "终端账号", dataIndex: "terminals", width: 100 },
    { title: "账号", dataIndex: "accounts", width: 80 },
    {
      title: "已绑定 VM", key: "vms", width: 240,
      render: function (_, r) {
        if (!r.vms.length) return <Text type="secondary">—</Text>;
        return (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {r.vms.map(function (u) {
              return u.is_active
                ? <Tag key={u.id} color="purple">{u.display_name || u.username}</Tag>
                : <Tag key={u.id}>{u.display_name || u.username}（停用）</Tag>;
            })}
          </div>
        );
      }
    },
    {
      title: "状态", dataIndex: ["s", "is_active"], width: 90,
      render: function (v) { return v ? <Tag color="success">启用</Tag> : <Tag color="default">已停用</Tag>; }
    },
    {
      title: "操作", key: "action", width: 180,
      render: function (_, r) {
        return (
          <Space>
            <Button size="small" onClick={function () { openBindVm(r.s); }}>绑定VM</Button>
            <Button size="small" onClick={function () { setRename({ id: r.s.id, name: r.s.name }); }}>改名</Button>
            <Button size="small" danger={r.s.is_active} onClick={function () { toggle(r.s); }}>{r.s.is_active ? "停用" : "启用"}</Button>
          </Space>
        );
      }
    }
  ];

  return (
    <div>
      <div className="topbar">
        <div>
          <div className="eyebrow">Tenants</div>
          <Title level={3} style={{ margin: 0 }}>供应商管理</Title>
          <Text type="secondary" style={{ display: "block", marginTop: 4 }}>
            供应商即租户：人员库、终端账号按供应商隔离；供应商之间不能互相看到人员，也不能跨供应商人脸核验。本期只做集中人脸核验。
          </Text>
        </div>
        <Space>
          <Button type="primary" icon={<PlusOutlined />} onClick={function () { setCreateOpen(true); }}>新增供应商</Button>
          <Button icon={<ReloadOutlined />} onClick={props.refresh}>刷新</Button>
        </Space>
      </div>

      <div style={{ marginTop: 16 }}>
        <Card
          className="page-card"
          style={{ marginTop: 0 }}
          title={<div>供应商列表<Text type="secondary" style={{ fontSize: 12, marginLeft: 8 }}>共 {rows.length} 个供应商</Text></div>}
        >
          <Table rowKey={function (r) { return r.s.id; }} scroll={{ x: "max-content" }} columns={columns} dataSource={rows} pagination={false} />
        </Card>
      </div>

      <Modal
        open={createOpen}
        title="新增供应商"
        footer={null}
        onCancel={function () { setCreateOpen(false); }}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={createSupplier}>
          <Form.Item name="code" label="供应商编码" rules={[{ required: true, message: "请输入供应商编码" }]}>
            <Input placeholder="如 SUPPLIER-A" />
          </Form.Item>
          <Form.Item name="name" label="供应商名称" rules={[{ required: true, message: "请输入供应商名称" }]}>
            <Input placeholder="如 某保洁服务公司" />
          </Form.Item>
          <Form.Item name="clock_mode" label="人脸核验模式" initialValue="centralized">
            <Select options={[{ label: "集中人脸核验", value: "centralized" }]} />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0 }}>
            <Button type="primary" htmlType="submit" icon={<PlusOutlined />}>创建供应商</Button>
          </Form.Item>
          <Text type="secondary" style={{ display: "block", fontSize: 12, marginTop: 8 }}>本期只实现集中人脸核验。</Text>
        </Form>
      </Modal>

      <Modal
        open={!!rename}
        title="修改供应商名称"
        okText="保存"
        cancelText="取消"
        onOk={saveRename}
        onCancel={function () { setRename(null); }}
        destroyOnClose
      >
        <Text style={{ display: "block", marginBottom: 8 }}>新的供应商名称：</Text>
        <Input value={rename ? rename.name : ""} onChange={function (e) { setRename({ id: rename.id, name: e.target.value }); }} />
      </Modal>

      <Modal
        open={!!bindSup}
        title={bindSup ? "绑定VM · 供应商「" + bindSup.name + "」" : "绑定VM"}
        okText="保存"
        cancelText="取消"
        onOk={saveBindVm}
        onCancel={function () { setBindSup(null); }}
        destroyOnClose
      >
        <Text type="secondary" style={{ display: "block", marginBottom: 12 }}>
          选择归属于该供应商的 VM 账号；支持多选，取消勾选即解除绑定；一个 VM 可同时绑定多个供应商。供应商侧可在「对应VM」页面查看。
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
    </div>
  );
}
