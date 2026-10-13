import React, { useMemo, useState } from "react";
import { Avatar, Card, Col, Row, Select, Space, Table, Tag, Typography } from "antd";
import { boardFilteredPeople, consentInfo, groupNames, group, nav, personProjectNames, photoCountText, project, supplierName } from "../lib/helpers";
import { ui } from "../lib/ui";
import useCountUp from "../lib/useCountUp";

const { Title, Text } = Typography;

// 浅色主题的供应商配色：实色=已人脸核验，半透明=未人脸核验
const BOARD_PIE_COLORS = [
  ["#52c41a", "rgba(82,196,26,.28)"],
  ["#1677ff", "rgba(22,119,255,.28)"],
  ["#722ed1", "rgba(114,46,209,.28)"],
  ["#faad14", "rgba(250,173,20,.28)"],
  ["#eb2f96", "rgba(235,47,150,.28)"],
  ["#13c2c2", "rgba(19,194,194,.28)"]
];

function StatCard(props) {
  const value = useCountUp(props.value);
  return (
    <Card className={"stat-card" + (props.onClick ? " clickable" : "")} style={{ animationDelay: (props.delay || 0) + "s", height: "100%" }} onClick={props.onClick}>
      <div className="stat-label">{props.label}</div>
      <div className="stat-value">{value}</div>
      <div className="stat-note">{props.note}</div>
    </Card>
  );
}

