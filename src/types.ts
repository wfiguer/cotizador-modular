export type TipoItem = "articulo" | "modulo";
export type UnidadLineal = "m" | "cm" | "mm";

export interface Articulo {
  id: string;
  user_id: string;
  nombre: string;
  cantidad: number;
  tipo_medida: string;
  cantidad_x_medida: number;
  valor: number;
  created_at: string;
  updated_at: string;
}

export interface Modulo {
  id: string;
  user_id: string;
  nombre: string;
  valor_final: number;
  created_at: string;
}

export interface ModuloItem {
  id: string;
  modulo_id: string;
  tipo_item: TipoItem;
  item_id: string;
  cantidad: number;
  medida_lineal_1: number | null;
  medida_lineal_2: number | null;
  unidad_lineal: UnidadLineal | null;
  valor_parcial: number;
}

export interface Cotizacion {
  id: number;
  user_id: string;
  fecha_creacion: string;
  fecha_actualizacion: string;
  nombre_cliente: string;
  valor_final: number;
  created_at: string;
}

export interface CotizacionItem {
  id: string;
  cotizacion_id: number;
  tipo_item: TipoItem;
  item_id: string;
  cantidad: number;
  medida_lineal_1: number | null;
  medida_lineal_2: number | null;
  unidad_lineal: UnidadLineal | null;
  valor_parcial: number;
}

/** Todos los datos del usuario cargados en memoria. */
export interface Datos {
  articulos: Articulo[];
  modulos: Modulo[];
  moduloItems: ModuloItem[];
  cotizaciones: Cotizacion[];
  cotizacionItems: CotizacionItem[];
}

/** Renglón en edición dentro de los modales de Módulos y Cotizaciones. */
export interface RenglonForm {
  clave: string;
  tipo_item: TipoItem | "";
  item_id: string;
  cantidad: string;
  medida_lineal_1: string;
  medida_lineal_2: string;
  unidad_lineal: UnidadLineal;
  valor_parcial: number;
}

/** Renglón ya validado y calculado, listo para insertar en la base de datos. */
export interface ItemCalculado {
  tipo_item: TipoItem;
  item_id: string;
  cantidad: number;
  medida_lineal_1: number | null;
  medida_lineal_2: number | null;
  unidad_lineal: UnidadLineal | null;
  valor_parcial: number;
}
