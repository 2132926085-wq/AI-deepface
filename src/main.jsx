import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./App.css"; // 浅色主题 + 动画样式
import "./lib/mock-data.js"; // 挂载 window.FaceStore（数据层与现有 demo 完全一致）

createRoot(document.getElementById("root")).render(<App />);