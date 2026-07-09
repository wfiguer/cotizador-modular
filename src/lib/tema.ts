/** Tema visual de la aplicación. Se persiste en localStorage por navegador. */
export type Tema = "claro" | "oscuro";

const CLAVE_TEMA = "cotizador-tema";

/** Tema guardado por el usuario o, si no eligió uno, el preferido por el sistema. */
export function temaInicial(): Tema {
  const guardado = localStorage.getItem(CLAVE_TEMA);
  if (guardado === "claro" || guardado === "oscuro") return guardado;
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "claro" : "oscuro";
}

/** Aplica el tema al documento (data-tema en <html>) y lo persiste. */
export function aplicarTema(tema: Tema): void {
  document.documentElement.dataset.tema = tema;
  localStorage.setItem(CLAVE_TEMA, tema);
}
