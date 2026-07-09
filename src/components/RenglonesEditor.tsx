import {
  calcularParcialRenglon,
  desperdicioParaArticulo,
  esTipoArea,
  esTipoLineal,
} from "../lib/calculos";
import { formatearCOP } from "../lib/formato";
import type { Datos, RenglonForm, TipoItem, UnidadLineal } from "../types";

let contadorClave = 0;

export function nuevoRenglon(): RenglonForm {
  contadorClave += 1;
  return {
    clave: `r${Date.now()}-${contadorClave}`,
    tipo_item: "",
    item_id: "",
    cantidad: "1",
    medida_lineal_1: "",
    medida_lineal_2: "",
    unidad_lineal: "m",
    desperdicio: 0,
    valor_parcial: 0,
  };
}

interface Props {
  datos: Datos;
  renglones: RenglonForm[];
  onChange: (renglones: RenglonForm[]) => void;
  onVerDetalleModulo: (moduloId: string) => void;
  /** Módulo que no debe aparecer como opción (evita que un módulo se contenga a sí mismo). */
  excluirModuloId?: string;
}

export default function RenglonesEditor({
  datos,
  renglones,
  onChange,
  onVerDetalleModulo,
  excluirModuloId,
}: Props) {
  const modulosDisponibles = excluirModuloId
    ? datos.modulos.filter((m) => m.id !== excluirModuloId)
    : datos.modulos;
  const hayOpciones = datos.articulos.length > 0 || modulosDisponibles.length > 0;

  if (!hayOpciones) {
    return (
      <div className="msg-aviso">
        No existen artículos o módulos ya ingresados. Por favor adicionar primero un artículo
      </div>
    );
  }

  const actualizar = (indice: number, cambios: Partial<RenglonForm>) => {
    const nuevos = renglones.map((r, i) => (i === indice ? { ...r, ...cambios } : r));
    nuevos[indice].valor_parcial = calcularParcialRenglon(nuevos[indice], datos);
    onChange(nuevos);
  };

  const cambiarItem = (indice: number, valor: string) => {
    if (!valor) {
      actualizar(indice, {
        tipo_item: "",
        item_id: "",
        medida_lineal_1: "",
        medida_lineal_2: "",
        desperdicio: 0,
      });
      return;
    }
    const [tipo, id] = valor.split(":");
    // El % de desperdicio vigente queda congelado en el renglón al seleccionar el artículo
    const articulo = tipo === "articulo" ? datos.articulos.find((a) => a.id === id) : undefined;
    actualizar(indice, {
      tipo_item: tipo as TipoItem,
      item_id: id,
      medida_lineal_1: "",
      medida_lineal_2: "",
      desperdicio: articulo ? desperdicioParaArticulo(articulo, datos.parametros) : 0,
    });
  };

  const quitar = (indice: number) => {
    onChange(renglones.filter((_, i) => i !== indice));
  };

  return (
    <div className="renglones">
      {renglones.map((renglon, i) => {
        const articulo =
          renglon.tipo_item === "articulo"
            ? datos.articulos.find((a) => a.id === renglon.item_id)
            : undefined;
        const esArea = articulo ? esTipoArea(articulo.tipo_medida) : false;
        const esLineal = articulo ? esTipoLineal(articulo.tipo_medida) : false;

        return (
          <div className="renglon" key={renglon.clave}>
            <div className="renglon-fila">
              <select
                value={renglon.item_id ? `${renglon.tipo_item}:${renglon.item_id}` : ""}
                onChange={(e) => cambiarItem(i, e.target.value)}
              >
                <option value="">Seleccione Artículo o Módulo</option>
                {datos.articulos.length > 0 && (
                  <optgroup label="Artículos">
                    {datos.articulos.map((a) => (
                      <option key={a.id} value={`articulo:${a.id}`}>
                        {a.nombre}
                      </option>
                    ))}
                  </optgroup>
                )}
                {modulosDisponibles.length > 0 && (
                  <optgroup label="Módulos">
                    {modulosDisponibles.map((m) => (
                      <option key={m.id} value={`modulo:${m.id}`}>
                        {m.nombre}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>

              <label className="campo-inline">
                Cantidad
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={renglon.cantidad}
                  onChange={(e) => actualizar(i, { cantidad: e.target.value })}
                />
              </label>

              <button
                type="button"
                className="btn-icono"
                title="Quitar renglón"
                onClick={() => quitar(i)}
              >
                ✕
              </button>
            </div>

            {esArea && articulo && (
              <div className="renglon-fila renglon-medidas">
                <label className="campo-inline">
                  Medida 1
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={renglon.medida_lineal_1}
                    onChange={(e) => actualizar(i, { medida_lineal_1: e.target.value })}
                  />
                </label>
                <span className="renglon-por">×</span>
                <label className="campo-inline">
                  Medida 2
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={renglon.medida_lineal_2}
                    onChange={(e) => actualizar(i, { medida_lineal_2: e.target.value })}
                  />
                </label>
                <label className="campo-inline">
                  Unidad
                  <select
                    value={renglon.unidad_lineal}
                    onChange={(e) =>
                      actualizar(i, { unidad_lineal: e.target.value as UnidadLineal })
                    }
                  >
                    <option value="m">m</option>
                    <option value="cm">cm</option>
                    <option value="mm">mm</option>
                  </select>
                </label>
                <span className="renglon-nota">Artículo en {articulo.tipo_medida}</span>
              </div>
            )}

            {esLineal && articulo && (
              <div className="renglon-fila renglon-medidas">
                <label className="campo-inline">
                  Medida
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={renglon.medida_lineal_1}
                    onChange={(e) => actualizar(i, { medida_lineal_1: e.target.value })}
                  />
                </label>
                <label className="campo-inline">
                  Unidad
                  <select
                    value={renglon.unidad_lineal}
                    onChange={(e) =>
                      actualizar(i, { unidad_lineal: e.target.value as UnidadLineal })
                    }
                  >
                    <option value="m">m</option>
                    <option value="cm">cm</option>
                    <option value="mm">mm</option>
                  </select>
                </label>
                <span className="renglon-nota">Artículo en {articulo.tipo_medida}</span>
              </div>
            )}

            <div className="renglon-fila renglon-parcial">
              {renglon.tipo_item === "modulo" && renglon.item_id && (
                <button
                  type="button"
                  className="btn btn-secundario btn-chico"
                  onClick={() => onVerDetalleModulo(renglon.item_id)}
                >
                  Detalle
                </button>
              )}
              {(esArea || esLineal) && (
                <span className="etiqueta-parcial">
                  Desperdicio: <strong>{renglon.desperdicio}%</strong>
                </span>
              )}
              <span className="etiqueta-parcial">
                Valor Parcial: <strong>{formatearCOP(renglon.valor_parcial)}</strong>
              </span>
            </div>
          </div>
        );
      })}

      <button
        type="button"
        className="btn btn-secundario"
        onClick={() => onChange([...renglones, nuevoRenglon()])}
      >
        + Agregar renglón
      </button>
    </div>
  );
}
