# Cotizador Modular

Aplicación multiusuario para gestionar Artículos, Módulos (compuestos y anidados) y Cotizaciones, con precios en pesos colombianos.

Stack: Vite + React 18 + TypeScript + Supabase (Postgres, Auth y RLS).

## Puesta en marcha

1. **Crear el proyecto de Supabase** (o reutilizar uno existente) en [supabase.com](https://supabase.com).
2. **Ejecutar el esquema**: abrir el SQL Editor del proyecto y ejecutar completo el archivo [`supabase/schema.sql`](supabase/schema.sql). Crea las 5 tablas, las políticas RLS por usuario, el trigger de referencias circulares y la función del consecutivo de cotizaciones.
3. **Configurar variables de entorno**: copiar `.env.example` como `.env.local` y completar con los datos de Settings → API del proyecto:
   ```
   VITE_SUPABASE_URL=https://<proyecto>.supabase.co
   VITE_SUPABASE_KEY=<publishable/anon key>
   ```
4. **Instalar y arrancar**:
   ```
   npm install
   npm run dev
   ```

Si `.env.local` no está configurado, la app muestra una pantalla con estas mismas instrucciones en lugar de fallar.

## Reglas de negocio implementadas

- **Precio unitario base** = `valor / cantidad` del artículo.
- **Artículos de área** (`tipo_medida` = `m2`, `cm2` o `mm2`): el renglón pide dos medidas lineales con su unidad (m, cm o mm); `valor_parcial = cantidad × (área / cantidad_x_medida) × precio_unitario_base`, con el área convertida a la unidad del artículo.
- **Artículos lineales** (`tipo_medida` = `m`, `cm` o `mm`): el renglón pide una sola medida con su unidad; `valor_parcial = cantidad × (longitud / cantidad_x_medida) × precio_unitario_base`.
- **Desperdicio** (Configuración → Parámetros): dos porcentajes por usuario, uno para artículos de área y otro para lineales. En los renglones de esos tipos, el costo base redondeado se incrementa con el desperdicio redondeado aparte (ej: `$26.667 + 25% = $26.667 + $6.667 = $33.334`). El % aplicado queda congelado en cada renglón.
- **Redondeo** normal a 0 decimales en cada valor parcial y final. Formato `$26.667`.
- **Módulos y cotizaciones → snapshot**: los valores se congelan al guardar y **nada se recalcula automáticamente**. Todo recálculo es manual con el botón **Recalcular**: en módulos, dentro del modal Editar (persiste de inmediato y confirma con mensaje); en cotizaciones, dentro del modal Editar (muestra "Recalculado. Presione Guardar para aplicar los cambios." y persiste al Guardar). Recalcular relee el valor actual de los artículos, el valor final guardado de los módulos anidados y el % de desperdicio vigente.
- **Bloqueo de eliminación** de artículos y módulos en uso, con el listado de módulos/cotizaciones que los usan. Las cotizaciones siempre se pueden eliminar (con confirmación).
- **Referencias circulares** entre módulos bloqueadas también en la base de datos (trigger `chequear_ciclo_modulo`).
- **Configuración**: cambio de contraseña (patrón de mis-gastos) y parámetros de desperdicio.

> Nota de migración: si la base de datos se creó con una versión anterior de `schema.sql`, ejecutar `supabase/migracion-01-desperdicio.sql` para agregar la tabla `parametros` y la columna `desperdicio`.

## Decisiones tomadas sobre los supuestos abiertos del plan

Estas eran las dudas de la sección 4 del plan; quedaron resueltas así (fáciles de cambiar si se decide lo contrario):

1. **Catálogo privado por usuario**: `articulos` y `modulos` llevan `user_id` con RLS estricta, igual que `mis-gastos`. Ningún usuario ve los datos de otro.
2. **Consecutivo de cotizaciones global**: el `id` es una identity de Postgres compartida entre usuarios; nunca se reutiliza (ni al borrar la última cotización). Si algún día se quiere un consecutivo 1, 2, 3… independiente por usuario, habría que agregar una columna `consecutivo` con contador por usuario.
3. **Cantidad en renglones de área**: la fórmula del plan no incluía la cantidad; se interpretó que la cantidad multiplica el resultado (`cantidad × (área / cantidad_x_medida) × precio_base`). Con cantidad = 1 coincide con el ejemplo verificado ($26.667).

## Estructura

```
supabase/schema.sql        Esquema completo (tablas, RLS, triggers, función de consecutivo)
src/lib/calculos.ts        Reglas de cálculo (área, parciales, cascada de módulos)
src/lib/datos.ts           Acceso a Supabase (CRUD, sincronización de módulos, usos)
src/lib/formato.ts         Moneda COP y fechas dd-mm-YYYY
src/components/            AuthScreen, Modal, diálogos, editor de renglones, árbol de detalle
src/tabs/                  ArticulosTab, ModulosTab, CotizacionesTab
```
