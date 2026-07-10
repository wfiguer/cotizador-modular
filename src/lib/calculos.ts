import type {
  Articulo,
  Datos,
  ItemCalculado,
  ModuloItem,
  Parametros,
  RenglonForm,
  UnidadLineal,
} from "../types";

export const TIPOS_AREA = ["m2", "cm2", "mm2"];
export const TIPOS_LINEALES = ["m", "cm", "mm"];

export const esTipoArea = (tipoMedida: string): boolean =>
  TIPOS_AREA.includes(tipoMedida.trim().toLowerCase());

export const esTipoLineal = (tipoMedida: string): boolean =>
  TIPOS_LINEALES.includes(tipoMedida.trim().toLowerCase());

/** Redondeo normal (no truncado) a 0 decimales. */
export const redondear = (n: number): number => Math.round(n);

const METROS_POR_UNIDAD: Record<UnidadLineal, number> = { m: 1, cm: 0.01, mm: 0.001 };
const UNIDAD_LINEAL_DEL_AREA: Record<string, UnidadLineal> = { m2: "m", cm2: "cm", mm2: "mm" };

export function precioUnitarioBase(articulo: Articulo): number {
  return articulo.cantidad > 0 ? articulo.valor / articulo.cantidad : 0;
}

/** Porcentaje de desperdicio que corresponde al artículo según su tipo de medida. */
export function desperdicioParaArticulo(articulo: Articulo, parametros: Parametros): number {
  if (esTipoArea(articulo.tipo_medida)) return parametros.desperdicio_area;
  if (esTipoLineal(articulo.tipo_medida)) return parametros.desperdicio_lineal;
  return 0;
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

/** Longitud de una medida lineal, convertida a la unidad del artículo (m, cm o mm). */
export function longitudEnUnidadDelArticulo(
  medida: number,
  unidad: UnidadLineal,
  tipoMedidaLineal: string
): number {
  const base = tipoMedidaLineal.trim().toLowerCase() as UnidadLineal;
  return medida * (METROS_POR_UNIDAD[unidad] / METROS_POR_UNIDAD[base]);
}

/**
 * Valor parcial de un renglón que referencia un artículo.
 * - Tipo común (und u otro): cantidad × precio unitario base. Sin desperdicio.
 * - Tipo área (m2/cm2/mm2): cantidad × (área / cantidad_x_medida) × precio unitario base.
 * - Tipo lineal (m/cm/mm): cantidad × (longitud / cantidad_x_medida) × precio unitario base.
 * Para área y lineal se suma el desperdicio: el costo base se redondea primero
 * y el incremento se redondea aparte (ej: $26.667 + 25% = $26.667 + $6.667 = $33.334).
 */
export function valorParcialDeArticulo(
  articulo: Articulo,
  cantidad: number,
  medida1?: number | null,
  medida2?: number | null,
  unidad?: UnidadLineal | null,
  desperdicioPct = 0
): number {
  const precioBase = precioUnitarioBase(articulo);

  let costoBase: number;
  if (esTipoArea(articulo.tipo_medida)) {
    if (!medida1 || !medida2 || !unidad || articulo.cantidad_x_medida <= 0) return 0;
    const area = areaEnUnidadDelArticulo(medida1, medida2, unidad, articulo.tipo_medida);
    costoBase = redondear(cantidad * (area / articulo.cantidad_x_medida) * precioBase);
  } else if (esTipoLineal(articulo.tipo_medida)) {
    if (!medida1 || !unidad || articulo.cantidad_x_medida <= 0) return 0;
    const longitud = longitudEnUnidadDelArticulo(medida1, unidad, articulo.tipo_medida);
    costoBase = redondear(cantidad * (longitud / articulo.cantidad_x_medida) * precioBase);
  } else {
    return redondear(cantidad * precioBase);
  }

  const incremento = redondear(costoBase * (desperdicioPct / 100));
  return costoBase + incremento;
}

/** Valor parcial de un renglón del formulario, usando el % de desperdicio congelado en el renglón. */
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
    renglon.unidad_lineal,
    renglon.desperdicio
  );
}

/**
 * Actualiza en el renglón el % de desperdicio vigente y recalcula su valor
 * parcial (se usa al presionar "Recalcular").
 */
export function recalcularRenglon(renglon: RenglonForm, datos: Datos): RenglonForm {
  let desperdicio = 0;
  if (renglon.tipo_item === "articulo") {
    const articulo = datos.articulos.find((a) => a.id === renglon.item_id);
    if (articulo) desperdicio = desperdicioParaArticulo(articulo, datos.parametros);
  }
  const actualizado = { ...renglon, desperdicio };
  return { ...actualizado, valor_parcial: calcularParcialRenglon(actualizado, datos) };
}

/**
 * Desperdicio y valor parcial que daría "Recalcular" hoy para un renglón
 * guardado (de un módulo o de una cotización): relee el valor de los
 * artículos, el % de desperdicio vigente (Parámetros) y el valor final
 * guardado de los módulos referenciados. Si el artículo o módulo del renglón
 * ya no existe, devuelve los valores guardados sin cambios.
 */
