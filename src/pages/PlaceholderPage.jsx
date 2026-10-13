import React from "react";
import { Card, Result } from "antd";
import { BuildOutlined } from "@ant-design/icons";

export default function PlaceholderPage(props) {
  const label = props.label || "该页面";
  return (
    <Card className="page-card">
      <Result
        icon={<BuildOutlined style={{ color: "#1677ff" }} />}
        title={"「" + label + "」建设中"}
        subTitle="该页面尚未迁移到 AntD 试点版，原有功能保持不变；可到原版演示（face-demo）查看完整功能。"
      />
    </Card>
  );
}