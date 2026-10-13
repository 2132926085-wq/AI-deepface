import React, { useEffect, useState } from "react";
import {
  App as AntApp, Button, ConfigProvider, Drawer, Grid, Layout, Menu, Space, Tag, Typography
} from "antd";
import { HomeOutlined, LogoutOutlined, MenuOutlined, ReloadOutlined } from "@ant-design/icons";
import zhCN from "antd/locale/zh_CN";
import dayjs from "dayjs";
import "dayjs/locale/zh-cn";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import RecordsPage from "./pages/RecordsPage";
import BoardPage from "./pages/BoardPage";
import PeoplePage from "./pages/PeoplePage";
import ClockPage from "./pages/ClockPage";
import SuppliersPage from "./pages/SuppliersPage";
import GroupsPage from "./pages/GroupsPage";
import ProjectsPage from "./pages/ProjectsPage";
import SupplierVmPage from "./pages/SupplierVmPage";
import SupplierPeoplePage from "./pages/SupplierPeoplePage";
import UsersPage from "./pages/UsersPage";
import IpPage from "./pages/IpPage";
import RequestsPage from "./pages/RequestsPage";
import AuditPage from "./pages/AuditPage";
import PlaceholderPage from "./pages/PlaceholderPage";
import { defaultRoute, menus, nav, roleLabel, route, supplierName } from "./lib/helpers";

dayjs.locale("zh-cn");

const { Header, Sider, Content } = Layout;
const { Text } = Typography;
const SESSION_KEY = "face_clockin_demo_session";

function loadSession(db) {
  try {
    var raw = localStorage.getItem(SESSION_KEY);
    if (raw) {
      var s = JSON.parse(raw);
      var u = db.users.find(function (x) { return x.id === s.id && x.is_active && x.role !== "user"; });
      if (u) return u;
    }
  } catch (e) { /* ignore */ }
  return null;
}

function saveSession(u) {
  try { localStorage.setItem(SESSION_KEY, JSON.stringify(u ? { id: u.id } : null)); } catch (e) { /* ignore */ }
}