function valoresRecalculados(
  item: ItemCalculado,
  datos: Datos
): { desperdicio: number; valor_parcial: number } {
  if (item.tipo_item === "articulo") {
    const articulo = datos.articulos.find((a) => a.id === item.item_id);
    if (!articulo) return { desperdicio: item.desperdicio, valor_parcial: item.valor_parcial };
    const desperdicio = desperdicioParaArticulo(articulo, datos.parametros);
    return {
      desperdicio,
      valor_parcial: valorParcialDeArticulo(
        articulo,
        item.cantidad,
        item.medida_lineal_1,
        item.medida_lineal_2,
        item.unidad_lineal,
        desperdicio
      ),
    };
  }
  const submodulo = datos.modulos.find((m) => m.id === item.item_id);
  return {
    desperdicio: item.desperdicio,
    valor_parcial: submodulo
      ? redondear(item.cantidad * submodulo.valor_final)
      : item.valor_parcial,
  };
}

/**
 * Recalcula un renglón de un módulo con los valores actuales. No toca la base
 * de datos; los cambios se persisten al confirmar con "Guardar".
 */
export function recalcularItemModulo(item: ModuloItem, datos: Datos): ModuloItem {
  return { ...item, ...valoresRecalculados(item, datos) };
}

/**
 * ¿El renglón guardado (de un módulo o de una cotización) daría un valor
 * parcial o desperdicio distinto si se recalculara hoy?
 */
export function itemDesactualizado(item: ItemCalculado, datos: Datos): boolean {
  const actual = valoresRecalculados(item, datos);
  return actual.valor_parcial !== item.valor_parcial || actual.desperdicio !== item.desperdicio;
}

/**
 * Ids de los módulos desactualizados con respecto a Parámetros: tienen algún
 * renglón que cambiaría al presionar "Recalcular", o referencian (a cualquier
 * profundidad) un submódulo desactualizado. La actualización debe hacerse de
 * abajo hacia arriba: al guardar un submódulo, el padre queda desactualizado
 * hasta que también se recalcule y guarde.
 */
export function modulosDesactualizados(datos: Datos): Set<string> {
  const memo = new Map<string, boolean>();

  const evaluar = (moduloId: string, enProceso: Set<string>): boolean => {
    const conocido = memo.get(moduloId);
    if (conocido !== undefined) return conocido;
    if (enProceso.has(moduloId)) return false; // guarda contra ciclos
    enProceso.add(moduloId);

    const items = datos.moduloItems.filter((item) => item.modulo_id === moduloId);
    const desactualizado = items.some(
      (item) =>
        itemDesactualizado(item, datos) ||
        (item.tipo_item === "modulo" && evaluar(item.item_id, enProceso))
    );

    enProceso.delete(moduloId);
    memo.set(moduloId, desactualizado);
    return desactualizado;
  };

  const resultado = new Set<string>();
  for (const modulo of datos.modulos) {
    if (evaluar(modulo.id, new Set())) resultado.add(modulo.id);
  }
  return resultado;
}

/**
 * Ids de las cotizaciones desactualizadas con respecto a Parámetros: tienen
 * algún renglón que cambiaría al presionar "Recalcular", referencian un módulo
 * desactualizado (a cualquier profundidad), o su % de utilidad difiere del
 * vigente. Las cotizaciones congeladas se ignoran (son snapshots inmutables).
 */
export function cotizacionesDesactualizadas(
  datos: Datos,
  modulosPendientes: Set<string> = modulosDesactualizados(datos)
): Set<number> {
  const resultado = new Set<number>();
  for (const cotizacion of datos.cotizaciones) {
    if (cotizacion.congelada) continue;
    const items = datos.cotizacionItems.filter((item) => item.cotizacion_id === cotizacion.id);
    const desactualizada =
      cotizacion.utilidad !== datos.parametros.utilidad ||
      items.some(
        (item) =>
          itemDesactualizado(item, datos) ||
          (item.tipo_item === "modulo" && modulosPendientes.has(item.item_id))
      );
    if (desactualizada) resultado.add(cotizacion.id);
  }
  return resultado;
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
      if (articulo && esTipoLineal(articulo.tipo_medida)) {
        const m1 = Number(r.medida_lineal_1);
        if (!r.medida_lineal_1 || Number.isNaN(m1) || m1 <= 0) {
          return `Renglón ${n}: ingrese la medida lineal (mayor que cero).`;
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
    const esLineal = articulo ? esTipoLineal(articulo.tipo_medida) : false;
    return {
      tipo_item: r.tipo_item as ItemCalculado["tipo_item"],
      item_id: r.item_id,
      cantidad: Number(r.cantidad),
      medida_lineal_1: esArea || esLineal ? Number(r.medida_lineal_1) : null,
      medida_lineal_2: esArea ? Number(r.medida_lineal_2) : null,
      unidad_lineal: esArea || esLineal ? r.unidad_lineal : null,
      desperdicio: esArea || esLineal ? r.desperdicio : 0,
      valor_parcial: r.valor_parcial,
    };
  });
}

/** Suma de valores parciales (Valor Final de un módulo o cotización). */
export function sumarParciales(renglones: { valor_parcial: number }[]): number {
  return redondear(renglones.reduce((acc, r) => acc + r.valor_parcial, 0));
}

/**
 * Valor Final Con Utilidad: el Valor Final más el % de utilidad aplicado
 * sobre él (mismo esquema de redondeo que el desperdicio: el incremento
 * se redondea aparte y se suma al valor base).
 */
export function valorFinalConUtilidad(valorFinal: number, utilidadPct: number): number {
  return valorFinal + redondear(valorFinal * (utilidadPct / 100));
}
