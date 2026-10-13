import React, { useMemo } from "react";
import { Button, Card, Space, Table, Tag, Typography } from "antd";
import { ReloadOutlined } from "@ant-design/icons";
import { groupNames, supplierName, vmSupplierIds } from "../lib/helpers";

const { Title, Text } = Typography;

export default function SupplierVmPage(props) {
  const db = props.db;
  const session = props.session;

  const rows = useMemo(function () {
    return db.users.filter(function (u) {
      return u.role === "vm" && vmSupplierIds(u).indexOf(session.supplier_id) >= 0;
    }).map(function (u) {
      return { u: u, gnames: groupNames(db, u.group_ids) };
    }).sort(function (a, b) { return a.u.username.localeCompare(b.u.username); });
  }, [db, session]);

  const columns = [
    { title: "账号", dataIndex: ["u", "username"], width: 160, render: function (v) { return <b>{v}</b>; } },
    { title: "显示名称", dataIndex: ["u", "display_name"], width: 160, render: function (v) { return v || "—"; } },
    { title: "负责项目组", dataIndex: "gnames", width: 220, render: function (v) { return v || "—"; } },
    {
      title: "状态", key: "active", width: 100,
      render: function (_, r) { return r.u.is_active ? <Tag color="success">启用</Tag> : <Tag>已停用</Tag>; }
    },
    { title: "最后登录", dataIndex: ["u", "last_login_at"], width: 170, render: function (v) { return v || "—"; } }
  ];

  return (
    <div>
      <div className="topbar">
        <div>
          <div className="eyebrow">My VM</div>
          <Title level={3} style={{ margin: 0 }}>对应VM</Title>
          <Text type="secondary" style={{ display: "block", marginTop: 4 }}>
            由全局管理员在「供应商」页面绑定；这里展示归属本供应商「{supplierName(db, session.supplier_id)}」的 VM 账号。
          </Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={props.refresh}>刷新</Button>
        </Space>
      </div>

      <Card
        className="page-card"
        style={{ marginTop: 16 }}
        title={<div>已绑定 VM<Text type="secondary" style={{ fontSize: 12, marginLeft: 8 }}>共 {rows.length} 个</Text></div>}
      >
        <Table
          rowKey={function (r) { return r.u.id; }}
          columns={columns}
          dataSource={rows}
          scroll={{ x: "max-content" }}
          pagination={false}
          locale={{ emptyText: "暂无绑定到本供应商的 VM 账号。" }}
        />
      </Card>
    </div>
  );
}
