import { useState, type FormEvent } from "react";
import Modal from "../components/Modal";
import { Aviso, Confirmacion } from "../components/Dialogos";
import { formatearCOP } from "../lib/formato";
import { esTipoArea, esTipoLineal } from "../lib/calculos";
import {
  actualizarArticulo,
  crearArticulo,
  eliminarArticulo,
  usosDeItem,
  type CamposArticulo,
} from "../lib/datos";
import type { Articulo, Datos } from "../types";

interface Props {
  datos: Datos;
  userId: string;
  refrescar: () => Promise<void>;
}

interface FormArticulo {
  nombre: string;
  cantidad: string;
  tipo_medida: string;
  cantidad_x_medida: string;
  valor: string;
}

/** Únicos tipos de medida seleccionables en el combo. */
const TIPOS_MEDIDA = ["Und", "m2", "cm2", "mm2", "m", "cm", "mm"];

/** Lleva un tipo guardado (texto libre en datos antiguos) a una opción del combo. */
const tipoMedidaCanonico = (tipo: string): string =>
  TIPOS_MEDIDA.find((t) => t.toLowerCase() === tipo.trim().toLowerCase()) ?? "Und";

const formVacio: FormArticulo = {
  nombre: "",
  cantidad: "1",
  tipo_medida: "Und",
  cantidad_x_medida: "1",
  valor: "",
};

