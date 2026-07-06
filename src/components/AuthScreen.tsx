import { useState, type FormEvent } from "react";
import { supabase } from "../lib/supabase";

const traducirError = (mensaje: string): string => {
  if (mensaje.includes("Invalid login credentials")) return "Correo o contraseña incorrectos.";
  if (mensaje.includes("User already registered")) return "Ya existe una cuenta con ese correo.";
  if (mensaje.includes("Password should be at least 6 characters"))
    return "La contraseña debe tener al menos 6 caracteres.";
  if (mensaje.includes("Unable to validate email address"))
    return "El correo no tiene un formato válido.";
  if (mensaje.includes("is invalid"))
    return "Supabase rechazó ese correo. Use una dirección de correo real.";
  if (mensaje.includes("Email not confirmed")) return "Confirme su correo antes de ingresar.";
  if (mensaje.includes("rate limit")) return "Demasiados intentos. Espere un momento.";
  return "Ocurrió un error. Intente de nuevo.";
};

export default function AuthScreen() {
  const [modo, setModo] = useState<"login" | "registro">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);

  const cambiarModo = (m: "login" | "registro") => {
    setModo(m);
    setError(null);
    setExito(null);
  };

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    setCargando(true);
    setError(null);
    setExito(null);

    if (modo === "login") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError(traducirError(error.message));
    } else {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) setError(traducirError(error.message));
      else setExito("Cuenta creada. Ya puede ingresar con sus datos.");
    }
    setCargando(false);
  };

  return (
    <div className="auth-pantalla">
      <div className="auth-caja">
        <div className="auth-titulos">
          <div className="auth-marca">Cotizador Modular</div>
          <div className="auth-subtitulo">Artículos, Módulos y Cotizaciones</div>
        </div>

        <div className="auth-tabs">
          <button
            className={modo === "login" ? "activo" : ""}
            onClick={() => cambiarModo("login")}
          >
            Iniciar sesión
          </button>
          <button
            className={modo === "registro" ? "activo" : ""}
            onClick={() => cambiarModo("registro")}
          >
            Crear cuenta
          </button>
        </div>

        <form onSubmit={enviar} className="auth-form">
          <input
            type="email"
            placeholder="Correo electrónico"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
          <input
            type="password"
            placeholder="Contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete={modo === "login" ? "current-password" : "new-password"}
          />

          {error && <div className="msg-error">{error}</div>}
          {exito && <div className="msg-exito">{exito}</div>}

          <button type="submit" className="btn btn-primario btn-grande" disabled={cargando}>
            {cargando ? "Cargando…" : modo === "login" ? "Entrar" : "Crear cuenta"}
          </button>
        </form>
      </div>
    </div>
  );
}
