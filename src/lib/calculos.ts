import type {
  Articulo,
  Datos,
  ItemCalculado,
  ModuloItem,
  RenglonForm,
  UnidadLineal,
} from "../types";

export const TIPOS_AREA = ["m2", "cm2", "mm2"];

export const esTipoArea = (tipoMedida: string): boolean =>
  TIPOS_AREA.includes(tipoMedida.trim().toLowerCase());

/** Redondeo normal (no truncado) a 0 decimales. */
export const redondear = (n: number): number => Math.round(n);

const METROS_POR_UNIDAD: Record<UnidadLineal, number> = { m: 1, cm: 0.01, mm: 0.001 };
const UNIDAD_LINEAL_DEL_AREA: Record<string, UnidadLineal> = { m2: "m", cm2: "cm", mm2: "mm" };

export function precioUnitarioBase(articulo: Articulo): number {
  return articulo.cantidad > 0 ? articulo.valor / articulo.cantidad : 0;
}

/** Área de dos medidas lineales, convertida a la unidad de área del artículo (m2, cm2 o mm2). */
export function areaEnUnidadDelArticulo(
  medida1: number,
  medida2: number,
  unidad: UnidadLineal,
  tipoMedidaArea: string
): number {
  const base = UNIDAD_LINEAL_DEL_AREA[tipoMedidaArea.trim().toLowerCase()];
  const factor = METROS_POR_UNIDAD[unidad] / METROS_POR_UNIDAD[base];
  return medida1 * factor * (medida2 * factor);
}

/**
 * Valor parcial de un renglón que referencia un artículo.
 * - Tipo no-área: cantidad × precio unitario base.
 * - Tipo área: cantidad × (área calculada / cantidad_x_medida) × precio unitario base.
 */
export function valorParcialDeArticulo(
  articulo: Articulo,
  cantidad: number,
  medida1?: number | null,
  medida2?: number | null,
  unidad?: UnidadLineal | null
): number {
  const precioBase = precioUnitarioBase(articulo);
  if (esTipoArea(articulo.tipo_medida)) {
    if (!medida1 || !medida2 || !unidad || articulo.cantidad_x_medida <= 0) return 0;
    const area = areaEnUnidadDelArticulo(medida1, medida2, unidad, articulo.tipo_medida);
    return redondear(cantidad * (area / articulo.cantidad_x_medida) * precioBase);
  }
  return redondear(cantidad * precioBase);
}

/**
 * Recalcula el valor de todos los módulos a partir del valor actual de los
 * artículos, propagando en cascada a través de módulos anidados.
 * Devuelve el valor final por módulo y el valor parcial por renglón.
 */
export function calcularValoresDeModulos(datos: Datos): {
  valores: Map<string, number>;
  parciales: Map<string, number>;
} {
  const itemsPorModulo = new Map<string, ModuloItem[]>();
  for (const item of datos.moduloItems) {
    const lista = itemsPorModulo.get(item.modulo_id);
    if (lista) lista.push(item);
    else itemsPorModulo.set(item.modulo_id, [item]);
  }
  const articulosPorId = new Map(datos.articulos.map((a) => [a.id, a]));

  const valores = new Map<string, number>();
  const parciales = new Map<string, number>();
  const visitando = new Set<string>();

  const valorDe = (moduloId: string): number => {
    const memo = valores.get(moduloId);
    if (memo !== undefined) return memo;
    if (visitando.has(moduloId)) return 0; // ciclo: lo impide el trigger de la BD
    visitando.add(moduloId);
    let total = 0;
    for (const item of itemsPorModulo.get(moduloId) ?? []) {
      let parcial = 0;
      if (item.tipo_item === "articulo") {
        const articulo = articulosPorId.get(item.item_id);
        if (articulo) {
          parcial = valorParcialDeArticulo(
            articulo,
            item.cantidad,
            item.medida_lineal_1,
            item.medida_lineal_2,
            item.unidad_lineal
          );
        }
      } else {
        parcial = redondear(item.cantidad * valorDe(item.item_id));
      }
      parciales.set(item.id, parcial);
      total += parcial;
    }
    visitando.delete(moduloId);
    const redondeado = redondear(total);
    valores.set(moduloId, redondeado);
    return redondeado;
  };

  for (const modulo of datos.modulos) valorDe(modulo.id);
  return { valores, parciales };
}

/** Valor parcial de un renglón del formulario, con los valores actuales de datos. */
export function calcularParcialRenglon(renglon: RenglonForm, datos: Datos): number {
  if (!renglon.item_id || !renglon.tipo_item) return 0;
  const cantidad = Number(renglon.cantidad);
  if (!renglon.cantidad || Number.isNaN(cantidad)) return 0;

  if (renglon.tipo_item === "modulo") {
    const modulo = datos.modulos.find((m) => m.id === renglon.item_id);
    return modulo ? redondear(cantidad * modulo.valor_final) : 0;
  }

  const articulo = datos.articulos.find((a) => a.id === renglon.item_id);
  if (!articulo) return 0;
  return valorParcialDeArticulo(
    articulo,
    cantidad,
    Number(renglon.medida_lineal_1) || null,
    Number(renglon.medida_lineal_2) || null,
    renglon.unidad_lineal
  );
}

/** Valida los renglones del formulario. Devuelve un mensaje de error o null si todo está bien. */
export function validarRenglones(renglones: RenglonForm[], datos: Datos): string | null {
  if (renglones.length === 0) return "Debe agregar al menos un renglón.";
  for (let i = 0; i < renglones.length; i++) {
    const r = renglones[i];
    const n = i + 1;
    if (!r.item_id) return `Renglón ${n}: seleccione un artículo o módulo.`;
    const cantidad = Number(r.cantidad);
    if (!r.cantidad || Number.isNaN(cantidad) || cantidad <= 0) {
      return `Renglón ${n}: la cantidad debe ser un número mayor que cero.`;
    }
    if (r.tipo_item === "articulo") {
      const articulo = datos.articulos.find((a) => a.id === r.item_id);
      if (articulo && esTipoArea(articulo.tipo_medida)) {
        const m1 = Number(r.medida_lineal_1);
        const m2 = Number(r.medida_lineal_2);
        if (!r.medida_lineal_1 || !r.medida_lineal_2 || Number.isNaN(m1) || Number.isNaN(m2) || m1 <= 0 || m2 <= 0) {
          return `Renglón ${n}: ingrese las dos medidas lineales (mayores que cero).`;
        }
      }
    }
  }
  return null;
}

/** Convierte los renglones válidos del formulario en filas listas para insertar. */
export function renglonesAItems(renglones: RenglonForm[], datos: Datos): ItemCalculado[] {
  return renglones.map((r) => {
    const articulo =
      r.tipo_item === "articulo" ? datos.articulos.find((a) => a.id === r.item_id) : undefined;
    const esArea = articulo ? esTipoArea(articulo.tipo_medida) : false;
    return {
      tipo_item: r.tipo_item as ItemCalculado["tipo_item"],
      item_id: r.item_id,
      cantidad: Number(r.cantidad),
      medida_lineal_1: esArea ? Number(r.medida_lineal_1) : null,
      medida_lineal_2: esArea ? Number(r.medida_lineal_2) : null,
      unidad_lineal: esArea ? r.unidad_lineal : null,
      valor_parcial: calcularParcialRenglon(r, datos),
    };
  });
}

/** Suma de valores parciales (Valor Final de un módulo o cotización). */
export function sumarParciales(renglones: { valor_parcial: number }[]): number {
  return redondear(renglones.reduce((acc, r) => acc + r.valor_parcial, 0));
}
