import React from "react";
import ReactDOM from "react-dom";
import { WorkItemList } from "./components/work-item-list";
import "./index.css";

ReactDOM.render(
  <React.StrictMode>
    <WorkItemList />
  </React.StrictMode>,
  document.getElementById("root")
);
