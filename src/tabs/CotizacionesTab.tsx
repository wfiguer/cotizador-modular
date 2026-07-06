import { useEffect, useState, type FormEvent } from "react";
import Modal from "../components/Modal";
import { Confirmacion } from "../components/Dialogos";
import RenglonesEditor, { nuevoRenglon } from "../components/RenglonesEditor";
import DetalleModulo from "../components/DetalleModulo";
import { formatearCOP, formatearFecha, hoyISO } from "../lib/formato";
import {
  recalcularRenglon,
  renglonesAItems,
  sumarParciales,
  validarRenglones,
} from "../lib/calculos";
import {
  actualizarCotizacion,
  crearCotizacion,
  eliminarCotizacion,
  proximoIdCotizacion,
} from "../lib/datos";
import { exportarCotizacion } from "../lib/exportar";
import type { Cotizacion, Datos, RenglonForm } from "../types";

interface Props {
  datos: Datos;
  userId: string;
  refrescar: () => Promise<void>;
}

export default function CotizacionesTab({ datos, userId, refrescar }: Props) {
  const [modal, setModal] = useState<"crear" | "editar" | null>(null);
  const [cotizacionActual, setCotizacionActual] = useState<Cotizacion | null>(null);
  const [detalleCotizacion, setDetalleCotizacion] = useState<Cotizacion | null>(null);
  const [aEliminar, setAEliminar] = useState<Cotizacion | null>(null);
  const [detalleModuloId, setDetalleModuloId] = useState<string | null>(null);

  const clienteVacio = {
    nombre_cliente: "",
    numero_documento: "",
    direccion: "",
    telefono: "",
    ciudad: "",
    version: "",
  };

  const [idPrevisto, setIdPrevisto] = useState<number | null>(null);
  const [cliente, setCliente] = useState(clienteVacio);
  const [renglones, setRenglones] = useState<RenglonForm[]>([]);
  const [errorForm, setErrorForm] = useState<string | null>(null);
  const [mensajeRecalculo, setMensajeRecalculo] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const valorFinal = sumarParciales(renglones);

  useEffect(() => {
    if (modal === "crear") {
      setIdPrevisto(null);
      proximoIdCotizacion().then(setIdPrevisto);
    }
  }, [modal]);

  const abrirCrear = () => {
    setCotizacionActual(null);
    setCliente(clienteVacio);
    setRenglones([nuevoRenglon()]);
    setErrorForm(null);
    setMensajeRecalculo(null);
    setModal("crear");
  };

  const abrirEditar = (cotizacion: Cotizacion) => {
    setCotizacionActual(cotizacion);
    setCliente({
      nombre_cliente: cotizacion.nombre_cliente,
      numero_documento: cotizacion.numero_documento,
      direccion: cotizacion.direccion,
      telefono: cotizacion.telefono,
      ciudad: cotizacion.ciudad,
      version: cotizacion.version,
    });
    const items = datos.cotizacionItems.filter((item) => item.cotizacion_id === cotizacion.id);
    setRenglones(
      items.map((item) => ({
        ...nuevoRenglon(),
        tipo_item: item.tipo_item,
        item_id: item.item_id,
        cantidad: String(item.cantidad),
        medida_lineal_1: item.medida_lineal_1 != null ? String(item.medida_lineal_1) : "",
        medida_lineal_2: item.medida_lineal_2 != null ? String(item.medida_lineal_2) : "",
        unidad_lineal: item.unidad_lineal ?? "m",
        // Snapshot: se muestran el % de desperdicio y el valor guardados hasta
        // que el usuario modifique el renglón o presione "Recalcular".
        desperdicio: item.desperdicio,
        valor_parcial: item.valor_parcial,
      }))
    );
    setErrorForm(null);
    setMensajeRecalculo(null);
    setModal("editar");
  };

  const recalcular = () => {
    setRenglones((actuales) => actuales.map((r) => recalcularRenglon(r, datos)));
    setMensajeRecalculo("Recalculado. Presione Guardar para aplicar los cambios.");
  };

  const guardar = async (e: FormEvent) => {
    e.preventDefault();
    if (!cliente.nombre_cliente.trim()) return setErrorForm("El nombre del cliente es obligatorio.");
    const errorRenglones = validarRenglones(renglones, datos);
    if (errorRenglones) return setErrorForm(errorRenglones);

    // Los valores parciales guardados son los que se muestran (snapshot),
    // no se recalculan automáticamente al guardar.
    const items = renglonesAItems(renglones, datos);
    const campos = {
      nombre_cliente: cliente.nombre_cliente.trim(),
      numero_documento: cliente.numero_documento.trim(),
      direccion: cliente.direccion.trim(),
      telefono: cliente.telefono.trim(),
      ciudad: cliente.ciudad.trim(),
      version: cliente.version.trim(),
    };

    setGuardando(true);
    try {
      if (modal === "editar" && cotizacionActual) {
        await actualizarCotizacion(cotizacionActual.id, campos, valorFinal, items);
      } else {
        await crearCotizacion(userId, campos, valorFinal, items);
      }
      await refrescar();
      setModal(null);
    } catch (err) {
      setErrorForm(err instanceof Error ? err.message : "Error al guardar la cotización.");
    } finally {
      setGuardando(false);
    }
  };

  const confirmarEliminar = async () => {
    if (!aEliminar) return;
    try {
      await eliminarCotizacion(aEliminar.id);
      await refrescar();
    } finally {
      setAEliminar(null);
    }
  };

  const nombreDeItem = (tipo: string, id: string): string => {
    if (tipo === "articulo") return datos.articulos.find((a) => a.id === id)?.nombre ?? "(eliminado)";
    return datos.modulos.find((m) => m.id === id)?.nombre ?? "(eliminado)";
  };

  return (
    <section>
      <div className="tab-encabezado">
        <h1>Cotizaciones</h1>
        <button className="btn btn-primario" onClick={abrirCrear} title="Agregar cotización">
          +
        </button>
      </div>

      {datos.cotizaciones.length === 0 ? (
        <p className="tabla-vacia">Aún no hay cotizaciones. Agregue la primera con el botón «+».</p>
      ) : (
        <table className="tabla">
          <thead>
            <tr>
              <th className="num">Id</th>
              <th>Fecha Creación</th>
              <th>Fecha Actualización</th>
              <th>Nombre Cliente</th>
              <th>N° Documento</th>
              <th className="num">Valor Final</th>
              <th className="acciones">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {datos.cotizaciones.map((cotizacion) => (
              <tr key={cotizacion.id}>
                <td className="num">{cotizacion.id}</td>
                <td>{formatearFecha(cotizacion.fecha_creacion)}</td>
                <td>{formatearFecha(cotizacion.fecha_actualizacion)}</td>
                <td>{cotizacion.nombre_cliente}</td>
                <td>{cotizacion.numero_documento}</td>
                <td className="num">{formatearCOP(cotizacion.valor_final)}</td>
                <td className="acciones">
                  <button
                    className="btn btn-secundario btn-chico"
                    onClick={() => setDetalleCotizacion(cotizacion)}
                  >
                    Detalle
                  </button>
                  <button
                    className="btn btn-secundario btn-chico"
                    onClick={() => abrirEditar(cotizacion)}
                  >
                    Editar
                  </button>
                  <button
                    className="btn btn-peligro btn-chico"
                    onClick={() => setAEliminar(cotizacion)}
                  >
                    Eliminar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {modal && (
        <Modal
          titulo={modal === "crear" ? "Nueva cotización" : "Editar cotización"}
          onCerrar={() => setModal(null)}
          ancho={680}
        >
          <form onSubmit={guardar} className="form-vertical">
            <div className="fila-datos">
              <div className="dato-fijo">
                <span className="dato-etiqueta">Id</span>
                <span className="dato-valor">
                  {modal === "crear" ? (idPrevisto ?? "…") : cotizacionActual?.id}
                </span>
              </div>
              <div className="dato-fijo">
                <span className="dato-etiqueta">Fecha Creación</span>
                <span className="dato-valor">
                  {modal === "crear"
                    ? formatearFecha(hoyISO())
                    : formatearFecha(cotizacionActual?.fecha_creacion ?? hoyISO())}
                </span>
              </div>
            </div>

            <div className="fila-campos">
              <label className="campo">
                Nombre Cliente
                <input
                  value={cliente.nombre_cliente}
                  onChange={(e) => setCliente({ ...cliente, nombre_cliente: e.target.value })}
                  autoFocus
                />
              </label>
              <label className="campo">
                N° Documento
                <input
                  value={cliente.numero_documento}
                  onChange={(e) => setCliente({ ...cliente, numero_documento: e.target.value })}
                />
              </label>
              <label className="campo">
                Dirección
                <input
                  value={cliente.direccion}
                  onChange={(e) => setCliente({ ...cliente, direccion: e.target.value })}
                />
              </label>
              <label className="campo">
                Teléfono
                <input
                  value={cliente.telefono}
                  onChange={(e) => setCliente({ ...cliente, telefono: e.target.value })}
                />
              </label>
              <label className="campo">
                Ciudad
                <input
                  value={cliente.ciudad}
                  onChange={(e) => setCliente({ ...cliente, ciudad: e.target.value })}
                />
              </label>
              <label className="campo">
                Versión de Cotización
                <input
                  value={cliente.version}
                  onChange={(e) => setCliente({ ...cliente, version: e.target.value })}
                />
              </label>
            </div>

            <RenglonesEditor
              datos={datos}
              renglones={renglones}
              onChange={setRenglones}
              onVerDetalleModulo={setDetalleModuloId}
            />

            <div className="total-final">
              Valor Final: <strong>{formatearCOP(valorFinal)}</strong>
            </div>

            {errorForm && <div className="msg-error">{errorForm}</div>}
            {mensajeRecalculo && <div className="msg-exito">{mensajeRecalculo}</div>}

            <div className="modal-acciones">
              {modal === "editar" && (
                <button
                  type="button"
                  className="btn btn-secundario"
                  onClick={recalcular}
                  title="Releer los valores actuales de artículos y módulos"
                >
                  Recalcular
                </button>
              )}
              <button type="button" className="btn btn-secundario" onClick={() => setModal(null)}>
                Cancelar
              </button>
              <button type="submit" className="btn btn-primario" disabled={guardando}>
                {guardando ? "Guardando…" : "Guardar"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {detalleCotizacion && (
        <Modal
          titulo={`Detalle de la cotización #${detalleCotizacion.id}`}
          onCerrar={() => setDetalleCotizacion(null)}
          ancho={620}
        >
          <p>
            Cliente: <strong>{detalleCotizacion.nombre_cliente}</strong>
            {detalleCotizacion.numero_documento && (
              <>
                {" · "}N° Documento: {detalleCotizacion.numero_documento}
              </>
            )}
            {detalleCotizacion.telefono && <> · Teléfono: {detalleCotizacion.telefono}</>}
            {detalleCotizacion.direccion && <> · Dirección: {detalleCotizacion.direccion}</>}
            {detalleCotizacion.ciudad && <> · Ciudad: {detalleCotizacion.ciudad}</>}
            {detalleCotizacion.version && <> · Versión: {detalleCotizacion.version}</>}
            {" · "}Creada: {formatearFecha(detalleCotizacion.fecha_creacion)}
            {" · "}Actualizada: {formatearFecha(detalleCotizacion.fecha_actualizacion)}
          </p>
          <ul className="arbol">
            {datos.cotizacionItems
              .filter((item) => item.cotizacion_id === detalleCotizacion.id)
              .map((item) => (
                <li key={item.id} className={item.tipo_item === "modulo" ? "arbol-modulo" : "arbol-articulo"}>
                  <span className="arbol-nombre">{nombreDeItem(item.tipo_item, item.item_id)}</span>
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
                </li>
              ))}
          </ul>
          <div className="total-final">
            Valor Final: <strong>{formatearCOP(detalleCotizacion.valor_final)}</strong>
          </div>
          <div className="modal-acciones">
            <button className="btn btn-secundario" onClick={() => setDetalleCotizacion(null)}>
              Cerrar
            </button>
            <button
              className="btn btn-primario"
              onClick={() => exportarCotizacion(detalleCotizacion, datos)}
              title="Descargar el detalle de la cotización en Excel"
            >
              Exportar
            </button>
          </div>
        </Modal>
      )}

      {detalleModuloId && (
        <DetalleModulo
          moduloId={detalleModuloId}
          datos={datos}
          onCerrar={() => setDetalleModuloId(null)}
        />
      )}

      {aEliminar && (
        <Confirmacion
          titulo="Eliminar cotización"
          mensaje={`¿Eliminar la cotización #${aEliminar.id} de '${aEliminar.nombre_cliente}'? Esta acción no se puede deshacer.`}
          onConfirmar={confirmarEliminar}
          onCancelar={() => setAEliminar(null)}
        />
      )}
    </section>
  );
}