function Root() {
  const { message, modal } = AntApp.useApp();
  const [db, setDb] = useState(null);
  const [session, setSession] = useState(null);
  const [hash, setHash] = useState(route());
  const [drawerOpen, setDrawerOpen] = useState(false);
  const screens = Grid.useBreakpoint();
  const isMobile = screens.md === false;

  useEffect(function () {
    var d = window.FaceStore.load();
    setDb(d);
    setSession(loadSession(d));
  }, []);

  useEffect(function () {
    function onHash() { setHash(route()); }
    window.addEventListener("hashchange", onHash);
    return function () { window.removeEventListener("hashchange", onHash); };
  }, []);

  function refresh() { setDb(window.FaceStore.load()); }

  // 路由归一：已登录时，未允许的 hash 一律回到该角色的默认页
  useEffect(function () {
    if (!db || !session) return;
    var allowed = menus(session).some(function (m) { return m.hash === hash; });
    if (!allowed) nav(defaultRoute(session));
  }, [db, session, hash]);

  function doLogin(username, password) {
    var u = db.users.find(function (x) { return x.username === username && x.password === password && x.is_active && x.role !== "user"; });
    if (!u) return null;
    u.last_login_at = window.FaceStore.nowString();
    window.FaceStore.persist(db);
    setSession(u);
    saveSession(u);
    nav(defaultRoute(u));
    return u;
  }

  function doLogout() {
    setSession(null);
    saveSession(null);
    nav("login");
  }

  function doReset() {
    modal.confirm({
      title: "确定重置演示数据吗？",
      content: "所有本地改动将恢复为出厂种子数据。",
      okText: "重置",
      okButtonProps: { danger: true },
      cancelText: "取消",
      onOk: function () {
        window.FaceStore.reset();
        var d = window.FaceStore.load();
        setDb(d);
        var s = loadSession(d);
        setSession(s);
        if (!s) nav("login");
        message.success("演示数据已重置");
      }
    });
  }

  if (!db) return null;

  if (!session) {
    return <LoginPage db={db} onLogin={doLogin} />;
  }

  const items = menus(session);
  const current = items.some(function (m) { return m.hash === hash; }) ? hash : defaultRoute(session);
  const currentLabel = (items.find(function (m) { return m.hash === current; }) || {}).label || current;
  const sub = session.supplier_name
    ? session.supplier_name + " · 集中人脸核验"
    : (session.role === "global_admin" ? "全局管理平台" : (session.role === "vm" ? "项目组管理" : (session.role === "terminal" ? "现场终端 · " + (session.display_name || session.username) : "")));

  
  // 终端账号：全屏 Kiosk（不显示侧栏 / 顶栏），人脸核验与人脸核验记录保留返回总览入口
  if (session.role === "terminal") {
    function termFrame(node) {
      return (
        <div className="term-frame">
          <div className="term-frame-bar">
            <span>人脸核验系统 · {session.supplier_name || supplierName(db, session.supplier_id)}</span>
            <Space>
              <Button icon={<HomeOutlined />} onClick={function () { nav("dashboard"); }}>返回总览</Button>
              <Button icon={<LogoutOutlined />} onClick={doLogout}>退出登录</Button>
            </Space>
          </div>
          {node}
        </div>
      );
    }
    if (current === "clock") return termFrame(<ClockPage db={db} session={session} refresh={refresh} />);
    if (current === "records") return termFrame(<RecordsPage db={db} session={session} refresh={refresh} />);
    return <DashboardPage db={db} session={session} onLogout={doLogout} />;
  }

  function renderPage() {
    switch (current) {
      case "dashboard": return <DashboardPage db={db} session={session} />;
      case "records": return <RecordsPage db={db} session={session} refresh={refresh} />;
      case "board": return <BoardPage db={db} session={session} />;
      case "people": return <PeoplePage db={db} session={session} refresh={refresh} />;
      case "clock": return <ClockPage db={db} session={session} refresh={refresh} />;
      case "suppliers": return <SuppliersPage db={db} session={session} refresh={refresh} />;
      case "groups": return <GroupsPage db={db} session={session} refresh={refresh} />;
      case "projects": return <ProjectsPage db={db} session={session} refresh={refresh} />;
      case "myvm": return <SupplierVmPage db={db} session={session} refresh={refresh} />;
      case "supplier": return <SupplierPeoplePage db={db} session={session} refresh={refresh} />;
      case "users": return <UsersPage db={db} session={session} refresh={refresh} />;
      case "ip": return <IpPage db={db} session={session} refresh={refresh} />;
      case "leave": return <RequestsPage db={db} session={session} refresh={refresh} />;
      case "audit": return <AuditPage db={db} session={session} refresh={refresh} />;
      default: return <PlaceholderPage label={currentLabel} />;
    }
  }

  return (
    <Layout style={{ minHeight: "100vh" }}>
      {!isMobile ? (
      <Sider width={236} theme="light" style={{ borderRight: "1px solid #f0f0f0", display: "flex", flexDirection: "column" }}>
        <div className="sider-brand">
          <div className="brand-mark">F</div>
          <div>
            <div className="brand-title">FaceOps</div>
            <div className="brand-subtitle">{sub}</div>
          </div>
        </div>
        <div style={{ flex: 1, overflow: "auto", padding: "4px 8px" }}>
          <Menu
            mode="inline"
            selectedKeys={[current]}
            style={{ borderInlineEnd: "none", background: "transparent" }}
            items={items.map(function (m) { return { key: m.hash, label: m.label }; })}
            onClick={function (e) { nav(e.key); }}
          />
        </div>
        <div className="sider-footer">
          <div>当前身份：{session.display_name || session.username}（{roleLabel(session)}）</div>
          {session.supplier_id ? <div className="sidebar-supplier">{session.supplier_name || supplierName(db, session.supplier_id)}</div> : null}
          <Space direction="vertical" style={{ width: "100%", marginTop: 10 }}>
            <Button block icon={<LogoutOutlined />} onClick={doLogout}>退出登录</Button>
            <Button block danger icon={<ReloadOutlined />} onClick={doReset}>重置演示数据</Button>
          </Space>
        </div>
      </Sider>
      ) : null}

      <Layout>
                <Header className="demo-banner" style={{ background: "#fff", borderBottom: "1px solid #f0f0f0", height: "auto", lineHeight: "normal", padding: isMobile ? "8px 12px" : "10px 24px" }}>
          {isMobile ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                <Button type="text" icon={<MenuOutlined />} style={{ marginLeft: -8 }} aria-label="打开菜单" onClick={function () { setDrawerOpen(true); }} />
                <div className="brand-mark" style={{ width: 30, height: 30, fontSize: 15 }}>F</div>
                <div style={{ minWidth: 0 }}>
                  <div className="brand-title" style={{ fontSize: 14 }}>FaceOps</div>
                  <div className="brand-subtitle" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "48vw" }}>{sub}</div>
                </div>
              </div>
              {session.supplier_id ? <Tag color="blue" style={{ marginRight: 0 }}>供应商</Tag> : <Text type="secondary" style={{ fontSize: 12 }}>AntD 试点版</Text>}
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <Text type="secondary" style={{ fontSize: 13 }}>
                纯前端演示：<b>数据保存在浏览器本地</b>，不接真实接口；AntD 试点版（浅色主题），原版功能保持不变。
              </Text>
              {session.supplier_id ? <Tag color="blue">供应商：{session.supplier_name || supplierName(db, session.supplier_id)}</Tag> : null}
            </div>
          )}
        </Header>
        <Content style={{ padding: isMobile ? 12 : 24, background: "#f5f5f5" }}>
          <div key={current} className="page-fade" style={{ maxWidth: 1200, margin: "0 auto" }}>
            {renderPage()}
          </div>
        </Content>
      </Layout>
      {isMobile ? (
        <Drawer
          open={drawerOpen}
          onClose={function () { setDrawerOpen(false); }}
          placement="left"
          width={280}
          styles={{ body: { padding: 0, display: "flex", flexDirection: "column" } }}
        >
          <div className="sider-brand">
            <div className="brand-mark">F</div>
            <div>
              <div className="brand-title">FaceOps</div>
              <div className="brand-subtitle">{sub}</div>
            </div>
          </div>
          <div style={{ flex: 1, overflow: "auto", padding: "4px 8px" }}>
            <Menu
              mode="inline"
              selectedKeys={[current]}
              style={{ borderInlineEnd: "none", background: "transparent" }}
              items={items.map(function (m) { return { key: m.hash, label: m.label }; })}
              onClick={function (e) { nav(e.key); setDrawerOpen(false); }}
            />
          </div>
          <div className="sider-footer">
            <div>当前身份：{session.display_name || session.username}（{roleLabel(session)}）</div>
            {session.supplier_id ? <div className="sidebar-supplier">{session.supplier_name || supplierName(db, session.supplier_id)}</div> : null}
            <Space direction="vertical" style={{ width: "100%", marginTop: 10 }}>
              <Button block icon={<LogoutOutlined />} onClick={doLogout}>退出登录</Button>
              <Button block danger icon={<ReloadOutlined />} onClick={doReset}>重置演示数据</Button>
            </Space>
          </div>
        </Drawer>
      ) : null}
    </Layout>
  );
}

export default function App() {
  return (
    <ConfigProvider locale={zhCN} theme={{ token: { colorPrimary: "#1677ff", borderRadius: 8 } }}>
      <AntApp>
        <Root />
      </AntApp>
    </ConfigProvider>
  );
}