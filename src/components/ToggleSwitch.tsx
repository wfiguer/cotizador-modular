import { useId } from "react";

interface Props {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Etiqueta accesible que describe lo que hace el switch (leída por lectores de pantalla). */
  etiqueta: string;
  disabled?: boolean;
}

/**
 * Toggle switch accesible: usa un checkbox nativo con role="switch", por lo
 * que funciona con teclado (Tab + Espacio) y lectores de pantalla sin JS extra.
 */
export default function ToggleSwitch({ checked, onChange, etiqueta, disabled }: Props) {
  const id = useId();
  return (
    <label className="switch" htmlFor={id} title={etiqueta}>
      <input
        id={id}
        type="checkbox"
        role="switch"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        aria-label={etiqueta}
      />
      <span className="switch-deslizador" aria-hidden="true" />
    </label>
  );
}
