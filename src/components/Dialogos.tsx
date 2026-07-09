import Modal from "./Modal";

interface PropsAviso {
  titulo?: string;
  mensaje: string;
  onCerrar: () => void;
}

/** Aviso informativo con un solo botón (por ejemplo, bloqueo de eliminación). */
export function Aviso({ titulo = "Aviso", mensaje, onCerrar }: PropsAviso) {
  return (
    <Modal titulo={titulo} onCerrar={onCerrar} ancho={480}>
      <p className="dialogo-mensaje">{mensaje}</p>
      <div className="modal-acciones">
        <button className="btn btn-primario" onClick={onCerrar}>
          Entendido
        </button>
      </div>
    </Modal>
  );
}

interface PropsConfirmacion {
  titulo?: string;
  mensaje: string;
  textoConfirmar?: string;
  /** "peligro" (rojo, por defecto) para eliminar; "primario" para confirmaciones de guardado. */
  variante?: "peligro" | "primario";
  onConfirmar: () => void;
  onCancelar: () => void;
}

/** Confirmación con dos botones (por ejemplo, antes de eliminar o de guardar). */
export function Confirmacion({
  titulo = "Confirmar",
  mensaje,
  textoConfirmar = "Eliminar",
  variante = "peligro",
  onConfirmar,
  onCancelar,
}: PropsConfirmacion) {
  return (
    <Modal titulo={titulo} onCerrar={onCancelar} ancho={480}>
      <p className="dialogo-mensaje">{mensaje}</p>
      <div className="modal-acciones">
        <button className="btn btn-secundario" onClick={onCancelar}>
          Cancelar
        </button>
        <button
          className={`btn ${variante === "primario" ? "btn-primario" : "btn-peligro"}`}
          onClick={onConfirmar}
        >
          {textoConfirmar}
        </button>
      </div>
    </Modal>
  );
}
