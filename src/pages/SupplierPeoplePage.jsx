import React, { useEffect, useMemo, useState } from "react";
import { Avatar, Button, Card, Descriptions, Image, Modal, Select, Space, Table, Tag, Typography } from "antd";
import { ReloadOutlined } from "@ant-design/icons";
import { groupNames, personProjectNames, photoCountText, supplier, supplierName, vmSupplierIds } from "../lib/helpers";

const { Title, Text } = Typography;

function modeText(m) {
  if (m === "centralized") return "集中人脸核验";
  if (m === "individual") return "个人人脸核验";
  if (m === "mixed") return "混合";
  return "—";
}

function PersonFace(props) {
  const p = props.p;
  if (p && p.photos && p.photos.length) {
    return <img src={p.photos[0]} alt={p.name || ""} style={{ width: 40, height: 40, borderRadius: 8, objectFit: "cover", flexShrink: 0 }} />;
  }
  return (
    <Avatar shape="square" size={40} style={{ background: "#e6f4ff", color: "#1677ff", fontWeight: 600, flexShrink: 0 }}>
      {String(p && p.name ? p.name : "?").slice(0, 1)}
    </Avatar>
  );
}

export default function SupplierPeoplePage(props) {
  const db = props.db;
  const session = props.session;
  const [detail, setDetail] = useState(null);
  const [selSupId, setSelSupId] = useState("");

  const supIds = useMemo(function () {
    return vmSupplierIds(session);
  }, [db, session]);

  useEffect(function () {
    if (supIds.indexOf(selSupId) < 0) setSelSupId(supIds[0] || "");
  }, [supIds, selSupId]);

  const sup = useMemo(function () {
    return selSupId ? supplier(db, selSupId) : null;
  }, [db, selSupId]);

  const rows = useMemo(function () {
    if (!selSupId) return [];
    return db.people.filter(function (p) { return p.supplier_id === selSupId; })
      .map(function (p) { return p; })
      .sort(function (a, b) {
        return String(a.employee_code || "").localeCompare(String(b.employee_code || ""), undefined, { numeric: true });
      });
  }, [db, selSupId]);

  const columns = [
    {
      title: "人员", key: "person", width: 260,
      render: function (_, p) {
        return (
          <div className="person-row clickable" style={{ cursor: "pointer" }} onClick={function () { setDetail(p); }} title="点击查看详情">
            <PersonFace p={p} />
            <div className="info">
              <div className="name">{p.name}</div>
              <div className="sub">{p.employee_code || "—"}</div>
            </div>
            <span className="person-go">详情 ›</span>
          </div>
        );
      }
    },
    { title: "编号", dataIndex: "employee_code", width: 110, render: function (v) { return v || "—"; } },
    { title: "项目组", key: "grps", width: 180, render: function (_, p) { return groupNames(db, p.group_ids); } },
    { title: "项目", key: "prjs", render: function (_, p) { return personProjectNames(db, p); } },
    {
      title: "状态", key: "active", width: 100,
      render: function (_, p) {
        return p.consent_status === "agreed" ? <Tag color="success">已激活</Tag> : <Tag>未激活</Tag>;
      }
    },
    { title: "照片", key: "photos", width: 90, render: function (_, p) { return photoCountText(p); } },
    {
      title: "操作", key: "action", width: 90,
      render: function (_, p) { return <Button size="small" onClick={function () { setDetail(p); }}>查看</Button>; }
    }
  ];

  return (
    <div>
      <div className="topbar">
        <div>
          <div className="eyebrow">Supplier</div>
          <Title level={3} style={{ margin: 0 }}>供应商管理</Title>
          <Text type="secondary" style={{ display: "block", marginTop: 4 }}>
            展示当前 VM 绑定供应商的全部人员；可在右侧切换供应商；点击人员可查看照片、项目组与项目。
          </Text>
        </div>
        <Space>
          <Select
            style={{ width: 220 }}
            placeholder="选择供应商"
            disabled={supIds.length === 0}
            value={selSupId || undefined}
            onChange={function (v) { setSelSupId(v || ""); }}
            options={supIds.map(function (id) { var s = supplier(db, id); return { label: s ? s.name : id, value: id }; })}
          />
          <Button icon={<ReloadOutlined />} onClick={props.refresh}>刷新</Button>
        </Space>
      </div>

      {sup ? (
        <Card className="page-card" style={{ marginTop: 16 }}>
          <Space size={24} wrap>
            <div>
              <Text type="secondary" style={{ display: "block", fontSize: 12 }}>供应商名称</Text>
              <Title level={4} style={{ margin: 0 }}>{sup.name}</Title>
            </div>
            <div>
              <Text type="secondary" style={{ display: "block", fontSize: 12 }}>编码</Text>
              <Text strong>{sup.code || "—"}</Text>
            </div>
            <div>
              <Text type="secondary" style={{ display: "block", fontSize: 12 }}>人脸核验模式</Text>
              <Text strong>{modeText(sup.clock_mode)}</Text>
            </div>
            <div>
              <Text type="secondary" style={{ display: "block", fontSize: 12 }}>人员总数</Text>
              <Text strong>{rows.length} 人</Text>
            </div>
          </Space>
        </Card>
      ) : null}

      <Card
        className="page-card"
        style={{ marginTop: 16 }}
        title={<div>供应商人员列表<Text type="secondary" style={{ fontSize: 12, marginLeft: 8 }}>共 {rows.length} 人</Text></div>}
      >
        <Table
          rowKey="id"
          columns={columns}
          dataSource={rows}
          scroll={{ x: "max-content" }}
          pagination={false}
          locale={{ emptyText: supIds.length ? (sup ? "该供应商还没有人员。" : "请选择供应商。") : "当前 VM 未绑定供应商，请联系全局管理员在「供应商」页面绑定。" }}
        />
      </Card>

      <Modal open={detail !== null} title="人员详情" footer={null} onCancel={function () { setDetail(null); }}>
        {detail ? (
          <Space direction="vertical" size={16} style={{ width: "100%" }}>
            <Space align="center" size={16}>
              {detail.photos && detail.photos.length ? (
                <Avatar shape="square" size={72} src={detail.photos[0]} />
              ) : (
                <Avatar shape="square" size={72} style={{ background: "#e6f4ff", color: "#1677ff", fontWeight: 600 }}>
                  {String(detail.name || "?").slice(0, 1)}
                </Avatar>
              )}
              <div>
                <Title level={4} style={{ margin: 0 }}>{detail.name}</Title>
                <Text type="secondary">{detail.employee_code} · {supplierName(db, detail.supplier_id)}</Text>
              </div>
            </Space>
            <Descriptions column={1} bordered size="small">
              <Descriptions.Item label="人员编号">{detail.employee_code || "—"}</Descriptions.Item>
              <Descriptions.Item label="供应商">{supplierName(db, detail.supplier_id)}</Descriptions.Item>
              <Descriptions.Item label="项目">{personProjectNames(db, detail)}</Descriptions.Item>
              <Descriptions.Item label="项目组">{groupNames(db, detail.group_ids)}</Descriptions.Item>
              <Descriptions.Item label="状态">
                {detail.consent_status === "agreed" ? <Tag color="success">已激活</Tag> : <Tag>未激活</Tag>}
              </Descriptions.Item>
              <Descriptions.Item label="照片">{photoCountText(detail)}</Descriptions.Item>
            </Descriptions>
            {detail.photos && detail.photos.length ? (
              <Image.PreviewGroup>
                <Space wrap>
                  {detail.photos.map(function (src, i) {
                    return <Image key={i} width={96} src={src} />;
                  })}
                </Space>
              </Image.PreviewGroup>
            ) : null}
          </Space>
        ) : null}
      </Modal>
    </div>
  );
}
