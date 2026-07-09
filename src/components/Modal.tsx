import { useState, type ReactNode } from "react";

interface Props {
  titulo: string;
  onCerrar: () => void;
  children: ReactNode;
  ancho?: number;
}

// Cada modal que se abre toma un z-index mayor que el anterior, para que los
// sub-modales (Detalle, confirmaciones) queden siempre encima del que los abrió.
let ultimoZIndex = 50;

export default function Modal({ titulo, onCerrar, children, ancho = 560 }: Props) {
  const [zIndex] = useState(() => ++ultimoZIndex);
  // El clic fuera del modal no lo cierra: solo se sale con Cancelar,
  // Guardar o el botón ✕, para no perder lo registrado hasta el momento.
  return (
    <div className="modal-overlay" style={{ zIndex }}>
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
