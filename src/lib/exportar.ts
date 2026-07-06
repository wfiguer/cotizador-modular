import { formatearFecha } from "./formato";
import type { Cotizacion, CotizacionItem, Datos, UnidadLineal } from "../types";

const FORMATO_COP = '"$"#,##0';

interface ConMedidas {
  medida_lineal_1: number | null;
  medida_lineal_2: number | null;
  unidad_lineal: UnidadLineal | null;
}

function medidasTexto(item: ConMedidas): string {
  if (item.medida_lineal_1 != null && item.medida_lineal_2 != null) {
    return `${item.medida_lineal_1} × ${item.medida_lineal_2} ${item.unidad_lineal}`;
  }
  if (item.medida_lineal_1 != null) {
    return `${item.medida_lineal_1} ${item.unidad_lineal}`;
  }
  return "";
}

const sangria = (nivel: number): string => "    ".repeat(nivel);

/**
 * Agrega las filas de la composición interna de un módulo, expandiendo
 * recursivamente los submódulos en cualquier nivel de profundidad.
 */
function agregarDetalleModulo(
  moduloId: string,
  nivel: number,
  filas: (string | number)[][],
  datos: Datos
): void {
  const items = datos.moduloItems.filter((item) => item.modulo_id === moduloId);
  for (const item of items) {
    if (item.tipo_item === "articulo") {
      const articulo = datos.articulos.find((a) => a.id === item.item_id);
      filas.push([
        sangria(nivel) + (articulo?.nombre ?? "(eliminado)"),
        "Artículo",
        item.cantidad,
        medidasTexto(item),
        item.desperdicio > 0 ? `${item.desperdicio}%` : "",
        item.valor_parcial,
      ]);
    } else {
      const submodulo = datos.modulos.find((m) => m.id === item.item_id);
      filas.push([
        sangria(nivel) + (submodulo?.nombre ?? "(eliminado)"),
        "Módulo",
        item.cantidad,
        "",
        "",
        item.valor_parcial,
      ]);
      if (submodulo) agregarDetalleModulo(submodulo.id, nivel + 1, filas, datos);
    }
  }
}

/** Genera y descarga un archivo .xlsx con el detalle de la cotización. */
export async function exportarCotizacion(cotizacion: Cotizacion, datos: Datos): Promise<void> {
  // Import dinámico: la librería solo se descarga al exportar por primera vez
  const XLSX = await import("xlsx");
  const items = datos.cotizacionItems.filter((item) => item.cotizacion_id === cotizacion.id);

  const nombreDeItem = (item: CotizacionItem): string => {
    if (item.tipo_item === "articulo") {
      return datos.articulos.find((a) => a.id === item.item_id)?.nombre ?? "(eliminado)";
    }
    return datos.modulos.find((m) => m.id === item.item_id)?.nombre ?? "(eliminado)";
  };

  const filas: (string | number)[][] = [
    ["Cotización N°", cotizacion.id],
    ["Nombre Cliente", cotizacion.nombre_cliente],
    ["N° Documento", cotizacion.numero_documento],
    ["Dirección", cotizacion.direccion],
    ["Teléfono", cotizacion.telefono],
    ["Ciudad", cotizacion.ciudad],
    ["Versión de Cotización", cotizacion.version],
    ["Fecha Creación", formatearFecha(cotizacion.fecha_creacion)],
    ["Fecha Actualización", formatearFecha(cotizacion.fecha_actualizacion)],
    [],
    ["Ítem", "Tipo", "Cantidad", "Medidas", "Desperdicio", "Valor Parcial"],
  ];

  // Renglones de la cotización; los módulos se expanden con toda su
  // composición interna (submódulos y artículos en cualquier nivel)
  for (const item of items) {
    filas.push([
      nombreDeItem(item),
      item.tipo_item === "articulo" ? "Artículo" : "Módulo",
      item.cantidad,
      medidasTexto(item),
      item.desperdicio > 0 ? `${item.desperdicio}%` : "",
      item.valor_parcial,
    ]);
    if (item.tipo_item === "modulo") {
      agregarDetalleModulo(item.item_id, 1, filas, datos);
    }
  }

  filas.push([], ["", "", "", "", "Valor Final", cotizacion.valor_final]);

  const hoja = XLSX.utils.aoa_to_sheet(filas);
  hoja["!cols"] = [
    { wch: 34 },
    { wch: 12 },
    { wch: 10 },
    { wch: 16 },
    { wch: 12 },
    { wch: 14 },
  ];

  // Formato de moneda COP en la columna "Valor Parcial" y en el "Valor Final"
  for (let fila = 0; fila < filas.length; fila++) {
    const celda = hoja[XLSX.utils.encode_cell({ r: fila, c: 5 })];
    if (celda && celda.t === "n") celda.z = FORMATO_COP;
  }

  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, hoja, `Cotización ${cotizacion.id}`);
  XLSX.writeFile(libro, `cotizacion-${cotizacion.id}.xlsx`);
}
