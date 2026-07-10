import { supabase } from "./supabase";
import { redondear } from "./calculos";
import { hoyISO } from "./formato";
import type {
  Articulo,
  Cotizacion,
  CotizacionItem,
  Datos,
  ItemCalculado,
  Modulo,
  ModuloItem,
  Parametros,
  TipoItem,
} from "../types";

function verificar<T>(resultado: { data: T | null; error: { message: string } | null }): T {
  if (resultado.error) throw new Error(resultado.error.message);
  return resultado.data as T;
}

const PARAMETROS_POR_DEFECTO: Parametros = {
  desperdicio_area: 0,
  desperdicio_lineal: 0,
  utilidad: 0,
};

export async function cargarDatos(): Promise<Datos> {
  const [articulos, modulos, moduloItems, cotizaciones, cotizacionItems, parametros] =
    await Promise.all([
      supabase.from("articulos").select("*").order("nombre"),
      supabase.from("modulos").select("*").order("nombre"),
      supabase.from("modulo_items").select("*"),
      supabase.from("cotizaciones").select("*").order("fecha_actualizacion", { ascending: true }).order("id", { ascending: true }),
      supabase.from("cotizacion_items").select("*"),
      supabase.from("parametros").select("*").maybeSingle(),
    ]);
  return {
    articulos: verificar<Articulo[]>(articulos),
    modulos: verificar<Modulo[]>(modulos),
    moduloItems: verificar<ModuloItem[]>(moduloItems),
    cotizaciones: verificar<Cotizacion[]>(cotizaciones),
    cotizacionItems: verificar<CotizacionItem[]>(cotizacionItems),
    parametros: verificar<Parametros | null>(parametros) ?? PARAMETROS_POR_DEFECTO,
  };
}

// ---------- Parámetros ----------

export async function guardarParametros(userId: string, campos: Partial<Parametros>): Promise<void> {
  verificar(
    await supabase
      .from("parametros")
      .upsert({ user_id: userId, ...campos, updated_at: new Date().toISOString() })
  );
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

/**
 * Elimina un renglón (artículo o módulo anidado) de un módulo existente y
 * actualiza inmediatamente el Valor Final con la suma de los renglones restantes.
 */
export async function eliminarModuloItem(
  itemId: string,
  moduloId: string,
  datos: Datos
): Promise<void> {
  verificar(await supabase.from("modulo_items").delete().eq("id", itemId));
  const restantes = datos.moduloItems.filter(
    (item) => item.modulo_id === moduloId && item.id !== itemId
  );
  const total = redondear(restantes.reduce((acc, item) => acc + item.valor_parcial, 0));
  verificar(await supabase.from("modulos").update({ valor_final: total }).eq("id", moduloId));
}

/**
 * Guarda los cambios pendientes de un módulo en edición: los renglones
 * recalculados en memoria, los renglones nuevos y el Valor Final resultante.
 * Solo se ejecuta al confirmar con el botón "Guardar".
 */
export async function guardarCambiosModulo(
  moduloId: string,
  cambios: { id: string; valor_parcial: number; desperdicio: number }[],
  nuevosItems: ItemCalculado[],
  valorFinal: number
): Promise<void> {
  await Promise.all(
    cambios.map((cambio) =>
      supabase
        .from("modulo_items")
        .update({ valor_parcial: cambio.valor_parcial, desperdicio: cambio.desperdicio })
        .eq("id", cambio.id)
        .then(verificar)
    )
  );
  if (nuevosItems.length > 0) {
    verificar(
      await supabase
        .from("modulo_items")
        .insert(nuevosItems.map((item) => ({ modulo_id: moduloId, ...item })))
    );
  }
  verificar(
    await supabase.from("modulos").update({ valor_final: valorFinal }).eq("id", moduloId)
  );
}

// ---------- Cotizaciones ----------

export async function proximoIdCotizacion(): Promise<number | null> {
  const { data, error } = await supabase.rpc("proximo_id_cotizacion");
  if (error) return null;
  return data as number;
}

export interface CamposCotizacion {
  nombre_cliente: string;
  numero_documento: string;
  direccion: string;
  telefono: string;
  ciudad: string;
  version: string;
}

export async function crearCotizacion(
  userId: string,
  campos: CamposCotizacion,
  valorFinal: number,
  utilidad: number,
  items: ItemCalculado[]
): Promise<void> {
  const cotizacion = verificar<Cotizacion>(
    await supabase
      .from("cotizaciones")
      .insert({ user_id: userId, ...campos, valor_final: valorFinal, utilidad })
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
  campos: CamposCotizacion,
  valorFinal: number,
  utilidad: number,
  items: ItemCalculado[]
): Promise<void> {
  verificar(
    await supabase
      .from("cotizaciones")
      .update({ ...campos, valor_final: valorFinal, utilidad, fecha_actualizacion: hoyISO() })
      .eq("id", id)
  );
  verificar(await supabase.from("cotizacion_items").delete().eq("cotizacion_id", id));
  verificar(
    await supabase
      .from("cotizacion_items")
      .insert(items.map((item) => ({ cotizacion_id: id, ...item })))
  );
}

/** Marca la cotización como congelada; desde entonces ya no se puede editar. */
export async function congelarCotizacion(id: number): Promise<void> {
  verificar(await supabase.from("cotizaciones").update({ congelada: true }).eq("id", id));
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
