# POS Frontend (React + Vite)

Single screen Point of Sale UI built with React 18, TypeScript, Tailwind CSS, Zustand and TanStack Query. The app talks to the existing Django backend via the provided REST endpoints and keeps the current localStorage contract (`pos.front.state`).

## Requisitos

- Node.js 20+
- pnpm 8+ (recomendado). También se puede usar npm, pero los comandos de ejemplo usan pnpm.

## Comandos

```bash
pnpm install      # instala dependencias
pnpm dev          # arranca Vite en modo desarrollo (http://localhost:5173)
pnpm build        # genera build listo para producción en dist/
pnpm preview      # sirve el build para verificación
pnpm test         # ejecuta las pruebas unitarias (Vitest)
```

Durante el desarrollo Vite proxea automáticamente `/api`, `/producto`, `/auth_app` y `/auth` hacia `http://localhost:8000` para evitar problemas de CORS y mantener los redireccionamientos de login en el mismo host del frontend.

## Integración con Django

1. Ejecuta `pnpm build` para generar la carpeta `dist/`.
2. Copia el contenido de `dist/` a la carpeta estática de Django, por ejemplo `core/static/pos/`.
3. Ajusta la plantilla de Django para incluir el bundle principal (`assets/index-*.js`) y la hoja de estilos (`assets/index-*.css`). Si usas `django.contrib.staticfiles`, basta con referenciar `static('pos/index.html')` o servir el build como plantilla principal.
4. Recuerda ejecutar `python manage.py collectstatic` en despliegues productivos.
5. El bundle se comporta como una SPA. Django debe seguir sirviendo los endpoints API y la cookie CSRF.

### Incluir en una plantilla existente

```django
{% load static %}
<div id="root"></div>
<script defer src="{% static 'pos/assets/index-XYZ.js' %}"></script>
<link rel="stylesheet" href="{% static 'pos/assets/index-XYZ.css' %}" />
```

### Scripts de bootstrap compatibles con Django

Para mantener la compatibilidad con el template actual de Django, la plantilla debe inyectar dos scripts JSON antes de montar la SPA:

```html
<script id="backend-stores-data" type="application/json">{{ stores_json|safe }}</script>
<script id="backend-last-store-data" type="application/json">{{ last_store_json|safe }}</script>
```

- `backend-stores-data` debe contener la lista de sucursales disponibles (array de strings o un objeto con la clave `stores`).
- `backend-last-store-data` expone la última sucursal seleccionada (string u objeto con la clave `last_store`).

La app lee estos scripts al iniciar para hidratar `useSessionStore.setStores` y `useFiltersStore.setStoreId` si la respuesta de `/api/user_info` no provee sucursales, evitando romper la experiencia existente mientras conviven ambas fuentes de datos.

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
