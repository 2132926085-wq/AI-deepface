import React, { useMemo, useState } from "react";
import { App as AntApp, Button, Card, Input, Space, Table, Tag, Typography } from "antd";
import { ReloadOutlined } from "@ant-design/icons";
import { supplierName } from "../lib/helpers";

const { Title, Text } = Typography;

export default function IpPage(props) {
  const db = props.db;
  const session = props.session;
  const { message } = AntApp.useApp();
  const [ips, setIps] = useState({});

  const rows = useMemo(function () {
    return db.users.filter(function (u) {
      return u.role === "terminal" && (!session.supplier_id || u.supplier_id === session.supplier_id);
    });
  }, [db, session]);

  function valueFor(u) {
    return ips[u.id] !== undefined ? ips[u.id] : (u.standard_ip || "");
  }

  function save(u) {
    var next = String(valueFor(u) || "").trim();
    u.standard_ip = next || null;
    window.FaceStore.persist(db);
    window.FaceStore.auditLog(session.display_name || session.username, session.role, "配置标准IP", "终端账号「" + u.username + "」标准 IP 设置为 " + (next || "空"));
    message.success("已保存「" + (u.display_name || u.username) + "」的标准 IP");
    setIps(function (prev) { var n = Object.assign({}, prev); delete n[u.id]; return n; });
    props.refresh();
  }

  const columns = [
    { title: "终端账号", dataIndex: "username", width: 160, render: function (v) { return <b>{v}</b>; } },
    { title: "终端名称", dataIndex: "display_name", width: 150 },
    { title: "供应商", key: "sup", width: 170, render: function (_, u) { return supplierName(db, u.supplier_id); } },
    {
      title: "标准 IP", key: "ip", width: 240,
      render: function (_, u) {
        return <Input style={{ width: 210 }} value={valueFor(u)} placeholder="如 192.168.1.10" onChange={function (e) { setIps(Object.assign({}, ips, { [u.id]: e.target.value })); }} />;
      }
    },
    {
      title: "状态", key: "st", width: 150,
      render: function (_, u) {
        return u.standard_ip ? <Tag color="success">已启用校验</Tag> : <Tag>未配置（不校验）</Tag>;
      }
    },
    {
      title: "操作", key: "action", width: 90,
      render: function (_, u) { return <Button size="small" type="primary" ghost onClick={function () { save(u); }}>保存</Button>; }
    }
  ];

  return (
    <div>
      <div className="topbar">
        <div>
          <div className="eyebrow">IP control</div>
          <Title level={3} style={{ margin: 0 }}>终端账号 IP 管控</Title>
          <Text type="secondary" style={{ display: "block", marginTop: 4 }}>
            为每个终端账号（即人脸核验点）配置「标准 IP」。终端每次核验时检测终端所在 IP，与标准 IP 不一致会提示预警并直接禁止核验、写入审计。仅全局管理员可配置，供应商不能更改。
          </Text>
        </div>
        <Button icon={<ReloadOutlined />} onClick={props.refresh}>刷新</Button>
      </div>

      <Card className="page-card" style={{ marginTop: 16 }}
        title={<div>标准 IP 配置<Text type="secondary" style={{ fontSize: 12, marginLeft: 8 }}>共 {rows.length} 个终端账号 · 保存后立即生效</Text></div>}>
        <Table
          rowKey="id"
          scroll={{ x: "max-content" }}
          columns={columns}
          dataSource={rows}
          pagination={false}
          locale={{ emptyText: "还没有终端账号。" }}
        />
        <Text type="secondary" style={{ display: "block", marginTop: 12, fontSize: 12 }}>
          演示中可到「人脸核验」页勾选「模拟 IP 异常」验证禁止人脸核验。
        </Text>
      </Card>
    </div>
  );
}
