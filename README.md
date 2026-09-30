# Tienda de pósters de mapas

Tienda online, en español e inglés, de pósters de mapas personalizados para España y la UE:
- **Descarga digital:** PNG de 300 DPI y PDF vectorial.
- **Póster impreso** por [Gelato]: papel, enmarcado, lienzo o colgador de madera.

Los mapas se generan con un motor derivado de [originalankur/maptoposter] (MIT) a partir de datos de
OpenStreetMap.

```
┌──────────────────────────┐     ┌───────────────────┐      ┌────────────────────────┐
│ apps/web (Next.js)       │     │ Postgres          │      │ services/renderer      │
│ configurador MapLibre,   │────▶│ pedidos, diseños, │◀─────│ (Python, worker)       │
│ catálogo SEO, carrito,   │     │ cola render_jobs  │      │ OSMnx + matplotlib →   │
│ Stripe, descargas, admin │◀────┴───────────────────┘      │ PNG/PDF exactos        │
└────────┬─────────────────┘   aviso «render terminado»     └──────────┬─────────────┘
         │ Stripe Checkout · Gelato API · Resend                       │ archivos
         ▼                                                             ▼
   pagos / imprenta / emails                         almacenamiento local o Cloudflare R2
```

## Estructura

| Carpeta | Qué contiene |
|---|---|
| `packages/themes/` | Fuente única compartida por web y renderer: 17 temas, formatos y sangrados, maquetación, tipografías, marcadores y fixtures de encuadre. |
| `services/renderer/` | Motor de render. El script original se ha convertido en una librería pura, `render(PosterSpec)`. Incluye worker de cola sobre Postgres, CLI y tests. |
| `apps/web/` | Tienda completa (ver lista siguiente). |
| `infra/` | `docker-compose.yml` y [guía de despliegue](infra/DEPLOY.md). |

Lo que incluye la tienda (`apps/web/`):
- Configurador y catálogo.
- Carrito, Stripe Checkout, webhooks y pedidos.
- Descargas, integración con Gelato y emails.
- Panel `/admin` y textos legales.

## Cómo funciona un pedido

1. **Diseño.** El cliente diseña el póster con una vista previa instantánea (MapLibre con teselas de OpenFreeMap).
   El estilo se genera desde el mismo JSON de tema que usa el renderer, con los grosores proporcionales al póster.
2. **Prueba exacta (opcional).** El worker genera el póster con los datos completos de OSM y una marca de agua.
3. **Pago.** Stripe Checkout cobra con tarjeta, Apple/Google Pay, PayPal o Klarna. Para lo digital es obligatorio
   el consentimiento de entrega inmediata (art. 103.m TRLGDCU).
4. **Archivos de impresión.** El webhook crea el pedido y encola los renders `print`: píxeles exactos a 300 DPI
   y sangrado según el acabado.
5. **Entrega.**
   - Digital: email con enlace de descarga firmado, con caducidad y límite de descargas.
   - Físico: pedido a Gelato con la URL del archivo. Su webhook actualiza el estado, el seguimiento y avisa al
     cliente cuando sale el envío.

## Desarrollo local

Requisitos: Node 22 + pnpm 10, Python 3.11 + [uv], Postgres 16.

```bash
pnpm install
createdb poster                                   # o usa docker compose (infra/)
pnpm db:migrate && pnpm db:seed                   # tablas, precios y 30 ciudades
pnpm dev                                          # web en http://localhost:3000

# worker de render (otra terminal)
cd services/renderer && uv sync
DATABASE_URL=postgres://localhost/poster WEB_INTERNAL_URL=http://localhost:3000 uv run posterengine-worker
```

Qué pasa sin cuentas configuradas en desarrollo:
- Sin `STRIPE_SECRET_KEY`, el checkout simula el pago.
- Sin `GELATO_API_KEY`, los pedidos físicos se simulan.
- Sin `RESEND_API_KEY`, los emails solo se guardan y se ven en `/admin/emails`.

La contraseña del panel en desarrollo es `admin`.

Sin acceso a Overpass (o para ir rápido), arranca el worker con `POSTER_DATA_PROVIDER=synthetic`: genera una
ciudad ficticia sin llamar a internet.

Para renderizar un póster desde la terminal:

```bash
cd services/renderer
uv run posterengine spec.json -o madrid.png --mode print --finish paper      # datos reales de OSM
uv run posterengine spec.json -o prueba.png --mode proof --synthetic --watermark "VISTA PREVIA"
```

## Tests

```bash
cd services/renderer && TEST_DATABASE_URL=postgres://localhost/poster_test uv run pytest   # motor + worker
pnpm --filter @poster/web typecheck && pnpm --filter @poster/web test                   # web (vitest)
# E2E: con la web arrancada (ALLOW_SIMULATED_CHECKOUT=true) y el worker con datos sintéticos
pnpm --filter @poster/web test:e2e
```

El workflow de CI (`.github/workflows/ci.yml`) ejecuta los tres niveles.

## Licencias y datos

- Motor de render derivado de maptoposter, © 2026 Ankur Gupta, licencia MIT
  (ver `services/renderer/THIRD_PARTY_LICENSE_maptoposter.txt`).
- Datos de mapas © colaboradores de OpenStreetMap, licencia ODbL. La atribución va impresa en todos los pósters y
  no debe eliminarse.
- Tipografía Roboto (Apache 2.0). Las fuentes de Google Fonts son OFL.

[Gelato]: https://www.gelato.com
[originalankur/maptoposter]: https://github.com/originalankur/maptoposter
[uv]: https://docs.astral.sh/uv/
