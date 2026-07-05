import { useCallback, useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase, supabaseConfigurado } from "./lib/supabase";
import { cargarDatos, sincronizarModulos } from "./lib/datos";
import AuthScreen from "./components/AuthScreen";
import ArticulosTab from "./tabs/ArticulosTab";
import ModulosTab from "./tabs/ModulosTab";
import CotizacionesTab from "./tabs/CotizacionesTab";
import type { Datos } from "./types";

type Pestania = "articulos" | "modulos" | "cotizaciones";

const PESTANIAS: { clave: Pestania; etiqueta: string }[] = [
  { clave: "articulos", etiqueta: "Artículos" },
  { clave: "modulos", etiqueta: "Módulos" },
  { clave: "cotizaciones", etiqueta: "Cotizaciones" },
];

function PantallaConfiguracion() {
  return (
    <div className="pantalla-centrada">
      <div className="config-caja">
        <h1>Falta configurar Supabase</h1>
        <ol>
          <li>
            Cree un proyecto en <strong>supabase.com</strong> y ejecute el script{" "}
            <code>supabase/schema.sql</code> en el SQL Editor.
          </li>
          <li>
            Copie <code>.env.example</code> como <code>.env.local</code> y complete{" "}
            <code>VITE_SUPABASE_URL</code> y <code>VITE_SUPABASE_KEY</code>.
          </li>
          <li>Reinicie el servidor de desarrollo.</li>
        </ol>
      </div>
    </div>
  );
}

function AppPrincipal({ usuario }: { usuario: User }) {
  const [datos, setDatos] = useState<Datos | null>(null);
  const [pestania, setPestania] = useState<Pestania>("articulos");
  const [error, setError] = useState<string | null>(null);

  const refrescar = useCallback(async () => {
    try {
      let d = await cargarDatos();
      // Recálculo automático en cascada de los módulos (sección 3 del plan)
      if (await sincronizarModulos(d)) d = await cargarDatos();
      setDatos(d);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar los datos.");
    }
  }, []);

  useEffect(() => {
    refrescar();
  }, [refrescar]);

  return (
    <div className="app">
      <header className="app-encabezado">
        <div className="app-marca">Cotizador Modular</div>
        <nav className="app-tabs">
          {PESTANIAS.map((p) => (
            <button
              key={p.clave}
              className={pestania === p.clave ? "activo" : ""}
              onClick={() => setPestania(p.clave)}
            >
              {p.etiqueta}
            </button>
          ))}
        </nav>
        <div className="app-usuario">
          <span>{usuario.email}</span>
          <button className="btn btn-secundario btn-chico" onClick={() => supabase.auth.signOut()}>
            Cerrar sesión
          </button>
        </div>
      </header>

      <main className="app-contenido">
        {error && <div className="msg-error">{error}</div>}
        {!datos && !error && <p className="tabla-vacia">Cargando…</p>}
        {datos && pestania === "articulos" && (
          <ArticulosTab datos={datos} userId={usuario.id} refrescar={refrescar} />
        )}
        {datos && pestania === "modulos" && (
          <ModulosTab datos={datos} userId={usuario.id} refrescar={refrescar} />
        )}
        {datos && pestania === "cotizaciones" && (
          <CotizacionesTab datos={datos} userId={usuario.id} refrescar={refrescar} />
        )}
      </main>
    </div>
  );
}

export default function App() {
  const [sesion, setSesion] = useState<Session | null>(null);
  const [cargandoSesion, setCargandoSesion] = useState(true);

  useEffect(() => {
    if (!supabaseConfigurado) {
      setCargandoSesion(false);
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      setSesion(data.session);
      setCargandoSesion(false);
    });
    const { data: suscripcion } = supabase.auth.onAuthStateChange((_evento, nuevaSesion) => {
      setSesion(nuevaSesion);
    });
    return () => suscripcion.subscription.unsubscribe();
  }, []);

  if (!supabaseConfigurado) return <PantallaConfiguracion />;
  if (cargandoSesion) return <div className="pantalla-centrada">Cargando…</div>;
  if (!sesion) return <AuthScreen />;
  return <AppPrincipal usuario={sesion.user} />;
}
