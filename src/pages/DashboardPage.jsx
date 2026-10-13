import React, { useEffect, useMemo, useState } from "react";
import { Button, Card, Col, Row, Tag, Typography } from "antd";
import { LogoutOutlined } from "@ant-design/icons";
import { nav, personHasProject, roleLabel, supplierName, vmSupplierNames } from "../lib/helpers";
import { ui } from "../lib/ui";
import useCountUp from "../lib/useCountUp";

const { Title, Text } = Typography;

function StatCard(props) {
  const value = useCountUp(props.value);
  const color = props.color || "#1677ff";
  const iconBg = props.iconBg || "#e6f4ff";
  return (
    <Card
      className={"stat-card" + (props.onClick ? " clickable" : "")}
      style={{ animationDelay: (props.delay || 0) + "s", height: "100%" }}
      onClick={props.onClick}
    >
      <div className="stat-ribbon" style={{ background: "linear-gradient(90deg, " + color + ", " + color + "55)" }} />
      <div className="stat-inner">
        {props.icon ? (
          <div className="stat-emoji" style={{ background: iconBg, color: color }}>{props.icon}</div>
        ) : null}
        <div>
          <div className="stat-label" style={{ color: color }}>{props.label}</div>
          <div className="stat-value" style={{ color: color }}>{value}</div>
          <div className="stat-note">{props.note}</div>
        </div>
      </div>
      {props.children}
    </Card>
  );
}

function greeting() {
  var h = new Date().getHours();
  if (h < 6) return "凌晨好";
  if (h < 12) return "早上好";
  if (h < 14) return "中午好";
  if (h < 18) return "下午好";
  return "晚上好";
}