export default function ArticulosTab({ datos, userId, refrescar }: Props) {
  const [modalAbierto, setModalAbierto] = useState(false);
  const [editando, setEditando] = useState<Articulo | null>(null);
  const [form, setForm] = useState<FormArticulo>(formVacio);
  const [errorForm, setErrorForm] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [aEliminar, setAEliminar] = useState<Articulo | null>(null);

  const abrirCrear = () => {
    setEditando(null);
    setForm(formVacio);
    setErrorForm(null);
    setModalAbierto(true);
  };

  const abrirEditar = (articulo: Articulo) => {
    setEditando(articulo);
    setForm({
      nombre: articulo.nombre,
      cantidad: String(articulo.cantidad),
      tipo_medida: tipoMedidaCanonico(articulo.tipo_medida),
      cantidad_x_medida: String(articulo.cantidad_x_medida),
      valor: String(articulo.valor),
    });
    setErrorForm(null);
    setModalAbierto(true);
  };

  const guardar = async (e: FormEvent) => {
    e.preventDefault();
    const nombre = form.nombre.trim();
    const cantidad = Number(form.cantidad);
    const cantidadXMedida = Number(form.cantidad_x_medida);
    const valor = Number(form.valor);
    const tipoMedida = form.tipo_medida.trim();

    if (!nombre) return setErrorForm("El nombre es obligatorio.");
    const duplicado = datos.articulos.some(
      (a) => a.id !== editando?.id && a.nombre.trim().toLowerCase() === nombre.toLowerCase()
    );
    if (duplicado) return setErrorForm("Artículo ya existente con el mismo nombre");
    if (!form.cantidad || Number.isNaN(cantidad) || cantidad <= 0)
      return setErrorForm("La cantidad debe ser un número mayor que cero.");
    if (!tipoMedida) return setErrorForm("El tipo de medida es obligatorio.");
    if (
      (esTipoArea(tipoMedida) || esTipoLineal(tipoMedida)) &&
      (!form.cantidad_x_medida || Number.isNaN(cantidadXMedida) || cantidadXMedida <= 0)
    )
      return setErrorForm(
        "Para artículos de área (m2, cm2, mm2) o lineales (m, cm, mm), la cantidad por medida debe ser mayor que cero."
      );
    if (form.valor === "" || Number.isNaN(valor) || valor < 0)
      return setErrorForm("El valor debe ser un número mayor o igual a cero.");

    const campos: CamposArticulo = {
      nombre,
      cantidad,
      tipo_medida: tipoMedida,
      cantidad_x_medida: Number.isNaN(cantidadXMedida) ? 1 : cantidadXMedida,
      valor,
    };

    setGuardando(true);
    try {
      if (editando) await actualizarArticulo(editando.id, campos);
      else await crearArticulo(userId, campos);
      await refrescar();
      setModalAbierto(false);
    } catch (err) {
      setErrorForm(err instanceof Error ? err.message : "Error al guardar el artículo.");
    } finally {
      setGuardando(false);
    }
  };

  const pedirEliminar = (articulo: Articulo) => {
    const usos = usosDeItem("articulo", articulo.id, datos);
    if (usos.length > 0) {
      setAviso(
        `No se puede eliminar el artículo '${articulo.nombre}' porque está siendo usado en: ${usos.join(", ")}`
      );
      return;
    }
    setAEliminar(articulo);
  };

  const confirmarEliminar = async () => {
    if (!aEliminar) return;
    try {
      await eliminarArticulo(aEliminar.id);
      await refrescar();
    } catch (err) {
      setAviso(err instanceof Error ? err.message : "Error al eliminar el artículo.");
    } finally {
      setAEliminar(null);
    }
  };

  return (
    <section>
      <div className="tab-encabezado">
        <h1>Artículos</h1>
        <button className="btn btn-primario" onClick={abrirCrear} title="Agregar artículo">
          +
        </button>
      </div>

      {datos.articulos.length === 0 ? (
        <p className="tabla-vacia">Aún no hay artículos. Agregue el primero con el botón «+».</p>
      ) : (
        <table className="tabla">
          <thead>
            <tr>
              <th>Nombre</th>
              <th className="num">Cantidad</th>
              <th>Tipo de Medida</th>
              <th className="num">Cantidad x Medida</th>
              <th className="num">Valor</th>
              <th className="acciones">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {datos.articulos.map((articulo) => (
              <tr key={articulo.id}>
                <td>{articulo.nombre}</td>
                <td className="num">{articulo.cantidad}</td>
                <td>{articulo.tipo_medida}</td>
                <td className="num">{articulo.cantidad_x_medida}</td>
                <td className="num">{formatearCOP(articulo.valor)}</td>
                <td className="acciones">
                  <button className="btn btn-secundario btn-chico" onClick={() => abrirEditar(articulo)}>
                    Editar
                  </button>
                  <button className="btn btn-peligro btn-chico" onClick={() => pedirEliminar(articulo)}>
                    Eliminar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {modalAbierto && (
        <Modal
          titulo={editando ? "Editar artículo" : "Nuevo artículo"}
          onCerrar={() => setModalAbierto(false)}
        >
          <form onSubmit={guardar} className="form-vertical">
            <label className="campo">
              Nombre
              <input
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                autoFocus
              />
            </label>
            <label className="campo">
              Cantidad
              <input
                type="number"
                min="0"
                step="any"
                value={form.cantidad}
                onChange={(e) => setForm({ ...form, cantidad: e.target.value })}
              />
            </label>
            <label className="campo">
              Tipo de Medida
              <select
                value={form.tipo_medida}
                onChange={(e) => setForm({ ...form, tipo_medida: e.target.value })}
              >
                {TIPOS_MEDIDA.map((tipo) => (
                  <option key={tipo} value={tipo}>
                    {tipo}
                  </option>
                ))}
              </select>
              <span className="campo-ayuda">
                m2, cm2 y mm2 activan el cálculo por área (dos medidas lineales); m, cm y mm el
                cálculo lineal (una medida). Ambos aplican el desperdicio de Configuración →
                Parámetros.
              </span>
            </label>
            <label className="campo">
              Cantidad x Medida
              <input
                type="number"
                min="0"
                step="any"
                value={form.cantidad_x_medida}
                onChange={(e) => setForm({ ...form, cantidad_x_medida: e.target.value })}
              />
            </label>
            <label className="campo">
              Valor
              <input
                type="number"
                min="0"
                step="any"
                value={form.valor}
                onChange={(e) => setForm({ ...form, valor: e.target.value })}
              />
            </label>

            {errorForm && <div className="msg-error">{errorForm}</div>}

            <div className="modal-acciones">
              <button
                type="button"
                className="btn btn-secundario"
                onClick={() => setModalAbierto(false)}
              >
                Cancelar
              </button>
              <button type="submit" className="btn btn-primario" disabled={guardando}>
                {guardando ? "Guardando…" : "Guardar"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {aviso && <Aviso titulo="No se puede eliminar" mensaje={aviso} onCerrar={() => setAviso(null)} />}

      {aEliminar && (
        <Confirmacion
          titulo="Eliminar artículo"
          mensaje={`¿Eliminar el artículo '${aEliminar.nombre}'? Esta acción no se puede deshacer.`}
          onConfirmar={confirmarEliminar}
          onCancelar={() => setAEliminar(null)}
        />
      )}
    </section>
  );
}
