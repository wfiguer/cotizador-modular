import { useState, type FormEvent } from "react";
import Modal from "../components/Modal";
import { Aviso, Confirmacion } from "../components/Dialogos";
import RenglonesEditor, { nuevoRenglon } from "../components/RenglonesEditor";
import DetalleModulo from "../components/DetalleModulo";
import { formatearCOP } from "../lib/formato";
import { renglonesAItems, sumarParciales, validarRenglones } from "../lib/calculos";
import {
  agregarItemsAModulo,
  crearModulo,
  eliminarModulo,
  eliminarModuloItem,
  recalcularModulo,
  usosDeItem,
} from "../lib/datos";
import type { Datos, Modulo, ModuloItem, RenglonForm } from "../types";

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
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [mensajeEditar, setMensajeEditar] = useState<string | null>(null);
  const [recalculando, setRecalculando] = useState(false);
  const [nuevosRenglones, setNuevosRenglones] = useState<RenglonForm[]>([]);
  const [errorNuevos, setErrorNuevos] = useState<string | null>(null);
  const [guardandoNuevos, setGuardandoNuevos] = useState(false);
  const [confirmarGuardarNuevos, setConfirmarGuardarNuevos] = useState(false);
  const [itemAEliminar, setItemAEliminar] = useState<ModuloItem | null>(null);

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

  const abrirEditar = (modulo: Modulo) => {
    setEditandoId(modulo.id);
    setMensajeEditar(null);
    setNuevosRenglones([]);
    setErrorNuevos(null);
  };

  const recalcular = async () => {
    if (!editandoId) return;
    setRecalculando(true);
    setMensajeEditar(null);
    try {
      await recalcularModulo(editandoId, datos);
      await refrescar();
      setMensajeEditar("Módulo recalculado con los valores actuales ✓");
    } catch (err) {
      setAviso(err instanceof Error ? err.message : "Error al recalcular el módulo.");
    } finally {
      setRecalculando(false);
    }
  };

  const confirmarEliminarItem = async () => {
    if (!itemAEliminar || !editandoId) return;
    try {
      await eliminarModuloItem(itemAEliminar.id, editandoId, datos);
      await refrescar();
      setMensajeEditar(
        "Módulo o Artículo eliminado correctamente, y Valor Final actualizado inmediatamente."
      );
    } catch (err) {
      setAviso(err instanceof Error ? err.message : "Error al eliminar el renglón.");
    } finally {
      setItemAEliminar(null);
    }
  };

  const pedirGuardarNuevos = () => {
    const error = validarRenglones(nuevosRenglones, datos);
    if (error) return setErrorNuevos(error);
    setErrorNuevos(null);
    setConfirmarGuardarNuevos(true);
  };

  const confirmarGuardarNuevosRenglones = async () => {
    if (!editandoId) return;
    setGuardandoNuevos(true);
    try {
      await agregarItemsAModulo(editandoId, renglonesAItems(nuevosRenglones, datos), datos);
      await refrescar();
      setNuevosRenglones([]);
      setMensajeEditar(
        "Módulo o Artículo adicionado correctamente, y Valor Final actualizado inmediatamente."
      );
    } catch (err) {
      setErrorNuevos(err instanceof Error ? err.message : "Error al agregar los renglones.");
    } finally {
      setGuardandoNuevos(false);
      setConfirmarGuardarNuevos(false);
    }
  };

  const moduloEditando = editandoId
    ? datos.modulos.find((m) => m.id === editandoId) ?? null
    : null;

  const itemsEditando = editandoId
    ? datos.moduloItems.filter((item) => item.modulo_id === editandoId)
    : [];

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
                    className="btn btn-secundario btn-chico"
                    onClick={() => abrirEditar(modulo)}
                  >
                    Editar
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

      {moduloEditando && (
        <Modal
          titulo={`Editar módulo "${moduloEditando.nombre}"`}
          onCerrar={() => setEditandoId(null)}
          ancho={680}
        >
          {itemsEditando.length === 0 ? (
            <p className="tabla-vacia">Este módulo aún no tiene renglones.</p>
          ) : (
            <ul className="arbol">
              {itemsEditando.map((item) => {
                const esArticulo = item.tipo_item === "articulo";
                const articulo = esArticulo
                  ? datos.articulos.find((a) => a.id === item.item_id)
                  : undefined;
                const submodulo = !esArticulo
                  ? datos.modulos.find((m) => m.id === item.item_id)
                  : undefined;
                const nombre = articulo?.nombre ?? submodulo?.nombre ?? "(eliminado)";
                return (
                  <li
                    key={item.id}
                    className={`arbol-fila ${esArticulo ? "arbol-articulo" : "arbol-modulo"}`}
                  >
                    <span>
                      <span className="arbol-nombre">{nombre}</span>
                      <span className="arbol-datos">
                        Cantidad: {item.cantidad}
                        {item.medida_lineal_1 != null && item.medida_lineal_2 != null && (
                          <>
                            {" · "}
                            {item.medida_lineal_1} × {item.medida_lineal_2} {item.unidad_lineal}
                          </>
                        )}
                        {item.medida_lineal_1 != null && item.medida_lineal_2 == null && (
                          <>
                            {" · "}
                            {item.medida_lineal_1} {item.unidad_lineal}
                          </>
                        )}
                        {item.desperdicio > 0 && <> · Desperdicio: {item.desperdicio}%</>}
                        {" · "}
                        <strong>{formatearCOP(item.valor_parcial)}</strong>
                      </span>
                    </span>
                    <span className="arbol-acciones">
                      {submodulo && (
                        <button
                          type="button"
                          className="btn btn-secundario btn-chico"
                          onClick={() => setDetalleId(submodulo.id)}
                        >
                          Detalle
                        </button>
                      )}
                      <button
                        type="button"
                        className="btn btn-peligro btn-chico"
                        onClick={() => setItemAEliminar(item)}
                      >
                        Eliminar
                      </button>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}

          <RenglonesEditor
            datos={datos}
            renglones={nuevosRenglones}
            onChange={setNuevosRenglones}
            onVerDetalleModulo={setDetalleId}
            excluirModuloId={moduloEditando.id}
          />

          <div className="total-final">
            Valor Final: <strong>{formatearCOP(moduloEditando.valor_final)}</strong>
          </div>

          {errorNuevos && <div className="msg-error">{errorNuevos}</div>}
          {mensajeEditar && <div className="msg-exito">{mensajeEditar}</div>}

          <div className="modal-acciones">
            <button className="btn btn-secundario" onClick={() => setEditandoId(null)}>
              Cerrar
            </button>
            <button
              className="btn btn-primario"
              onClick={recalcular}
              disabled={recalculando}
              title="Releer los valores actuales de artículos, módulos anidados y desperdicio"
            >
              {recalculando ? "Recalculando…" : "Recalcular"}
            </button>
            {nuevosRenglones.length > 0 && (
              <button
                type="button"
                className="btn btn-primario"
                onClick={pedirGuardarNuevos}
                disabled={guardandoNuevos}
              >
                {guardandoNuevos ? "Guardando…" : "Guardar"}
              </button>
            )}
          </div>
        </Modal>
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

      {itemAEliminar && (
        <Confirmacion
          titulo="Eliminar renglón"
          mensaje={`¿Eliminar este ${
            itemAEliminar.tipo_item === "articulo" ? "artículo" : "módulo"
          } del módulo "${moduloEditando?.nombre}"? Esta acción no se puede deshacer.`}
          onConfirmar={confirmarEliminarItem}
          onCancelar={() => setItemAEliminar(null)}
        />
      )}

      {confirmarGuardarNuevos && (
        <Confirmacion
          titulo="Agregar renglones"
          mensaje="¿Guardar los renglones agregados al módulo?"
          textoConfirmar="Guardar"
          variante="primario"
          onConfirmar={confirmarGuardarNuevosRenglones}
          onCancelar={() => setConfirmarGuardarNuevos(false)}
        />
      )}
    </section>
  );
}
