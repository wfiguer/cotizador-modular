import { useState, type FormEvent } from "react";
import Modal from "../components/Modal";
import { Aviso, Confirmacion } from "../components/Dialogos";
import RenglonesEditor, { nuevoRenglon } from "../components/RenglonesEditor";
import DetalleModulo from "../components/DetalleModulo";
import { formatearCOP } from "../lib/formato";
import { renglonesAItems, sumarParciales, validarRenglones } from "../lib/calculos";
import { crearModulo, eliminarModulo, usosDeItem } from "../lib/datos";
import type { Datos, Modulo, RenglonForm } from "../types";

interface Props {
  datos: Datos;
  userId: string;
  refrescar: () => Promise<void>;
}

export default function ModulosTab({ datos, userId, refrescar }: Props) {
  const [modalAbierto, setModalAbierto] = useState(false);
  const [nombre, setNombre] = useState("");
  const [renglones, setRenglones] = useState<RenglonForm[]>([]);
  const [errorForm, setErrorForm] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [aEliminar, setAEliminar] = useState<Modulo | null>(null);
  const [detalleId, setDetalleId] = useState<string | null>(null);

  const valorFinal = sumarParciales(renglones);

  const abrirCrear = () => {
    setNombre("");
    setRenglones([nuevoRenglon()]);
    setErrorForm(null);
    setModalAbierto(true);
  };

  const guardar = async (e: FormEvent) => {
    e.preventDefault();
    if (!nombre.trim()) return setErrorForm("El nombre del módulo es obligatorio.");
    const errorRenglones = validarRenglones(renglones, datos);
    if (errorRenglones) return setErrorForm(errorRenglones);

    setGuardando(true);
    try {
      await crearModulo(userId, nombre.trim(), valorFinal, renglonesAItems(renglones, datos));
      await refrescar();
      setModalAbierto(false);
    } catch (err) {
      setErrorForm(err instanceof Error ? err.message : "Error al guardar el módulo.");
    } finally {
      setGuardando(false);
    }
  };

  const pedirEliminar = (modulo: Modulo) => {
    const usos = usosDeItem("modulo", modulo.id, datos);
    if (usos.length > 0) {
      setAviso(
        `No se puede eliminar el módulo '${modulo.nombre}' porque está siendo usado en: ${usos.join(", ")}`
      );
      return;
    }
    setAEliminar(modulo);
  };

  const confirmarEliminar = async () => {
    if (!aEliminar) return;
    try {
      await eliminarModulo(aEliminar.id);
      await refrescar();
    } catch (err) {
      setAviso(err instanceof Error ? err.message : "Error al eliminar el módulo.");
    } finally {
      setAEliminar(null);
    }
  };

  return (
    <section>
      <div className="tab-encabezado">
        <h1>Módulos</h1>
        <button className="btn btn-primario" onClick={abrirCrear} title="Agregar módulo">
          +
        </button>
      </div>

      {datos.modulos.length === 0 ? (
        <p className="tabla-vacia">Aún no hay módulos. Agregue el primero con el botón «+».</p>
      ) : (
        <table className="tabla">
          <thead>
            <tr>
              <th>Nombre</th>
              <th className="num">Valor</th>
              <th className="acciones">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {datos.modulos.map((modulo) => (
              <tr key={modulo.id}>
                <td>{modulo.nombre}</td>
                <td className="num">{formatearCOP(modulo.valor_final)}</td>
                <td className="acciones">
                  <button
                    className="btn btn-secundario btn-chico"
                    onClick={() => setDetalleId(modulo.id)}
                  >
                    Detalle
                  </button>
                  <button
                    className="btn btn-peligro btn-chico"
                    onClick={() => pedirEliminar(modulo)}
                  >
                    Eliminar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {modalAbierto && (
        <Modal titulo="Nuevo módulo" onCerrar={() => setModalAbierto(false)} ancho={680}>
          <form onSubmit={guardar} className="form-vertical">
            <label className="campo">
              Nombre
              <input value={nombre} onChange={(e) => setNombre(e.target.value)} autoFocus />
            </label>

            <RenglonesEditor
              datos={datos}
              renglones={renglones}
              onChange={setRenglones}
              onVerDetalleModulo={setDetalleId}
            />

            <div className="total-final">
              Valor Final: <strong>{formatearCOP(valorFinal)}</strong>
            </div>

            {errorForm && <div className="msg-error">{errorForm}</div>}

            <div className="modal-acciones">
              <button
                type="button"
                className="btn btn-secundario"
                onClick={() => setModalAbierto(false)}
              >
                Cancelar
              </button>
              <button type="submit" className="btn btn-primario" disabled={guardando}>
                {guardando ? "Guardando…" : "Guardar"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {detalleId && (
        <DetalleModulo moduloId={detalleId} datos={datos} onCerrar={() => setDetalleId(null)} />
      )}

      {aviso && <Aviso titulo="No se puede eliminar" mensaje={aviso} onCerrar={() => setAviso(null)} />}

      {aEliminar && (
        <Confirmacion
          titulo="Eliminar módulo"
          mensaje={`¿Eliminar el módulo '${aEliminar.nombre}'? Esta acción no se puede deshacer.`}
          onConfirmar={confirmarEliminar}
          onCancelar={() => setAEliminar(null)}
        />
      )}
    </section>
  );
}