export default function BoardPage(props) {
  const db = props.db;
  const session = props.session;
  const [sup, setSup] = useState(ui.board.sup);
  const [grp, setGrp] = useState(ui.board.grp);
  const [prj, setPrj] = useState(ui.board.prj);

  const people = useMemo(function () {
    return boardFilteredPeople(db, session, { sup: sup, grp: grp, prj: prj });
  }, [db, session, sup, grp, prj]);

  const supOptions = useMemo(function () {
    var seen = [];
    if (session.role === "vm") {
      db.suppliers.forEach(function (s) { if (s.id && seen.indexOf(s.id) < 0) seen.push(s.id); });
    } else {
      boardFilteredPeople(db, session, {}).forEach(function (p) { if (seen.indexOf(p.supplier_id) < 0) seen.push(p.supplier_id); });
    }
    return seen.map(function (id) { return { label: supplierName(db, id), value: id }; });
  }, [db, session]);

  const grpOptions = useMemo(function () {
    var seen = [];
    if (session.role === "vm") {
      (session.group_ids || []).forEach(function (gid) {
        var g = group(db, gid);
        if (g && g.is_active !== false && seen.indexOf(gid) < 0) seen.push(gid);
      });
    } else {
      boardFilteredPeople(db, session, {}).forEach(function (p) {
        (p.group_ids || []).forEach(function (gid) { if (seen.indexOf(gid) < 0) seen.push(gid); });
      });
    }
    return seen.map(function (gid) { var g = group(db, gid); return { label: g ? g.name : gid, value: gid }; });
  }, [db, session]);

  const prjOptions = useMemo(function () {
    var seen = [];
    if (session.role === "vm") {
      var gids = session.group_ids || [];
      db.projects.forEach(function (pr) {
        if (gids.indexOf(pr.group_id) >= 0 && pr.is_active !== false && (!grp || pr.group_id === grp) && seen.indexOf(pr.id) < 0) seen.push(pr.id);
      });
    } else if (grp) {
      db.projects.forEach(function (pr) {
        if (pr.group_id === grp && pr.is_active !== false && seen.indexOf(pr.id) < 0) seen.push(pr.id);
      });
    } else {
      boardFilteredPeople(db, session, {}).forEach(function (p) {
        (p.project_ids || (p.project_id ? [p.project_id] : [])).forEach(function (pid) { if (seen.indexOf(pid) < 0) seen.push(pid); });
      });
    }
    return seen.map(function (pid) { var pr = project(db, pid); return { label: pr ? pr.name : pid, value: pid }; });
  }, [db, session, grp]);

  const set = window.FaceStore.todaysClockinSet(db);
  const total = people.length;
  const doneList = people.filter(function (p) { return set[p.id]; });
  const missingList = people.filter(function (p) { return !set[p.id]; });
  const rate = total ? Math.round(doneList.length / total * 100) : 0;

  const supStats = useMemo(function () {
    var m = {};
    people.forEach(function (p) {
      if (!m[p.supplier_id]) m[p.supplier_id] = { name: supplierName(db, p.supplier_id), total: 0, done: 0 };
      m[p.supplier_id].total++;
      if (set[p.id]) m[p.supplier_id].done++;
    });
    return m;
  }, [people, set, db]);

  const pieSegs = useMemo(function () {
    var supIds = Object.keys(supStats);
    var segs = [], acc = 0;
    supIds.forEach(function (id, i) {
      var s = supStats[id];
      var c = BOARD_PIE_COLORS[i % BOARD_PIE_COLORS.length];
      if (s.done > 0) {
        var dFrom = acc * 100, dTo = (acc + s.done / total) * 100;
        segs.push(c[0] + " " + dFrom.toFixed(2) + "% " + dTo.toFixed(2) + "%");
        acc += s.done / total;
      }
      if (s.total - s.done > 0) {
        var mFrom = acc * 100, mTo = (acc + (s.total - s.done) / total) * 100;
        segs.push(c[1] + " " + mFrom.toFixed(2) + "% " + mTo.toFixed(2) + "%");
        acc += (s.total - s.done) / total;
      }
    });
    if (segs.length === 0) segs.push("#e6f4ff 0% 100%");
    return segs;
  }, [supStats, total]);

  function changeSup(v) { setSup(v); ui.board.sup = v; }
  function changeGrp(v) { setGrp(v); ui.board.grp = v; setPrj(""); ui.board.prj = ""; }
  function changePrj(v) { setPrj(v); ui.board.prj = v; }

  function lead() {
    if (session.role === "supplier_admin") return "只看本供应商的人脸核验情况：供应商维度饼状图 + 今日未人脸核验名单，支持项目组 / 项目筛选。";
    if (session.role === "vm") return "查看自己项目组人员的人脸核验情况：供应商维度饼状图 + 今日未人脸核验名单，支持项目组 / 项目 / 供应商筛选。";
    return "全平台人脸核验看板：供应商维度饼状图 + 今日未人脸核验名单，支持项目组 / 项目 / 供应商筛选；数据口径为北京时间当天。";
  }

  const missingColumns = [
    { title: "供应商", render: function (_, p) { return supplierName(db, p.supplier_id); } },
    {
      title: "人员",
      render: function (_, p) {
        return (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Avatar shape="square" size={36} style={{ background: "#e6f4ff", color: "#1677ff", fontWeight: 600 }}>
              {String(p.name || "?").slice(0, 1)}
            </Avatar>
            <div>
              <div style={{ fontWeight: 600 }}>{p.name}</div>
              <Text type="secondary" style={{ fontSize: 12 }}>{photoCountText(p)}</Text>
            </div>
          </div>
        );
      }
    },
    { title: "编号", dataIndex: "employee_code" },
    { title: "项目名称", render: function (_, p) { return personProjectNames(db, p); } },
    { title: "项目组", render: function (_, p) { return groupNames(db, p.group_ids); } },
    {
      title: "状态",
      render: function (_, p) {
        var c = consentInfo(p);
        return <Tag color={c.color}>{c.text}</Tag>;
      }
    }
  ];

  function goToday(tab) {
    var today = window.FaceStore.localDateString();
    ui.rec.date = today;
    ui.rec.month = today.slice(0, 7);
    ui.rec.tab = tab;
    ui.rec.sup = sup || "";
    var g = grp ? group(db, grp) : null;
    ui.rec.grp = g ? g.name : "";
    var pr = prj ? project(db, prj) : null;
    ui.rec.prj = pr ? pr.name : "";
    nav("records");
  }

  function goPeople() {
    ui.people.sup = sup || "all";
    ui.people.grp = grp || "";
    ui.people.prj = prj || "";
    ui.people.status = "all";
    nav("people");
  }

  return (
    <div>
      <div className="topbar">
        <div>
          <div className="eyebrow">Board</div>
          <Title level={3} style={{ margin: 0 }}>人脸核验看板</Title>
          <Text type="secondary" style={{ display: "block", marginTop: 4 }}>{lead()}</Text>
        </div>
      </div>

      <Card style={{ marginTop: 16, marginBottom: 16 }}>
        <Space wrap size={12}>
          <div>
            <div className="filter-label">项目组</div>
            <Select style={{ width: 180 }} value={grp} onChange={changeGrp}
              options={[{ label: "全部项目组", value: "" }].concat(grpOptions)} />
          </div>
          <div>
            <div className="filter-label">项目名称</div>
            <Select style={{ width: 180 }} value={prj} onChange={changePrj}
              options={[{ label: "全部项目名称", value: "" }].concat(prjOptions)} />
          </div>
          <div>
            <div className="filter-label">供应商</div>
            <Select style={{ width: 180 }} value={sup} onChange={changeSup}
              options={[{ label: "全部供应商", value: "" }].concat(supOptions)} />
          </div>
        </Space>
      </Card>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={8}>
          <StatCard label="当前范围人数" value={total} note="筛选后的参与人脸核验人员 · 点击查看名单" delay={0} onClick={goPeople} />
        </Col>
        <Col xs={24} sm={8}>
          <StatCard label="今日已人脸核验" value={doneList.length} note={"人脸核验率 " + rate + "%"} delay={0.08} onClick={function () { goToday("done"); }} />
        </Col>
        <Col xs={24} sm={8}>
          <StatCard label="今日未人脸核验" value={missingList.length} note="含未激活人员" delay={0.16} onClick={function () { goToday("missing"); }} />
        </Col>
      </Row>

      <Card className="page-card" style={{ marginBottom: 16 }} title="供应商维度 · 饼状图"
        extra={<Text type="secondary" style={{ fontSize: 12 }}>每个供应商一段：实色为已人脸核验，半透明为未人脸核验；整圆为当前筛选范围全部人员</Text>}>
        <div className="pie-wrap">
          <div className="pie" style={{ background: "conic-gradient(" + pieSegs.join(",") + ")" }}>
            <div className="pie-center">
              <div>
                <div className="small">人脸核验率</div>
                <b style={{ fontSize: 26 }}>{rate}%</b>
                <div className="small">{doneList.length} / {total}</div>
              </div>
            </div>
          </div>
          <div className="pie-legend">
            {Object.keys(supStats).length === 0 ? (
              <Text type="secondary">当前范围没有人员。</Text>
            ) : (
              Object.keys(supStats).map(function (id, i) {
                var s = supStats[id];
                var sr = s.total ? Math.round(s.done / s.total * 100) : 0;
                return (
                  <div className="pie-legend-row" key={id}>
                    <span className="dot" style={{ background: BOARD_PIE_COLORS[i % BOARD_PIE_COLORS.length][0] }} />
                    <span style={{ flex: 1 }}>{s.name}</span>
                    <Text type="secondary" style={{ fontSize: 12 }}>{s.done} / {s.total} · {sr}%</Text>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </Card>

      <Card className="page-card" title={"今日未人脸核验"}
        extra={<Text type="secondary" style={{ fontSize: 12 }}>共 {missingList.length} 人 · 未激活人员不会记录人脸核验，按未人脸核验计算</Text>}>
        <Table
          rowKey="id"
          scroll={{ x: "max-content" }}
          columns={missingColumns}
          dataSource={missingList}
          pagination={{ pageSize: 10, hideOnSinglePage: true }}
          locale={{ emptyText: <Text type="secondary">太好了，当前范围内所有人员今天都已人脸核验。</Text> }}
        />
      </Card>
    </div>
  );
}