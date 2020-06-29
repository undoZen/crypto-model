import React from "react";
import ReactDOM from "react-dom";
import "./index.css";
import App from "./App";
import { BrowserRouter } from "react-router-dom";
import { ModelContainerProvider } from "model-container";

ReactDOM.render(
  <React.StrictMode>
    <ModelContainerProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ModelContainerProvider>
  </React.StrictMode>,
  document.getElementById("root")
);
