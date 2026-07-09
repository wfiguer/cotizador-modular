import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { aplicarTema, temaInicial } from "./lib/tema";
import "./index.css";

// Aplicar el tema antes del primer render para evitar un destello de tema incorrecto
aplicarTema(temaInicial());

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
