import Modal from "./Modal";
import { formatearCOP } from "../lib/formato";
import type { Datos } from "../types";

interface PropsNodo {
  moduloId: string;
  datos: Datos;
}

export function NodoModulo({ moduloId, datos }: PropsNodo) {
  const items = datos.moduloItems.filter((item) => item.modulo_id === moduloId);

  return (
    <ul className="arbol">
      {items.map((item) => {
        if (item.tipo_item === "articulo") {
          const articulo = datos.articulos.find((a) => a.id === item.item_id);
          if (!articulo) return null;
          return (
            <li key={item.id} className="arbol-articulo">
              <span className="arbol-nombre">{articulo.nombre}</span>
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
        }
        const submodulo = datos.modulos.find((m) => m.id === item.item_id);
        if (!submodulo) return null;
        return (
          <li key={item.id} className="arbol-modulo">
            <details open>
              <summary>
                <span className="arbol-nombre">{submodulo.nombre}</span>
                <span className="arbol-datos">
                  Cantidad: {item.cantidad} · <strong>{formatearCOP(item.valor_parcial)}</strong>
                </span>
              </summary>
              <NodoModulo moduloId={submodulo.id} datos={datos} />
            </details>
          </li>
        );
      })}
    </ul>
  );
}

interface Props {
  moduloId: string;
  datos: Datos;
  onCerrar: () => void;
}

export default function DetalleModulo({ moduloId, datos, onCerrar }: Props) {
  const modulo = datos.modulos.find((m) => m.id === moduloId);
  if (!modulo) return null;

  return (
    <Modal titulo={`Detalle del módulo "${modulo.nombre}"`} onCerrar={onCerrar} ancho={620}>
      <NodoModulo moduloId={moduloId} datos={datos} />
      <div className="total-final">
        Valor Final: <strong>{formatearCOP(modulo.valor_final)}</strong>
      </div>
      <div className="modal-acciones">
        <button className="btn btn-secundario" onClick={onCerrar}>
          Cerrar
        </button>
      </div>
    </Modal>
  );
}
