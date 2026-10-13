import React, { useState } from "react";
import { Alert, Button, Card, Divider, Form, Input, Space, Typography } from "antd";
import { LockOutlined, UserOutlined } from "@ant-design/icons";

const { Title, Text } = Typography;

const QUICK = [
  { username: "admin", label: "全局管理员（admin / admin123）" },
  { username: "vm_li", label: "VM 账号（vm_li / vm123）" },
  { username: "sup_a_admin", label: "供应商管理员·甲辰（sup_a_admin / a123）" },
  { username: "sup_b_admin", label: "供应商管理员·星辰（sup_b_admin / b123）" },
  { username: "terminal_a1", label: "终端账号·一号门岗（terminal_a1 / t123）" }
];

export default function LoginPage(props) {
  const db = props.db;
  const [err, setErr] = useState("");
  const [form] = Form.useForm();

  function tryLogin(username, password) {
    var u = props.onLogin(username, password);
    if (!u) setErr("账号或密码错误，或账号已停用。");
    return u;
  }

  return (
    <div className="login-shell">
      <Card className="login-card page-card">
        <div className="brand" style={{ padding: 0, marginBottom: 20 }}>
          <div className="brand-mark">F</div>
          <div>
            <div className="brand-title">FaceOps</div>
            <div className="brand-subtitle">集中人脸核验平台 · 演示版</div>
          </div>
        </div>
        <div className="eyebrow">Secure workspace</div>
        <Title level={3} style={{ marginTop: 2, marginBottom: 8 }}>欢迎回来</Title>
        <Text type="secondary" style={{ display: "block", marginBottom: 4 }}>
          纯前端演示环境，数据保存在浏览器本地，不接真实接口。请使用演示账号登录体验不同角色的权限。
        </Text>
        {err ? (
          <Alert type="error" showIcon message={err} style={{ margin: "14px 0" }} closable onClose={function () { setErr(""); }} />
        ) : null}
        <Form form={form} layout="vertical" onFinish={function (v) { tryLogin(v.username, v.password); }} style={{ marginTop: 8 }}>
          <Form.Item name="username" label="账号" rules={[{ required: true, message: "请输入账号" }]}>
            <Input prefix={<UserOutlined />} placeholder="请输入账号" autoComplete="username" size="large" />
          </Form.Item>
          <Form.Item name="password" label="密码" rules={[{ required: true, message: "请输入密码" }]}>
            <Input.Password prefix={<LockOutlined />} placeholder="请输入密码" autoComplete="current-password" size="large" />
          </Form.Item>
          <Button type="primary" htmlType="submit" block size="large">登录</Button>
        </Form>
        <Divider style={{ margin: "20px 0 8px" }} plain>快速登录（演示用）</Divider>
        <Space direction="vertical" style={{ width: "100%" }} size={8}>
          {QUICK.map(function (q) {
            var u = db.users.find(function (x) { return x.username === q.username; });
            return (
              <Button key={q.username} block onClick={function () { tryLogin(q.username, u ? u.password : ""); }}>
                {q.label}
              </Button>
            );
          })}
        </Space>
      </Card>
    </div>
  );
}