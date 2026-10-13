import React, { useMemo } from "react";
import { Button, Card, Table, Typography } from "antd";
import { ReloadOutlined } from "@ant-design/icons";
import { group, roleLabel, supplierName } from "../lib/helpers";

const { Title, Text } = Typography;

export default function AuditPage(props) {
  const db = props.db;
  const session = props.session;

  const list = useMemo(function () {
    var all = db.audit.slice();
    if (session.role === "global_admin") return all;
    if (session.role === "supplier_admin") {
      var supName = session.supplier_name || supplierName(db, session.supplier_id);
      var self = session.display_name || session.username;
      return all.filter(function (a) {
        return a.operator === self || (a.detail || "").indexOf(supName) >= 0 || (a.action || "").indexOf("供应商") >= 0;
      });
    }
    if (session.role === "vm") {
      var gNames = (session.group_ids || []).map(function (gid) { var g = group(db, gid); return g ? g.name : ""; }).filter(Boolean);
      var myPeople = db.people.filter(function (p) { return (p.group_ids || []).some(function (g) { return (session.group_ids || []).indexOf(g) >= 0; }); }).map(function (p) { return p.name; });
      var self2 = session.display_name || session.username;
      return all.filter(function (a) {
        if (a.operator === self2) return true;
        var d = a.detail || "";
        return gNames.some(function (n) { return d.indexOf(n) >= 0; }) || myPeople.some(function (n) { return d.indexOf(n) >= 0; });
      });
    }
    return [];
  }, [db, session]);

  const columns = [
    { title: "时间", dataIndex: "time", width: 170 },
    { title: "操作人", dataIndex: "operator", width: 150 },
    { title: "角色", key: "role", width: 130, render: function (_, a) { return roleLabel({ role: a.role }); } },
    { title: "操作", dataIndex: "action", width: 170 },
    { title: "详情", dataIndex: "detail" }
  ];

  return (
    <div>
      <div className="topbar">
        <div>
          <div className="eyebrow">Audit trail</div>
          <Title level={3} style={{ margin: 0 }}>审计日志</Title>
          <Text type="secondary" style={{ display: "block", marginTop: 4 }}>
            入项、移出、离项、IP 禁止、同意免责等关键操作都会留痕。演示环境为简化展示，供应商管理员与 VM 按与自身相关的记录过滤。
          </Text>
        </div>
        <Button icon={<ReloadOutlined />} onClick={props.refresh}>刷新</Button>
      </div>

      <Card className="page-card" style={{ marginTop: 16 }}
        title={<div>操作留痕<Text type="secondary" style={{ fontSize: 12, marginLeft: 8 }}>共 {list.length} 条</Text></div>}>
        <Table
          rowKey="id"
          scroll={{ x: "max-content" }}
          columns={columns}
          dataSource={list}
          pagination={{ pageSize: 15, showTotal: function (t) { return "共 " + t + " 条"; } }}
          locale={{ emptyText: "暂无操作记录。" }}
        />
      </Card>
    </div>
  );
}
