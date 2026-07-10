import { useEffect, useMemo, useState, type FormEvent } from "react";
import Modal from "../components/Modal";
import { Confirmacion } from "../components/Dialogos";
import RenglonesEditor, { nuevoRenglon } from "../components/RenglonesEditor";
import DetalleModulo from "../components/DetalleModulo";
import { formatearCOP, formatearFecha, hoyISO } from "../lib/formato";
import {
  cotizacionesDesactualizadas,
  itemDesactualizado,
  modulosDesactualizados,
  recalcularRenglon,
  renglonesAItems,
  sumarParciales,
  validarRenglones,
  valorFinalConUtilidad,
} from "../lib/calculos";
import {
  actualizarCotizacion,
  congelarCotizacion,
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
  const [aCongelar, setACongelar] = useState<Cotizacion | null>(null);
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
  // Snapshot del % de utilidad: se congela al abrir la cotización y solo se
  // actualiza desde Parámetros al presionar "Recalcular" (igual que el desperdicio).
  const [utilidad, setUtilidad] = useState(0);
  const [errorForm, setErrorForm] = useState<string | null>(null);
  const [mensajeRecalculo, setMensajeRecalculo] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const valorFinal = sumarParciales(renglones);
  const valorConUtilidad = valorFinalConUtilidad(valorFinal, utilidad);

  // Módulos y cotizaciones con actualizaciones pendientes con respecto a
  // Parámetros (se recalculan solo cuando se refrescan los datos).
  const modulosPendientes = useMemo(() => modulosDesactualizados(datos), [datos]);
  const cotizacionesPendientes = useMemo(
    () => cotizacionesDesactualizadas(datos, modulosPendientes),
    [datos, modulosPendientes]
  );

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
    setUtilidad(datos.parametros.utilidad);
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
    setUtilidad(cotizacion.utilidad);
    setErrorForm(null);
    setMensajeRecalculo(null);
    setModal("editar");
  };

  const recalcular = () => {
    setRenglones((actuales) => actuales.map((r) => recalcularRenglon(r, datos)));
    setUtilidad(datos.parametros.utilidad);
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
        await actualizarCotizacion(cotizacionActual.id, campos, valorFinal, utilidad, items);
      } else {
        await crearCotizacion(userId, campos, valorFinal, utilidad, items);
      }
      await refrescar();
      setModal(null);
    } catch (err) {
      setErrorForm(err instanceof Error ? err.message : "Error al guardar la cotización.");
    } finally {
      setGuardando(false);
    }
  };

  const confirmarCongelar = async () => {
    if (!aCongelar) return;
    try {
      await congelarCotizacion(aCongelar.id);
      await refrescar();
    } finally {
      setACongelar(null);
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
              <th className="estado">Estado</th>
              <th>Fecha Creación</th>
              <th>Fecha Actualización</th>
              <th>Nombre Cliente</th>
              <th>N° Documento</th>
              <th className="num">Valor Final</th>
              <th className="num">Valor Final Con Utilidad</th>
              <th className="acciones">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {datos.cotizaciones.map((cotizacion) => (
              <tr key={cotizacion.id} className={cotizacion.congelada ? "fila-congelada" : undefined}>
                <td className="num">{cotizacion.id}</td>
                <td className="estado">
                  {!cotizacion.congelada &&
                    (cotizacionesPendientes.has(cotizacion.id) ? (
                      <span
                        className="bombillo bombillo-pendiente"
                        title="Hay actualizaciones pendientes con respecto a Parámetros en esta cotización o en los módulos que usa. Recalcule desde «Editar»."
                      />
                    ) : (
                      <span
                        className="bombillo bombillo-ok"
                        title="La cotización está actualizada con respecto a Parámetros."
                      />
                    ))}
                </td>
                <td>{formatearFecha(cotizacion.fecha_creacion)}</td>
                <td>{formatearFecha(cotizacion.fecha_actualizacion)}</td>
                <td>{cotizacion.nombre_cliente}</td>
                <td>{cotizacion.numero_documento}</td>
                <td className="num">{formatearCOP(cotizacion.valor_final)}</td>
                <td className="num">
                  {formatearCOP(valorFinalConUtilidad(cotizacion.valor_final, cotizacion.utilidad))}
                </td>
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
                    disabled={cotizacion.congelada}
                    title={cotizacion.congelada ? "La cotización está congelada y no se puede editar" : undefined}
                  >
                    Editar
                  </button>
                  <button
                    className="btn btn-secundario btn-chico"
                    onClick={() => setACongelar(cotizacion)}
                    disabled={cotizacion.congelada}
                    title={cotizacion.congelada ? "La cotización ya está congelada" : "Congelar la cotización"}
                  >
                    Congelar
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
            <div className="total-final">
              Utilidad: <strong>{utilidad}%</strong>
            </div>
            <div className="total-final">
              Valor Final Con Utilidad: <strong>{formatearCOP(valorConUtilidad)}</strong>
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
              .map((item) => {
                const moduloPendiente =
                  item.tipo_item === "modulo" && modulosPendientes.has(item.item_id);
                const renglonPendiente =
                  !detalleCotizacion.congelada &&
                  (moduloPendiente || itemDesactualizado(item, datos));
                return (
                <li key={item.id} className={item.tipo_item === "modulo" ? "arbol-modulo" : "arbol-articulo"}>
                  <span className="arbol-nombre">
                    {renglonPendiente && (
                      <span
                        className="bombillo bombillo-pendiente"
                        title={
                          moduloPendiente
                            ? "Este módulo tiene actualizaciones pendientes con respecto a Parámetros. Actualícelo primero desde Módulos → «Editar»."
                            : item.tipo_item === "articulo"
                              ? "Este artículo está desactualizado con respecto a Parámetros. Recalcule la cotización desde «Editar»."
                              : "El valor de este renglón está desactualizado. Recalcule la cotización desde «Editar»."
                        }
                      />
                    )}
                    {nombreDeItem(item.tipo_item, item.item_id)}
                  </span>
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
                );
              })}
          </ul>
          <div className="total-final">
            Valor Final: <strong>{formatearCOP(detalleCotizacion.valor_final)}</strong>
          </div>
          <div className="total-final">
            {!detalleCotizacion.congelada &&
              detalleCotizacion.utilidad !== datos.parametros.utilidad && (
                <>
                  <span
                    className="bombillo bombillo-pendiente"
                    title="El % de utilidad difiere del vigente en Parámetros. Recalcule la cotización desde «Editar»."
                  />{" "}
                </>
              )}
            Utilidad: <strong>{detalleCotizacion.utilidad}%</strong>
          </div>
          <div className="total-final">
            Valor Final Con Utilidad:{" "}
            <strong>
              {formatearCOP(valorFinalConUtilidad(detalleCotizacion.valor_final, detalleCotizacion.utilidad))}
            </strong>
          </div>
          <div className="modal-acciones">
            {cotizacionesPendientes.has(detalleCotizacion.id) && (
              <div className="msg-error alerta-en-acciones">
                Existen actualizaciones pendientes por realizar con respecto a Parámetros para
                esta cotización. Actualícela desde la función «Editar».
              </div>
            )}
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

      {aCongelar && (
        <Confirmacion
          titulo="Congelar cotización"
          mensaje={`Al congelar la cotización no podrá volver a editar la cotización. ¿Desea congelar la cotización #${aCongelar.id} de '${aCongelar.nombre_cliente}'?`}
          textoConfirmar="Congelar"
          variante="primario"
          onConfirmar={confirmarCongelar}
          onCancelar={() => setACongelar(null)}
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
