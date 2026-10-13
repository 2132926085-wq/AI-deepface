import React, { useEffect, useRef, useState } from "react";
import { App as AntApp, Avatar, Button, Card, Checkbox, Modal, Space, Tag, Typography } from "antd";
import { groupNames, personProjectNames, supplierName } from "../lib/helpers";
import { ui } from "../lib/ui";

const { Title, Text } = Typography;

function PersonFace(props) {
  const p = props.p;
  if (p && p.photos && p.photos.length) {
    return <img className="result-photo" src={p.photos[0]} alt={p.name || ""} style={{ width: 40, height: 40, borderRadius: 8, objectFit: "cover" }} />;
  }
  return (
    <Avatar shape="square" size={40} style={{ background: "#e6f4ff", color: "#1677ff", fontWeight: 600, flexShrink: 0 }}>
      {String(p && p.name ? p.name : "?").slice(0, 1)}
    </Avatar>
  );
}

export default function ClockPage(props) {
  const db = props.db;
  const session = props.session;
  const { message } = AntApp.useApp();
  const today = window.FaceStore.localDateString();

  const [ipMismatch, setIpMismatch] = useState(!!ui.clock.ipMismatch);
  const [result, setResult] = useState(ui.clock.result || null);
  const [scanning, setScanning] = useState(!!ui.clock.scanning);
  const [consent, setConsent] = useState(null); // { person }
  const [consentReached, setConsentReached] = useState(false);
  const [consentChecked, setConsentChecked] = useState(false);
  const [activated, setActivated] = useState(null); // { person }
  const timerRef = useRef(null);

  useEffect(function () {
    return function () { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  const t = session;
  const sup = supplierName(db, t.supplier_id);
  const set = window.FaceStore.todaysClockinSet(db);
  const pending = db.people.filter(function (p) { return p.supplier_id === t.supplier_id && p.is_active && !set[p.id]; });
  const inactivePool = db.people.filter(function (p) { return p.supplier_id === t.supplier_id && p.consent_status !== "agreed"; });

  function clockCurrentIp() {
    if (!ipMismatch) return t.standard_ip;
    var ip = ui.clock.fakeIps[ui.clock.fakeIdx % ui.clock.fakeIps.length];
    ui.clock.fakeIdx++;
    return ip;
  }

  function createRecord(personId, status, ipCheck, currentIp) {
    var p = personId ? db.people.find(function (x) { return x.id === personId; }) : null;
    db.records.unshift({
      id: window.FaceStore.uid("rec"),
      person_id: p ? p.id : null,
      person_name: p ? p.name : null,
      supplier_id: t.supplier_id,
      supplier_name: sup,
      terminal_id: session.id,
      terminal_name: session.display_name || session.username,
      group_names: p && p.group_ids && p.group_ids.length ? p.group_ids.map(function (gid) { var g = db.groups.find(function (x) { return x.id === gid; }); return g ? g.name : null; }).filter(Boolean) : [],
      group_name: p && p.group_ids && p.group_ids.length ? (function () { var g = db.groups.find(function (x) { return x.id === p.group_ids[0]; }); return g ? g.name : null; })() : null,
      project_ids: p ? (p.project_ids && p.project_ids.length ? p.project_ids.slice() : (p.project_id ? [p.project_id] : [])) : [],
      project_names: p ? (p.project_ids && p.project_ids.length ? p.project_ids.map(function (pid) { var pr = db.projects.find(function (x) { return x.id === pid; }); return pr ? pr.name : null; }).filter(Boolean) : (p.project_id ? [function () { var pr = db.projects.find(function (x) { return x.id === p.project_id; }); return pr ? pr.name : null; }()].filter(Boolean) : [])) : [],
      project_name: p && p.project_id ? (function () { var pr = db.projects.find(function (x) { return x.id === p.project_id; }); return pr ? pr.name : null; })() : null,
      status: status,
      ip_check: ipCheck,
      current_ip: currentIp,
      occurred_at: window.FaceStore.nowString(),
      consent_pending: p ? (p.consent_status !== "agreed") : false
    });
    window.FaceStore.persist(db);
  }

  function audit(operator, role, action, detail) {
    window.FaceStore.auditLog(operator, role, action, detail);
  }

  function applyResult(r) {
    ui.clock.result = r;
    setResult(r);
    setScanning(false);
    ui.clock.scanning = false;
    ui.clock.scanPerson = null;
  }

  function blockedResult(ip) {
    createRecord(null, "blocked", "mismatch", ip);
    audit(session.display_name || session.username, "terminal", "人脸核验被禁止", "IP " + ip + " 与标准 IP " + t.standard_ip + " 不一致，禁止人脸核验");
    applyResult({ status: "blocked", ip: ip, standard: t.standard_ip });
  }

  function start() {
    var ip = clockCurrentIp();
    if (ip !== t.standard_ip) { blockedResult(ip); return; }
    var clockin = window.FaceStore.todaysClockinSet(db);
    var list = db.people.filter(function (p) { return p.supplier_id === t.supplier_id && p.is_active && !clockin[p.id]; });
    if (list.length === 0) { applyResult({ status: "done" }); return; }
    var p = list[0];
    setScanning(true);
    ui.clock.scanning = true;
    ui.clock.scanPerson = p;
    ui.clock.result = null;
    setResult(null);
    timerRef.current = setTimeout(function () {
      if (p.consent_status !== "agreed") {
        openConsent(p, function () { activatePersonAndPromptReclock(p); }, function () { applyResult({ status: "consent", person: p }); });
      } else {
        createRecord(p.id, "recognized", "ok", t.standard_ip);
        applyResult({ status: "recognized", person: p });
      }
    }, 1700);
  }

  function unknown() {
    var ip = clockCurrentIp();
    createRecord(null, "unknown", "ok", ip);
    applyResult({ status: "unknown" });
  }

  function inactive() {
    var ip = clockCurrentIp();
    if (ip !== t.standard_ip) { blockedResult(ip); return; }
    if (inactivePool.length === 0) { applyResult({ status: "no-inactive" }); return; }
    var p = inactivePool[0];
    openConsent(p, function () { activatePersonAndPromptReclock(p); }, function () { applyResult({ status: "consent", person: p }); });
  }

  function openConsent(p, onAgree, onLater) {
    setConsentReached(false);
    setConsentChecked(false);
    setConsent({ person: p, onAgree: onAgree, onLater: onLater });
  }

  function agreeConsent() {
    var c = consent;
    if (!c || !consentReached || !consentChecked) return;
    var p = c.person;
    p.consent_status = "agreed";
    p.consent_at = window.FaceStore.nowString();
    window.FaceStore.persist(db);
    audit(session.display_name || session.username, "terminal", "同意免责声明", p.name + " 首次识别时同意人脸识别免责声明");
    setConsent(null);
    c.onAgree();
  }

  function laterConsent() {
    var c = consent;
    setConsent(null);
    if (c && c.onLater) c.onLater();
  }

  function activatePersonAndPromptReclock(p) {
    p.is_active = true;
    window.FaceStore.persist(db);
    audit(session.display_name || session.username, "terminal", "激活人员",
      p.name + "（" + (p.employee_code || "—") + "）从未激活状态变为已激活（首次识别同意免责），本次识别不计入人脸核验");
    setActivated(p);
  }

  function reclock() {
    ui.clock.result = null;
    ui.clock.scanning = false;
    ui.clock.scanPerson = null;
    setActivated(null);
    setResult(null);
    setScanning(false);
  }

  function toggleIp(e) {
    var v = e.target.checked;
    ui.clock.ipMismatch = v;
    setIpMismatch(v);
  }

  function resultView() {
    if (!result) return <div className="empty" style={{ padding: "16px 0" }}>点击「开始模拟识别」开始演示。</div>;
    if (result.status === "scanning") return (
      <div className="result-hero pending">
        <div className="result-status">Recognizing</div>
        <div className="result-name">正在比对…</div>
        <div className="result-detail">模拟人脸识别中，请稍候。</div>
      </div>
    );
    if (result.status === "done") return (
      <div className="result-hero">
        <div className="result-status">All done</div>
        <div className="result-name">今日人脸核验已完成</div>
        <div className="result-detail">本供应商今天还没有人脸核验的人员都已演示完毕。</div>
      </div>
    );
    if (result.status === "blocked") return (
      <div className="result-hero spoof">
        <div className="result-flare">⚠ IP 与标准 IP 不一致 · 禁止人脸核验</div>
        <div className="result-status">Blocked</div>
        <div className="result-name">IP 校验未通过</div>
        <div className="result-detail">当前 IP：{result.ip}<br />标准 IP：{result.standard}<br />本次人脸核验已被禁止，并写入审计日志。</div>
      </div>
    );
    if (result.status === "unknown") return (
      <div className="result-hero">
        <div className="result-status">Unknown</div>
        <div className="result-name">未知人员</div>
        <div className="result-detail">未匹配到人员库身份，事件归属本终端供应商。<br />时间：{window.FaceStore.nowString()}</div>
      </div>
    );
    if (result.status === "no-inactive") return (
      <div className="result-hero">
        <div className="result-status">No inactive</div>
        <div className="result-name">本供应商暂无未激活人员</div>
        <div className="result-detail">人员库中没有处于未激活状态的人员；本供应商人员均已激活；可在人员库中新增人员（默认未激活）后再演示首次激活流程。</div>
      </div>
    );
    if (result.status === "consent") return (
      <div className="result-hero spoof">
        <div className="result-flare">⚠ 未激活 · 本次未人脸核验</div>
        <div className="result-status">Not recorded</div>
        <div className="result-name">{result.person ? result.person.name : "待确认人员"}</div>
        <div className="result-detail">未同意免责声明前不会记录人脸核验，按未人脸核验计算；请再次识别，在弹窗中滑到底部勾选同意后再继续。</div>
      </div>
    );
    if (result.status === "recognized") {
      var p = result.person;
      return (
        <div className="result-hero">
          <div className="result-status">Recognized</div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "6px 0" }}><PersonFace p={p} /><div className="result-name" style={{ margin: 0 }}>{p ? p.name : "已识别"}</div></div>
          <div className="result-detail">
            人员编号：{p ? p.employee_code : "—"}<br />
            项目组：{p ? groupNames(db, p.group_ids) : "—"}<br />
            项目名称：{p ? personProjectNames(db, p) : "—"}<br />
            IP 校验：通过<br />事件：已记录
          </div>
        </div>
      );
    }
    return null;
  }

  const cameraView = scanning ? (
    <div style={{ textAlign: "center", position: "relative", padding: "40px 0" }}>
      <div className="camera-scan" />
      <div className="face-hint">☺</div>
      <div className="scan-copy">模拟识别中…正在比对人员库</div>
    </div>
  ) : (
    <div className="camera-placeholder" style={{ padding: "40px 0" }}>
      <div style={{ fontSize: 42, marginBottom: 10 }}>◉</div>
      <div>模拟摄像头画面</div>
      <div className="small">点击「开始模拟识别」演示人脸核验；演示环境不调用真实摄像头与识别接口。</div>
    </div>
  );

  return (
    <div>
      <div className="topbar">
        <div>
          <div className="eyebrow">Terminal recognition</div>
          <Title level={3} style={{ margin: 0 }}>集中人脸核验</Title>
          <Text type="secondary" style={{ display: "block", marginTop: 4 }}>
            终端账号发起人脸核验：每次核验校验终端 IP，与标准 IP 不一致直接禁止核验；识别到首次核验（未激活）人员会先弹出免责声明，滑到底部勾选同意后即激活，本次不计入核验。
          </Text>
        </div>
        <Tag color="blue">供应商：{sup}</Tag>
      </div>

      <div className="ip-strip">
        <div className="label">IP 校验</div>
        <span>标准 IP：<b>{t.standard_ip || "—"}</b></span>
        <span>当前探测：<b>{clockCurrentIp()}</b></span>
        {ipMismatch ? <Tag color="error">禁止人脸核验</Tag> : <Tag color="success">允许人脸核验</Tag>}
      </div>

      <div className="camera-layout">
        <Card className="page-card"><div className="camera-box">{cameraView}</div></Card>
        <Card className="page-card result-panel" style={{ marginTop: 0 }}>
          <div>
            <div className="eyebrow">Latest result</div>
            <Title level={4} style={{ margin: "4px 0 0" }}>当前识别结果</Title>
          </div>
          <div>{resultView()}</div>
          <Space style={{ marginTop: 14 }} wrap>
            <Button type="primary" onClick={start}>开始模拟识别</Button>
            <Button onClick={unknown}>模拟未知人员</Button>
            <Button onClick={inactive}>模拟首次人脸核验人员（未激活）</Button>
          </Space>
          <Checkbox checked={ipMismatch} onChange={toggleIp} style={{ marginTop: 12 }}>模拟 IP 异常（用于演示禁止人脸核验）</Checkbox>
          <Text type="secondary" style={{ display: "block", fontSize: 12, marginTop: 10 }}>
            本供应商还有 {pending.length} 人未人脸核验；模拟识别会按顺序逐个识别；「模拟首次人脸核验人员（未激活）」演示首次识别流程：同意免责后从未激活变为已激活，本次不计入人脸核验。人员照片为演示占位图（正式环境由供应商上传真实照片，1-3 张）。
          </Text>
        </Card>
      </div>

      <Modal
        open={!!consent}
        title="免责声明"
        okText="同意并继续"
        cancelText="稍后处理"
        onOk={agreeConsent}
        onCancel={laterConsent}
        okButtonProps={{ disabled: !consentReached || !consentChecked }}
        destroyOnClose
        afterClose={function () { setConsent(null); }}
      >
        {consent ? (
          <div>
            <Text style={{ display: "block", marginBottom: 12 }}>
              首次识别到 <b>{consent.person.name}</b>
              {consent.person.employee_code ? "（" + consent.person.employee_code + "）" : ""}
              。请阅读并滚动到底部后勾选同意；在同意前，本次识别<b>不会记录人脸核验</b>，按未人脸核验计算。
            </Text>
            <div
              className="consent-scroll"
              onScroll={function (e) {
                var el = e.target;
                var reached = el.scrollTop + el.clientHeight >= el.scrollHeight - 6;
                setConsentReached(reached);
              }}
            >
              <h3>人脸核验免责声明</h3>
              <p>本人知悉并同意，所在供应商通过现场摄像头人脸识别方式记录我的人脸核验信息，包括面部影像、识别时间、终端核验位置等必要信息。</p>
              <p>本人理解，人脸识别仅用于身份确认与考勤记录，系统不会据此自动生成工资、出勤结论或门禁授权；实际考勤以管理员核验后的记录为准。</p>
              <p>本人同意供应商及其授权的技术服务方在本系统范围内采集、存储和使用上述信息，并采取合理的安全措施加以保护；未经本人同意，不会向与本业务无关的第三方提供。</p>
              <p>本人知悉可以在供应商管理员处申请查询、更正或删除我的相关识别记录。</p>
              <p>如不同意本声明，请离开人脸核验区域并联系现场管理员处理。</p>
            </div>
            <Text type="secondary" style={{ display: "block", fontSize: 12, marginBottom: 8 }}>
              {consentReached ? "" : "请先滑到免责声明底部，勾选才会生效。"}
            </Text>
            <Checkbox checked={consentChecked} disabled={!consentReached} onChange={function (e) { setConsentChecked(e.target.checked); }}>
              我已阅读并同意以上免责声明
            </Checkbox>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={!!activated}
        title="已成功激活"
        okText="前往人脸核验页面 · 重新核验"
        cancelButtonProps={{ style: { display: "none" } }}
        onOk={reclock}
        onCancel={reclock}
      >
        {activated ? (
          <div>
            <Text style={{ display: "block", marginBottom: 10 }}>
              人员 <b>{activated.name}</b>{activated.employee_code ? "（" + activated.employee_code + "）" : ""} 已成功激活：人员库状态已由「未激活」变为「已激活」。
            </Text>
            <Text type="secondary">本次识别<b>不计入人脸核验</b>，未生成人脸核验记录；请点击下方按钮前往人脸核验页面，重新发起人脸核验。</Text>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
