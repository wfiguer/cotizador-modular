import { useState } from "react";
import Modal from "./Modal";
import { supabase } from "../lib/supabase";
import { guardarParametros } from "../lib/datos";
import type { Parametros } from "../types";

type Vista = "menu" | "password" | "parametros";

interface Mensaje {
  tipo: "ok" | "error";
  texto: string;
}

interface Props {
  userId: string;
  parametros: Parametros;
  refrescar: () => Promise<void>;
  onCerrar: () => void;
}

export default function ModalConfiguracion({ userId, parametros, refrescar, onCerrar }: Props) {
  const [vista, setVista] = useState<Vista>("menu");

  // --- Cambiar contraseña ---
  const [nuevaPassword, setNuevaPassword] = useState("");
  const [confirmarPassword, setConfirmarPassword] = useState("");
  const [mostrarNueva, setMostrarNueva] = useState(false);
  const [mostrarConfirmar, setMostrarConfirmar] = useState(false);
  const [mensajePassword, setMensajePassword] = useState<Mensaje | null>(null);
  const [guardandoPassword, setGuardandoPassword] = useState(false);

  // --- Parámetros ---
  const [desperdicioArea, setDesperdicioArea] = useState(String(parametros.desperdicio_area));
  const [desperdicioLineal, setDesperdicioLineal] = useState(String(parametros.desperdicio_lineal));
  const [mensajeArea, setMensajeArea] = useState<Mensaje | null>(null);
  const [mensajeLineal, setMensajeLineal] = useState<Mensaje | null>(null);
  const [guardandoParametro, setGuardandoParametro] = useState(false);

  const volver = () => {
    setVista("menu");
    setNuevaPassword("");
    setConfirmarPassword("");
    setMensajePassword(null);
    setMostrarNueva(false);
    setMostrarConfirmar(false);
    setMensajeArea(null);
    setMensajeLineal(null);
  };

  const guardarPassword = async () => {
    setMensajePassword(null);
    if (!nuevaPassword || !confirmarPassword) {
      setMensajePassword({ tipo: "error", texto: "Complete ambos campos" });
      return;
    }
    if (nuevaPassword.length < 6) {
      setMensajePassword({ tipo: "error", texto: "La contraseña debe tener al menos 6 caracteres" });
      return;
    }
    if (nuevaPassword !== confirmarPassword) {
      setMensajePassword({ tipo: "error", texto: "Las contraseñas no coinciden" });
      return;
    }
    setGuardandoPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: nuevaPassword });
      if (error) throw error;
      setMensajePassword({ tipo: "ok", texto: "Contraseña actualizada ✓" });
      setNuevaPassword("");
      setConfirmarPassword("");
    } catch (err) {
      setMensajePassword({
        tipo: "error",
        texto: err instanceof Error ? err.message : "No se pudo actualizar la contraseña",
      });
    } finally {
      setGuardandoPassword(false);
    }
  };

  const guardarParametro = async (campo: "desperdicio_area" | "desperdicio_lineal") => {
    const texto = campo === "desperdicio_area" ? desperdicioArea : desperdicioLineal;
    const setMensaje = campo === "desperdicio_area" ? setMensajeArea : setMensajeLineal;
    setMensaje(null);
    const valor = Number(texto);
    if (texto === "" || Number.isNaN(valor) || valor < 0) {
      setMensaje({ tipo: "error", texto: "Ingrese un porcentaje válido (mayor o igual a 0)" });
      return;
    }
    setGuardandoParametro(true);
    try {
      await guardarParametros(userId, { [campo]: valor });
      await refrescar();
      setMensaje({ tipo: "ok", texto: `Desperdicio actualizado al ${valor}% ✓` });
    } catch (err) {
      setMensaje({
        tipo: "error",
        texto: err instanceof Error ? err.message : "No se pudo guardar el parámetro",
      });
    } finally {
      setGuardandoParametro(false);
    }
  };

  return (
    <Modal titulo="Configuración" onCerrar={onCerrar} ancho={560}>
      {vista === "menu" && (
        <div className="config-menu">
          <button className="btn btn-secundario" onClick={() => setVista("password")}>
            🔑 Cambio Contraseña
          </button>
          <button className="btn btn-secundario" onClick={() => setVista("parametros")}>
            ⚙️ Parámetros
          </button>
          <div className="modal-acciones">
            <button className="btn btn-secundario" onClick={onCerrar}>
              Cerrar
            </button>
          </div>
        </div>
      )}

      {vista === "password" && (
        <div className="form-vertical">
          <h3 className="config-subtitulo">Cambio Contraseña</h3>
          <div className="campo-password">
            <input
              type={mostrarNueva ? "text" : "password"}
              placeholder="Nueva contraseña"
              value={nuevaPassword}
              onChange={(e) => setNuevaPassword(e.target.value)}
              autoComplete="new-password"
            />
            <button
              type="button"
              className="btn-ojo"
              onClick={() => setMostrarNueva((v) => !v)}
              aria-label="Mostrar contraseña"
            >
              {mostrarNueva ? "🙈" : "👁"}
            </button>
          </div>
          <div className="campo-password">
            <input
              type={mostrarConfirmar ? "text" : "password"}
              placeholder="Confirmar contraseña"
              value={confirmarPassword}
              onChange={(e) => setConfirmarPassword(e.target.value)}
              autoComplete="new-password"
            />
            <button
              type="button"
              className="btn-ojo"
              onClick={() => setMostrarConfirmar((v) => !v)}
              aria-label="Mostrar contraseña"
            >
              {mostrarConfirmar ? "🙈" : "👁"}
            </button>
          </div>

          {mensajePassword && (
            <div className={mensajePassword.tipo === "ok" ? "msg-exito" : "msg-error"}>
              {mensajePassword.texto}
            </div>
          )}

          <button
            className="btn btn-primario btn-grande"
            onClick={guardarPassword}
            disabled={guardandoPassword}
          >
            {guardandoPassword ? "Guardando…" : "Guardar contraseña"}
          </button>
          <div className="modal-acciones">
            <button className="btn btn-secundario" onClick={volver}>
              ← Volver
            </button>
            <button className="btn btn-secundario" onClick={onCerrar}>
              Cerrar
            </button>
          </div>
        </div>
      )}

      {vista === "parametros" && (
        <div className="form-vertical">
          <h3 className="config-subtitulo">Parámetros</h3>

          <div className="fila-parametro">
            <span className="parametro-etiqueta">Desperdicio para artículos de tipo m2/cm2/mm2</span>
            <div className="parametro-controles">
              <input
                type="number"
                min="0"
                step="any"
                value={desperdicioArea}
                onChange={(e) => setDesperdicioArea(e.target.value)}
              />
              <span className="parametro-pct">%</span>
              <button
                className="btn btn-primario btn-chico"
                onClick={() => guardarParametro("desperdicio_area")}
                disabled={guardandoParametro}
              >
                Guardar
              </button>
            </div>
          </div>
          {mensajeArea && (
            <div className={mensajeArea.tipo === "ok" ? "msg-exito" : "msg-error"}>
              {mensajeArea.texto}
            </div>
          )}

          <div className="fila-parametro">
            <span className="parametro-etiqueta">Desperdicio para artículos de tipo m/cm/mm</span>
            <div className="parametro-controles">
              <input
                type="number"
                min="0"
                step="any"
                value={desperdicioLineal}
                onChange={(e) => setDesperdicioLineal(e.target.value)}
              />
              <span className="parametro-pct">%</span>
              <button
                className="btn btn-primario btn-chico"
                onClick={() => guardarParametro("desperdicio_lineal")}
                disabled={guardandoParametro}
              >
                Guardar
              </button>
            </div>
          </div>
          {mensajeLineal && (
            <div className={mensajeLineal.tipo === "ok" ? "msg-exito" : "msg-error"}>
              {mensajeLineal.texto}
            </div>
          )}

          <p className="campo-ayuda">
            Los cambios no modifican los módulos ni las cotizaciones existentes: se aplican a los
            renglones nuevos y al presionar «Recalcular» en cada módulo o cotización.
          </p>

          <div className="modal-acciones">
            <button className="btn btn-secundario" onClick={volver}>
              ← Volver
            </button>
            <button className="btn btn-secundario" onClick={onCerrar}>
              Cerrar
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
