import React, { useEffect, useMemo, useState } from "react";
import {
  App as AntApp, Avatar, Button, Card, Descriptions, Form, Image, Input,
  Modal, Select, Space, Table, Tag, Typography, Upload
} from "antd";
import { PlusOutlined, ReloadOutlined } from "@ant-design/icons";
import { group, groupNames, nav, nextEmployeeCode, person, personProjectIds, personProjectNames, photoCountText, project, supplierName } from "../lib/helpers";
import { ui } from "../lib/ui";

const { Title, Text } = Typography;

export default function PeoplePage(props) {
  const db = props.db;
  const session = props.session;
  const { message, modal } = AntApp.useApp();
  const isVm = session && session.role === "vm";
  const isSup = session && session.role === "supplier_admin";
  const canEdit = !isVm;
  const isGlobal = session && session.role === "global_admin";

  const [people, setPeople] = useState(db.people);
  const [supFilter, setSupFilter] = useState(isSup && session.supplier_id ? session.supplier_id : (ui.people.sup || "all"));
  const [statusFilter, setStatusFilter] = useState(ui.people.status || "all");
  const [grpFilter, setGrpFilter] = useState(ui.people.grp || "");
  const [prjFilter, setPrjFilter] = useState(ui.people.prj || "");
  const [keyword, setKeyword] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [detail, setDetail] = useState(null);
  const [editOpen, setEditOpen] = useState(false);
  const [edit, setEdit] = useState(null);
  const [editForm] = Form.useForm();
  const [editFileList, setEditFileList] = useState([]);
  const [form] = Form.useForm();
  const [fileList, setFileList] = useState([]);

  useEffect(function () { setPeople(db.people); }, [db]);

  const scopedPeople = useMemo(function () {
    if (isSup) return people.filter(function (p) { return p.supplier_id === session.supplier_id; });
    return people;
  }, [people, isSup, session]);

  const filtered = useMemo(function () {
    return scopedPeople.filter(function (p) {
      if (supFilter !== "all" && p.supplier_id !== supFilter) return false;
      if (statusFilter === "agreed" && p.consent_status !== "agreed") return false;
      if (statusFilter === "pending" && p.consent_status === "agreed") return false;
      if (!isSup && grpFilter && (p.group_ids || []).indexOf(grpFilter) < 0) return false;
      if (!isSup && prjFilter && personProjectIds(p).indexOf(prjFilter) < 0) return false;
      if (keyword) {
        var kw = String(keyword).trim().toLowerCase();
        var hitName = String(p.name || "").toLowerCase().indexOf(kw) >= 0;
        var hitCode = String(p.employee_code || "").toLowerCase().indexOf(kw) >= 0;
        if (!hitName && !hitCode) return false;
      }
      return true;
    });
  }, [scopedPeople, supFilter, statusFilter, keyword, isSup, grpFilter, prjFilter]);

  const grpOptions = useMemo(function () {
    var seen = [];
    if (isVm) {
      (session.group_ids || []).forEach(function (gid) {
        var g = group(db, gid);
        if (g && g.is_active !== false && seen.indexOf(gid) < 0) seen.push(gid);
      });
    } else {
      db.groups.forEach(function (g) { if (g && g.is_active !== false && seen.indexOf(g.id) < 0) seen.push(g.id); });
    }
    return seen.map(function (gid) { var g = group(db, gid); return { label: g ? g.name : gid, value: gid }; });
  }, [db, session, isVm]);

  const prjOptions = useMemo(function () {
    var seen = [];
    var pool = isVm
      ? db.projects.filter(function (pr) { return pr.is_active !== false && (session.group_ids || []).indexOf(pr.group_id) >= 0; })
      : db.projects.filter(function (pr) { return pr.is_active !== false; });
    if (grpFilter) pool = pool.filter(function (pr) { return pr.group_id === grpFilter; });
    pool.forEach(function (pr) { if (seen.indexOf(pr.id) < 0) seen.push(pr.id); });
    return seen.map(function (pid) { var pr = project(db, pid); return { label: pr ? pr.name : pid, value: pid }; });
  }, [db, session, isVm, grpFilter]);

  function changeSupFilter(v) { setSupFilter(v); ui.people.sup = v; }
  function changeStatusFilter(v) { setStatusFilter(v); ui.people.status = v; }
  function changeGrpFilter(v) { setGrpFilter(v); ui.people.grp = v; setPrjFilter(""); ui.people.prj = ""; }
  function changePrjFilter(v) { setPrjFilter(v); ui.people.prj = v; }

  function openAdd() {
    var supId = isSup && session.supplier_id ? session.supplier_id : (db.suppliers[0] ? db.suppliers[0].id : "");
    form.setFieldsValue({
      name: "",
      supplier_id: supId,
      employee_code: supId ? nextEmployeeCode(db, supId) : ""
    });
    setFileList([]);
    setAddOpen(true);
  }

  function onSupChange(supId) {
    if (supId) form.setFieldsValue({ employee_code: nextEmployeeCode(db, supId) });
  }

  function submitAdd() {
    form.validateFields().then(function (values) {
      var supId = isSup && session.supplier_id ? session.supplier_id : values.supplier_id;
      if (!supId) { message.error("请选择供应商"); return; }
      var code = String(values.employee_code || "").trim() || nextEmployeeCode(db, supId);
      var files = fileList.map(function (f) { return f.originFileObj; }).filter(Boolean);
      var photos = [];
      function persistAll(i, arr) {
        if (i >= files.length) {
          db.people.push({
            id: window.FaceStore.uid("p"),
            name: String(values.name || "").trim(),
            employee_code: code,
            supplier_id: supId,
            project_id: null,
            project_ids: [],
            group_ids: [],
            photos: arr,
            is_active: true,
            consent_status: "pending",
            consent_at: null
          });
          window.FaceStore.persist(db);
          window.FaceStore.auditLog(
            session ? (session.display_name || session.username) : "管理员",
            session ? session.role : "global_admin",
            "新增人员",
            "人员库新增 " + String(values.name || "").trim() + "（" + code + "）"
          );
          message.success("人员已加入识别库");
          setAddOpen(false);
          props.refresh();
          return;
        }
        var fr = new FileReader();
        fr.onload = function () { arr.push(String(fr.result)); persistAll(i + 1, arr); };
        fr.onerror = function () { persistAll(i + 1, arr); };
        fr.readAsDataURL(files[i]);
      }
      persistAll(0, photos);
    }).catch(function () {});
  }

  function openEdit(p) {
    setEdit(p);
    editForm.setFieldsValue({
      name: p.name || "",
      employee_code: p.employee_code || "",
      supplier_id: p.supplier_id || ""
    });
    setEditFileList((p.photos || []).map(function (src, i) {
      return { uid: "old-" + i, name: "照片" + (i + 1), status: "done", url: src, thumbUrl: src };
    }));
    setEditOpen(true);
  }

  function submitEdit() {
    editForm.validateFields().then(function (values) {
      var target = person(db, edit ? edit.id : null);
      if (!target) { message.error("人员不存在或已移除"); return; }
      var supId = isSup && session.supplier_id ? session.supplier_id : values.supplier_id;
      if (!supId) { message.error("请选择供应商"); return; }
      var code = String(values.employee_code || "").trim() || target.employee_code;
      var oldName = target.name || "";
      target.name = String(values.name || "").trim();
      target.employee_code = code;
      target.supplier_id = supId;
      var kept = editFileList.filter(function (f) { return f.url || f.thumbUrl; }).map(function (f) { return f.url || f.thumbUrl; });
      var newFiles = editFileList.filter(function (f) { return f.originFileObj; }).map(function (f) { return f.originFileObj; });
      function finish(photos) {
        target.photos = photos;
        window.FaceStore.persist(db);
        window.FaceStore.auditLog(
          session ? (session.display_name || session.username) : "管理员",
          session ? session.role : "global_admin",
          "编辑人员",
          "编辑人员 " + oldName + "（" + code + "）资料（姓名/编号/供应商/照片，未涉及项目与项目组）"
        );
        message.success("人员资料已更新");
        setEditOpen(false);
        setEdit(null);
        props.refresh();
      }
      function readNew(i, arr) {
        if (i >= newFiles.length) { finish(kept.concat(arr)); return; }
        var fr = new FileReader();
        fr.onload = function () { arr.push(String(fr.result)); readNew(i + 1, arr); };
        fr.onerror = function () { readNew(i + 1, arr); };
        fr.readAsDataURL(newFiles[i]);
      }
      readNew(0, []);
    }).catch(function () {});
  }

  function deletePerson(p) {
    if (!p) return;
    if (isSup) {
      var inGroup = (p.group_ids || []).length > 0 || personProjectIds(p).length > 0;
      if (inGroup) {
        message.warning("该人员仍在项目组 / 项目中，不能删除：请先在「申请中心」发起离项申请，待 VM 审批通过、该人员不在任何项目组后，再回来删除。");
        return;
      }
    }
    modal.confirm({
      title: "确认删除人员「" + p.name + "」？",
      content: (isSup
        ? "删除后该人员将从人员库移除；历史人脸核验记录仍保留（不再计入人员统计）。此操作不可恢复，请谨慎操作。"
        : "删除后该人员将从人员库移除，并退出所属项目 / 项目组；历史人脸核验记录仍保留（不再计入人员统计）。此操作不可恢复，请谨慎操作。"),
      okText: "删除",
      okButtonProps: { danger: true },
      cancelText: "取消",
      onOk: function () {
        db.people = db.people.filter(function (x) { return x.id !== p.id; });
        db.applications = (db.applications || []).filter(function (a) { return a.person_id !== p.id; });
        window.FaceStore.persist(db);
        window.FaceStore.auditLog(
          session ? (session.display_name || session.username) : "管理员",
          session ? session.role : "global_admin",
          "删除人员",
          "删除人员 " + p.name + "（" + (p.employee_code || "") + "）"
        );
        message.success("人员已删除");
        setDetail(null);
        props.refresh();
      }
    });
  }

  const columns = [
    {
      title: "人员",
      key: "person",
      width: 170,
      render: function (_, p) {
        return (
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Avatar shape="square" size={40} style={{ background: "#e6f4ff", color: "#1677ff", fontWeight: 600, flexShrink: 0 }}>
              {String(p.name || "?").slice(0, 1)}
            </Avatar>
            <div>
              <div style={{ fontWeight: 600 }}>{p.name}</div>
              <Text type="secondary" style={{ fontSize: 12 }}>{p.employee_code}</Text>
            </div>
          </div>
        );
      }
    },
    {
      title: "照片",
      dataIndex: "photos",
      width: 90,
      render: function (_, p) { return <Text type="secondary">{photoCountText(p)}</Text>; }
    },
    {
      title: "供应商",
      dataIndex: "supplier_id",
      render: function (sid) { return supplierName(db, sid); }
    },
    {
      title: "项目 / 项目组",
      key: "scope",
      render: function (_, p) {
        return (
          <div>
            <div>{personProjectNames(db, p)}</div>
            <Text type="secondary" style={{ fontSize: 12 }}>{groupNames(db, p.group_ids)}</Text>
          </div>
        );
      }
    },
    {
      title: "状态",
      dataIndex: "consent_status",
      width: 100,
      render: function (s) { return s === "agreed" ? <Tag color="success">已激活</Tag> : <Tag>未激活</Tag>; }
    },
    {
      title: "操作",
      key: "action",
      width: isSup ? 320 : (canEdit ? 250 : 90),
      render: function (_, p) {
        return (
          <Space size={0}>
            {canEdit && !isGlobal ? <Button type="link" onClick={function () { applyJoin(p); }}>申请入项</Button> : null}
            <Button type="link" onClick={function () { setDetail(p); }}>详情</Button>
            {canEdit ? <Button type="link" onClick={function () { openEdit(p); }}>编辑</Button> : null}
            {isSup ? <Button type="link" danger onClick={function () { deletePerson(p); }}>删除</Button> : null}
          </Space>
        );
      }
    }
  ];

  function applyJoin(p) {
    if (!p) return;
    ui.reqTab = "join";
    ui.reqJoinPerson = p.id;
    nav("leave");
  }

  function lead() {
    if (isVm) return "VM 账号可查看人员库（只读）：支持项目组 / 项目 / 供应商筛选，点击看板「当前范围人数」可跳转到本页并自动应用筛选；点击「详情」查看照片与项目组 / 项目；入项通过项目组页面的「从人员库加入」完成。";
    if (isSup) return "供应商管理员维护本供应商的人员库：新增人员不选择项目 / 项目组，编号自动顺延，默认未激活；可编辑姓名 / 编号 / 照片（不影响项目与项目组）；已不在任何项目组 / 项目的人员可删除（需二次确认，历史人脸核验记录保留）；点击「申请入项」直接跳转申请中心并发起入项申请（人员已预选）；点击「详情」查看照片与项目组 / 项目。";
    return "全局管理员可查看与编辑全部人员库（不能新增人员，人员由各供应商管理员录入并默认未激活）：可编辑姓名 / 编号 / 供应商 / 照片（不影响项目与项目组）；点击「详情」查看照片与项目组 / 项目；人员直接拉入 / 移除请到「项目管理」中操作。";
  }

  return (
    <div>
      <div className="topbar">
        <div>
          <div className="eyebrow">Identity registry</div>
          <Title level={3} style={{ margin: 0 }}>人员库</Title>
          <Text type="secondary" style={{ display: "block", marginTop: 4 }}>{lead()}</Text>
        </div>
        <Space>
          {!isVm ? <Button icon={<ReloadOutlined />} onClick={props.refresh}>刷新</Button> : null}
          {canEdit && !isGlobal ? (
            <Button type="primary" icon={<PlusOutlined />} onClick={openAdd}>新增人员</Button>
          ) : null}
        </Space>
      </div>

      <Card className="page-card" style={{ marginTop: 16 }}>
        <Space wrap style={{ marginBottom: 16 }}>
          {!isSup ? (
            <Select
              value={grpFilter}
              onChange={changeGrpFilter}
              style={{ width: 180 }}
              options={[{ label: "全部项目组", value: "" }].concat(grpOptions)}
            />
          ) : null}
          {!isSup ? (
            <Select
              value={prjFilter}
              onChange={changePrjFilter}
              style={{ width: 180 }}
              options={[{ label: "全部项目名称", value: "" }].concat(prjOptions)}
            />
          ) : null}
          {!isSup ? (
            <Select
              value={supFilter}
              onChange={changeSupFilter}
              style={{ width: 180 }}
              options={[{ label: "全部供应商", value: "all" }].concat(db.suppliers.map(function (s) { return { label: s.name, value: s.id }; }))}
            />
          ) : null}
          <Select
            value={statusFilter}
            onChange={changeStatusFilter}
            style={{ width: 140 }}
            options={[
              { label: "全部状态", value: "all" },
              { label: "已激活", value: "agreed" },
              { label: "未激活", value: "pending" }
            ]}
          />
          <Input
            allowClear
            placeholder="搜索姓名 / 编号"
            style={{ width: 240 }}
            onChange={function (e) { setKeyword(e.target.value || ""); }}
          />
        </Space>
        <Table
          rowKey="id"
          scroll={{ x: "max-content" }}
          columns={columns}
          dataSource={filtered}
          pagination={{ pageSize: 10, showTotal: function (t) { return "共 " + t + " 人"; } }}
        />
      </Card>

      <Modal open={addOpen} title="新增人员" okText="加入人员库" cancelText="取消" onOk={submitAdd} onCancel={function () { setAddOpen(false); }}>
        <Form form={form} layout="vertical">
          {!isSup ? (
            <Form.Item name="supplier_id" label="供应商" rules={[{ required: true, message: "请选择供应商" }]}>
              <Select
                options={db.suppliers.map(function (s) { return { label: s.name, value: s.id }; })}
                onChange={onSupChange}
              />
            </Form.Item>
          ) : null}
          <Form.Item name="name" label="姓名" rules={[{ required: true, message: "请输入姓名" }]}>
            <Input maxLength={20} placeholder="如 王小明" />
          </Form.Item>
          <Form.Item name="employee_code" label="人员编号（自动顺延，可修改）">
            <Input placeholder="如 A-001" />
          </Form.Item>
          <Form.Item label="照片（1-3 张，可选）">
            <Upload
              listType="picture-card"
              fileList={fileList}
              accept="image/*"
              maxCount={3}
              beforeUpload={function () { return false; }}
              onChange={function (info) { setFileList(info.fileList.slice(0, 3)); }}
            >
              {fileList.length >= 3 ? null : (
                <div>
                  <PlusOutlined />
                  <div style={{ marginTop: 8 }}>上传</div>
                </div>
              )}
            </Upload>
          </Form.Item>
          <Text type="secondary" style={{ fontSize: 12 }}>
            新增人员不分配项目 / 项目组，默认未激活；后续通过「申请入项」按项目发起申请，自动关联项目组。
          </Text>
        </Form>
      </Modal>

      <Modal
        open={editOpen}
        title={"编辑人员" + (edit ? "：" + edit.name : "")}
        okText="保存"
        cancelText="取消"
        onOk={submitEdit}
        onCancel={function () { setEditOpen(false); setEdit(null); }}
        destroyOnClose
      >
        <Form form={editForm} layout="vertical">
          {!isSup ? (
            <Form.Item name="supplier_id" label="供应商" rules={[{ required: true, message: "请选择供应商" }]}>
              <Select
                options={db.suppliers.map(function (s) { return { label: s.name, value: s.id }; })}
              />
            </Form.Item>
          ) : null}
          <Form.Item name="name" label="姓名" rules={[{ required: true, message: "请输入姓名" }]}>
            <Input maxLength={20} placeholder="如 王小明" />
          </Form.Item>
          <Form.Item name="employee_code" label="人员编号">
            <Input placeholder="如 A-001" />
          </Form.Item>
          <Form.Item label="照片（1-3 张，可选）">
            <Upload
              listType="picture-card"
              fileList={editFileList}
              accept="image/*"
              maxCount={3}
              beforeUpload={function () { return false; }}
              onChange={function (info) { setEditFileList(info.fileList.slice(0, 3)); }}
            >
              {editFileList.length >= 3 ? null : (
                <div>
                  <PlusOutlined />
                  <div style={{ marginTop: 8 }}>上传</div>
                </div>
              )}
            </Upload>
          </Form.Item>
          <Text type="secondary" style={{ fontSize: 12 }}>
            仅编辑人员本身的资料（姓名 / 编号 / 供应商 / 照片），不影响项目与项目组；状态与项目 / 项目组关联请到对应流程中处理。
          </Text>
        </Form>
      </Modal>

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
              <Descriptions.Item label="人员编号">{detail.employee_code}</Descriptions.Item>
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