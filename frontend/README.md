# POS Frontend (React + Vite)

Single screen Point of Sale UI built with React 18, TypeScript, Tailwind CSS, Zustand and TanStack Query. The app communicates with the FastAPI backend available under `/api/*` and keeps compatibility with the existing `localStorage` contract (`pos.front.state`).

## Requisitos

- Node.js 20+
- pnpm 8+ (recomendado). También se puede usar npm, pero los comandos de ejemplo usan pnpm.

## Comandos

```bash
pnpm install      # instala dependencias
pnpm dev          # arranca Vite en modo desarrollo (http://localhost:3000)
pnpm build        # genera build listo para producción en dist/
pnpm preview      # sirve el build para verificación
pnpm test         # ejecuta las pruebas unitarias (Vitest)
```

Durante el desarrollo Vite proxea automáticamente `/api` y rutas relacionadas hacia `http://localhost:8000` para evitar problemas de CORS y mantener los redireccionamientos en el mismo host del backend.

### Configurar la URL del backend

- Define la variable `VITE_BACKEND_URL` (por ejemplo en un archivo `.env` o variable de entorno) con la URL base del backend FastAPI.
- Si no se define, el frontend usará rutas relativas, ideales cuando el reverse proxy sirve backend y frontend bajo el mismo dominio.
- En Docker Compose ya se provee este valor (`http://api:8000`) para que el frontend converse con el backend automáticamente.

### Bootstrap inicial

Para ambientes donde el backend no puede responder inmediatamente con `/api/user_info`, la plantilla HTML puede inyectar dos scripts JSON antes de montar la SPA:

```html
<script id="backend-stores-data" type="application/json">{ "stores": ["Casa Central", "Sucursal 2"] }</script>
<script id="backend-last-store-data" type="application/json">{ "last_store": "Casa Central" }</script>
```

La app lee estos scripts al iniciar para hidratar `useSessionStore.setStores` y `useFiltersStore.setStoreId` si la respuesta de `/api/user_info` no provee sucursales, manteniendo compatibilidad con entornos mixtos.

## Hotkeys por defecto

| Acción | Atajo |
| --- | --- |
| Foco buscador | `Ctrl + K` |
| Abrir/cerrar carrito | `F2` |
| Descuento de línea (selecciona primera línea) | `F7` |
| Logística | `F8` |
| Clientes | `F9` |
| Guardar carrito remoto | `F10` |
| Simulador de pagos | `F6` |
| Multipago (placeholder) | `Shift + F6` |
| Ayuda / ver listado de atajos | `F1` |

## Notas funcionales

- Escaneo de códigos de barras:
  - El input admite lectores USB (modo teclado).
  - Si el navegador soporta `BarcodeDetector`, se habilita un botón para escanear usando la cámara.
- Persistencia: el estado del carrito se guarda en localStorage (`pos.front.state`) y se sincroniza automáticamente (debounce ~400ms) con `/api/save_user_cart` cuando hay sesión y conexión.
- El modal de simulador de pagos usa `window.SIMULATOR_V5_URL`. Asegúrate de definirlo antes de montar la app si se necesita.
- El botón **Imprimir presupuesto** abre una ventana imprimible lista para `Ctrl + P`.
- Panel auxiliar para Pedidos y Presupuestos permite buscar por número (placeholder; mostrará toasts hasta que la integración esté disponible).
- Los toasts se muestran en la esquina inferior para errores, advertencias o confirmaciones.

## Estilos y accesibilidad

- Tailwind CSS con tema oscuro/claro controlado desde la barra superior.
- Focus visible y navegación por teclado para los componentes interactivos.
- Componentes de modal con `aria-modal` y cierre vía `Escape`.

## Configuración adicional

- Puedes personalizar los atajos desde `useUiStore` si en el futuro se expone un editor de atajos.
- El almacén preferido se actualiza vía `/api/update_last_store` al seleccionar una sucursal.

## Estructura relevante

```
src/
  api/           # wrappers fetch + normalizadores de respuestas
  components/    # UI (TopBar, CartPanel, modales, etc.)
  hooks/         # hooks reutilizables (hotkeys, barcode, sync remoto)
  stores/        # Zustand stores (cart, filtros, UI, sesión, toasts)
  utils/         # helpers (totales, normalizadores, impresión)
  pages/POS.tsx  # vista única del POS
```

## Troubleshooting

- Si la cámara no aparece al escanear, verifica que el sitio esté servido sobre HTTPS o localhost y concede permisos manualmente.
- En modo offline, los cambios se siguen guardando localmente; se mostrará un toast cuando falle la sincronización con el backend.
- Para limpiar completamente el estado local usa la consola del navegador: `localStorage.removeItem('pos.front.state')`.