export default function DashboardPage(props) {
  const db = props.db;
  const session = props.session;
  const today = window.FaceStore.localDateString();
  const set = window.FaceStore.todaysClockinSet(db);
  const isTerm = session.role === "terminal";
  const [now, setNow] = useState(new Date());
  useEffect(function () {
    var t = setInterval(function () { setNow(new Date()); }, 1000);
    return function () { clearInterval(t); };
  }, []);

  const people = useMemo(function () {
    var list = db.people.filter(function (p) { return p.is_active; });
    if (session.role === "supplier_admin") list = list.filter(function (p) { return p.supplier_id === session.supplier_id; });
    if (session.role === "terminal") list = list.filter(function (p) { return p.supplier_id === session.supplier_id; });
    if (session.role === "vm") list = list.filter(function (p) { return (p.group_ids || []).some(function (g) { return (session.group_ids || []).indexOf(g) >= 0; }); });
    return list;
  }, [db, session]);

  const termSet = useMemo(function () {
    var tset = {};
    (db.records || []).forEach(function (r) {
      if (r.terminal_id === session.id && r.occurred_at && r.occurred_at.slice(0, 10) === today && r.status === "recognized" && r.person_id) {
        tset[r.person_id] = true;
      }
    });
    return tset;
  }, [db, session, today]);

  const done = people.filter(function (p) { return (isTerm ? termSet[p.id] : set[p.id]); }).length;
  const rate = people.length ? Math.round(done / people.length * 100) : 0;
  const isSup = session.role === "supplier_admin";
  const supProjects = useMemo(function () {
    if (!isSup) return [];
    return db.projects.filter(function (pr) {
      if (pr.supplier_id === session.supplier_id) return true;
      return db.people.some(function (p) { return p.is_active && p.supplier_id === session.supplier_id && personHasProject(p, pr.id); });
    });
  }, [db, session, isSup]);
  const week = ["日", "一", "二", "三", "四", "五", "六"][new Date().getDay()];

  function jumpRecords(tab) {
    ui.rec.tab = tab;
    ui.rec.date = today;
    ui.rec.month = today.slice(0, 7);
    nav("records");
  }

  function welcomeLead() {
    if (isTerm) return "终端账号即人脸核验点：这里显示今日人脸核验概况，点击卡片可查看对应明细。";
    if (session.role === "vm") return "欢迎回来，这是你的工作台：今日人脸核验概况一目了然。";
    if (session.role === "supplier_admin") return "欢迎回来：维护本供应商的人员库、发起入项 / 离项申请。";
    return "欢迎回来，这是全平台管理控制台：今日人脸核验概况一目了然。";
  }

  if (isTerm) {
    var termName = session.supplier_name || supplierName(db, session.supplier_id);
    var timeStr = now.toLocaleTimeString("zh-CN", { hour12: false });
    return (
      <div className="term-kiosk">
        <div className="term-kiosk-head">
          <span className="term-kiosk-time">{today} 星期{week} · {timeStr}</span>
          {props.onLogout ? (
            <Button icon={<LogoutOutlined />} onClick={props.onLogout}>退出登录</Button>
          ) : null}
        </div>
        <div className="term-kiosk-main">
          <div className="term-kiosk-eyebrow">集中人脸核验</div>
          <div className="term-kiosk-title">人脸核验系统</div>
          <div className="term-kiosk-sup">{termName}</div>
          <div className="term-kiosk-sub">欢迎使用 · 点击下方卡片查看今日人脸核验明细</div>
        </div>
        <div className="term-kiosk-stats">
          <div className="term-kiosk-card clickable" onClick={function () { jumpRecords("done"); }}>
            <div className="term-kiosk-card-icon">✅</div>
            <div className="term-kiosk-card-label">今日已人脸核验</div>
            <div className="term-kiosk-card-value" style={{ color: "#52c41a" }}>{done}</div>
            <div className="term-kiosk-card-note">点击查看 →</div>
          </div>
          <div className="term-kiosk-card clickable" onClick={function () { jumpRecords("missing"); }}>
            <div className="term-kiosk-card-icon">⏰</div>
            <div className="term-kiosk-card-label">今日未人脸核验</div>
            <div className="term-kiosk-card-value" style={{ color: "#fa8c16" }}>{people.length - done}</div>
            <div className="term-kiosk-card-note">点击查看 →</div>
          </div>
        </div>
        <div className="term-kiosk-nav">
          <Button type="primary" size="large" onClick={function () { nav("clock"); }}>前往人脸核验</Button>
          <Button size="large" onClick={function () { nav("records"); }}>查看人脸核验记录</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="page-fade">
      <div className="welcome-hero">
        <div className="welcome-hero-content">
          <div className="eyebrow">Welcome</div>
          <Title level={2} style={{ margin: "4px 0 8px", fontSize: 34, lineHeight: 1.25 }}>{greeting()}，{session.display_name || session.username}</Title>
          <Text type="secondary" style={{ display: "block" }}>
            {today} 星期{week} · {roleLabel({ role: session.role })}
            {session.role === "vm" ? (vmSupplierNames(db, session) !== "—" ? " · 供应商：" + vmSupplierNames(db, session) : "") : (session.supplier_id ? " · 供应商：" + supplierName(db, session.supplier_id) : "")}
          </Text>
        </div>
        <Tag color="geekblue" className="welcome-role">{welcomeLead()}</Tag>
      </div>

      {isSup ? (
        <Row className="welcome-stats" gutter={[16, 16]} style={{ marginTop: 20 }}>
          <Col xs={24} sm={12}>
            <StatCard label="本供应商人员" value={people.length} note="进入人员库维护人员 →" delay={0}
              color="#722ed1" iconBg="#f9f0ff" icon="👥"
              onClick={function () { nav("people"); }} />
          </Col>
          <Col xs={24} sm={12}>
            <StatCard label="涉及项目" value={supProjects.length} note="查看本供应商相关项目 →" delay={0.08}
              color="#13c2c2" iconBg="#e6fffb" icon="📁"
              onClick={function () { nav("projects"); }} />
          </Col>
        </Row>
      ) : (
        <Row className="welcome-stats" gutter={[16, 16]} style={{ marginTop: 20 }}>
          <Col xs={24} sm={12}>
            <StatCard label="今日已人脸核验" value={done} note={isTerm ? "点击查看已人脸核验人员 →" : "参与人脸核验人员 " + people.length + " 人 · 点击查看 →"} delay={0}
              color="#52c41a" iconBg="#f6ffed" icon="✅"
              onClick={function () { jumpRecords("done"); }} />
          </Col>
          <Col xs={24} sm={12}>
            <StatCard label="今日未人脸核验" value={people.length - done} note={isTerm ? "点击查看未人脸核验人员 →" : "人脸核验率 " + rate + "% · 点击查看 →"} delay={0.08}
              color="#fa8c16" iconBg="#fff7e6" icon="⏰"
              onClick={function () { jumpRecords("missing"); }} />
          </Col>
        </Row>
      )}

    </div>
  );
}
