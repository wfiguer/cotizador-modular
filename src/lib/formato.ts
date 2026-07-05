/** Peso colombiano, sin decimales, separador de miles con punto: $26.667 */
export function formatearCOP(valor: number): string {
  const entero = Math.round(valor);
  const signo = entero < 0 ? "-" : "";
  return `${signo}$${Math.abs(entero).toLocaleString("es-CO", { maximumFractionDigits: 0 })}`;
}

/** "YYYY-MM-DD" (o timestamp ISO) → "dd-mm-YYYY" */
export function formatearFecha(fechaISO: string): string {
  const [anio, mes, dia] = fechaISO.slice(0, 10).split("-");
  return `${dia}-${mes}-${anio}`;
}

/** Fecha local de hoy en formato "YYYY-MM-DD". */
export function hoyISO(): string {
  const d = new Date();
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mes}-${dia}`;
}
