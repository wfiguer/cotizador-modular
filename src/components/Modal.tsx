import type { ReactNode } from "react";

interface Props {
  titulo: string;
  onCerrar: () => void;
  children: ReactNode;
  ancho?: number;
}

export default function Modal({ titulo, onCerrar, children, ancho = 560 }: Props) {
  return (
    <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onCerrar()}>
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
