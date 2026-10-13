// 页面间共享的轻量 UI 状态（与现有 demo 的 ui 对象同思路，跨页面切换保留筛选/页签）
export const ui = {
  rec: { sup: "", grp: "", prj: "", tab: "done", date: "", month: "" },
  board: { sup: "", grp: "", prj: "" },
  people: { sup: "all", grp: "", prj: "", status: "all" },
  clock: {
    scanning: false,
    scanPerson: null,
    result: null,
    ipMismatch: false,
    fakeIps: ["172.16.0.99", "10.99.1.5", "192.168.88.88"],
    fakeIdx: 0
  },
  peopleSup: null,
  reqTab: "join",
  reqJoinPerson: null,
  addSup: {},
  vmGrp: "",
  vmPrj: "",
  vmTab: "overview",
  vmPerson: "",
  personRec: { date: "", month: "" }
};
