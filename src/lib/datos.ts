import { supabase } from "./supabase";
import { calcularValoresDeModulos } from "./calculos";
import { hoyISO } from "./formato";
import type {
  Articulo,
  Cotizacion,
  CotizacionItem,
  Datos,
  ItemCalculado,
  Modulo,
  ModuloItem,
  TipoItem,
} from "../types";

function verificar<T>(resultado: { data: T | null; error: { message: string } | null }): T {
  if (resultado.error) throw new Error(resultado.error.message);
  return resultado.data as T;
}

export async function cargarDatos(): Promise<Datos> {
  const [articulos, modulos, moduloItems, cotizaciones, cotizacionItems] = await Promise.all([
    supabase.from("articulos").select("*").order("nombre"),
    supabase.from("modulos").select("*").order("nombre"),
    supabase.from("modulo_items").select("*"),
    supabase.from("cotizaciones").select("*").order("fecha_actualizacion", { ascending: true }).order("id", { ascending: true }),
    supabase.from("cotizacion_items").select("*"),
  ]);
  return {
    articulos: verificar<Articulo[]>(articulos),
    modulos: verificar<Modulo[]>(modulos),
    moduloItems: verificar<ModuloItem[]>(moduloItems),
    cotizaciones: verificar<Cotizacion[]>(cotizaciones),
    cotizacionItems: verificar<CotizacionItem[]>(cotizacionItems),
  };
}

/**
 * Recalcula en cascada el valor de los módulos a partir del valor actual de
 * los artículos y persiste solo las filas que cambiaron.
 * Devuelve true si hubo cambios (para volver a cargar los datos).
 */
export async function sincronizarModulos(datos: Datos): Promise<boolean> {
  const { valores, parciales } = calcularValoresDeModulos(datos);

  const itemsCambiados = datos.moduloItems.filter(
    (item) => parciales.get(item.id) !== undefined && parciales.get(item.id) !== item.valor_parcial
  );
  const modulosCambiados = datos.modulos.filter(
    (modulo) => valores.get(modulo.id) !== undefined && valores.get(modulo.id) !== modulo.valor_final
  );
  if (itemsCambiados.length === 0 && modulosCambiados.length === 0) return false;

  await Promise.all([
    ...itemsCambiados.map((item) =>
      supabase
        .from("modulo_items")
        .update({ valor_parcial: parciales.get(item.id) })
        .eq("id", item.id)
        .then(verificar)
    ),
    ...modulosCambiados.map((modulo) =>
      supabase
        .from("modulos")
        .update({ valor_final: valores.get(modulo.id) })
        .eq("id", modulo.id)
        .then(verificar)
    ),
  ]);
  return true;
}

// ---------- Artículos ----------

export interface CamposArticulo {
  nombre: string;
  cantidad: number;
  tipo_medida: string;
  cantidad_x_medida: number;
  valor: number;
}

export async function crearArticulo(userId: string, campos: CamposArticulo): Promise<void> {
  verificar(await supabase.from("articulos").insert({ user_id: userId, ...campos }));
}

export async function actualizarArticulo(id: string, campos: CamposArticulo): Promise<void> {
  verificar(await supabase.from("articulos").update(campos).eq("id", id));
}

export async function eliminarArticulo(id: string): Promise<void> {
  verificar(await supabase.from("articulos").delete().eq("id", id));
}

// ---------- Módulos ----------

export async function crearModulo(
  userId: string,
  nombre: string,
  valorFinal: number,
  items: ItemCalculado[]
): Promise<void> {
  const modulo = verificar<Modulo>(
    await supabase
      .from("modulos")
      .insert({ user_id: userId, nombre, valor_final: valorFinal })
      .select()
      .single()
  );
  const { error } = await supabase
    .from("modulo_items")
    .insert(items.map((item) => ({ modulo_id: modulo.id, ...item })));
  if (error) {
    // Evitar dejar un módulo vacío si fallan los renglones
    await supabase.from("modulos").delete().eq("id", modulo.id);
    throw new Error(error.message);
  }
}

export async function eliminarModulo(id: string): Promise<void> {
  verificar(await supabase.from("modulos").delete().eq("id", id));
}

// ---------- Cotizaciones ----------

export async function proximoIdCotizacion(): Promise<number | null> {
  const { data, error } = await supabase.rpc("proximo_id_cotizacion");
  if (error) return null;
  return data as number;
}

export async function crearCotizacion(
  userId: string,
  nombreCliente: string,
  valorFinal: number,
  items: ItemCalculado[]
): Promise<void> {
  const cotizacion = verificar<Cotizacion>(
    await supabase
      .from("cotizaciones")
      .insert({ user_id: userId, nombre_cliente: nombreCliente, valor_final: valorFinal })
      .select()
      .single()
  );
  const { error } = await supabase
    .from("cotizacion_items")
    .insert(items.map((item) => ({ cotizacion_id: cotizacion.id, ...item })));
  if (error) {
    await supabase.from("cotizaciones").delete().eq("id", cotizacion.id);
    throw new Error(error.message);
  }
}

export async function actualizarCotizacion(
  id: number,
  nombreCliente: string,
  valorFinal: number,
  items: ItemCalculado[]
): Promise<void> {
  verificar(
    await supabase
      .from("cotizaciones")
      .update({ nombre_cliente: nombreCliente, valor_final: valorFinal, fecha_actualizacion: hoyISO() })
      .eq("id", id)
  );
  verificar(await supabase.from("cotizacion_items").delete().eq("cotizacion_id", id));
  verificar(
    await supabase
      .from("cotizacion_items")
      .insert(items.map((item) => ({ cotizacion_id: id, ...item })))
  );
}

export async function eliminarCotizacion(id: number): Promise<void> {
  verificar(await supabase.from("cotizaciones").delete().eq("id", id));
}

// ---------- Usos (bloqueo de eliminación) ----------

/** Lista de módulos y cotizaciones que usan el ítem, para el mensaje de bloqueo. */
export function usosDeItem(tipo: TipoItem, id: string, datos: Datos): string[] {
  const usos: string[] = [];
  for (const modulo of datos.modulos) {
    const usado = datos.moduloItems.some(
      (item) => item.modulo_id === modulo.id && item.tipo_item === tipo && item.item_id === id
    );
    if (usado) usos.push(`Módulo "${modulo.nombre}"`);
  }
  for (const cotizacion of datos.cotizaciones) {
    const usado = datos.cotizacionItems.some(
      (item) => item.cotizacion_id === cotizacion.id && item.tipo_item === tipo && item.item_id === id
    );
    if (usado) usos.push(`Cotización #${cotizacion.id} (${cotizacion.nombre_cliente})`);
  }
  return usos;
}
