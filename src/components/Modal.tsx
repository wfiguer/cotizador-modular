import type { ReactNode } from "react";

interface Props {
  titulo: string;
  onCerrar: () => void;
  children: ReactNode;
  ancho?: number;
}

export default function Modal({ titulo, onCerrar, children, ancho = 560 }: Props) {
  // El clic fuera del modal no lo cierra: solo se sale con Cancelar,
  // Guardar o el botón ✕, para no perder lo registrado hasta el momento.
  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: ancho }}>
        <div className="modal-encabezado">
          <h2>{titulo}</h2>
          <button className="btn-icono" onClick={onCerrar} aria-label="Cerrar">
            ✕
          </button>
        </div>
        <div className="modal-cuerpo">{children}</div>
      </div>
    </div>
  );
}
