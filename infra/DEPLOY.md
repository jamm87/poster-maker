# Guía de despliegue

Pasos para poner la tienda en producción con un presupuesto mínimo (unos 8–15 €/mes, sin contar comisiones).
Hazlo primero todo **en modo prueba** (claves `sk_test_` de Stripe y Gelato en borrador) y pasa a real al final.

## 0. Cuentas que necesitas

| Servicio | Para qué | Coste orientativo |
|---|---|---|
| [Hetzner Cloud](https://www.hetzner.com/cloud) | Servidor con web, worker y base de datos | CX32 (4 vCPU, 8 GB): ~8 €/mes |
| Dominio (cualquier registrador) | `tu-dominio.com` | ~10–15 €/año |
| [Cloudflare R2](https://developers.cloudflare.com/r2/) | Guardar los PNG/PDF generados | Gratis hasta 10 GB |
| [Stripe](https://stripe.com) | Cobros | ~1,5 % + 0,25 € por pago con tarjeta europea |
| [Gelato](https://www.gelato.com) | Impresión y envío | Pagas cada producto que imprimen |
| [Resend](https://resend.com) | Emails transaccionales | Gratis hasta 3.000 emails al mes |

## 1. Servidor con Coolify

1. **Servidor.** En Hetzner crea un servidor **CX32** con Ubuntu 24.04 en Falkenstein o Núremberg (UE) y activa las
   copias de seguridad automáticas (+20 %).
2. **Coolify.** Conéctate por SSH (`ssh root@IP`) e instálalo; es un panel web para desplegar sin tocar la
   terminal:
   ```bash
   curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash
   ```
3. **Cuenta y repositorio.** Abre `http://IP:8000`, crea tu usuario y conecta GitHub (Sources → GitHub App).
4. **Recurso.** Nuevo recurso → *Docker Compose* → este repositorio → archivo `infra/docker-compose.yml`.
5. **Variables.** Copia en la pestaña *Environment Variables* todas las de [`.env.example`](../.env.example) y
   rellénalas. Genera cada secreto con `openssl rand -base64 32`.
6. **Dominio.** En el servicio `web` pon `https://tu-dominio.com` (Coolify pide el certificado HTTPS solo) y crea en
   tu DNS un registro `A` que apunte a la IP del servidor.
7. **Desplegar.** Pulsa *Deploy*. El servicio `migrate` crea las tablas, carga precios y ciudades y encola las
   miniaturas del catálogo. Después arrancan `web` y `worker`.

Sin Coolify: `docker compose -f infra/docker-compose.yml --env-file .env up -d --build`, con un proxy HTTPS
(Caddy o Traefik) delante.

> El puerto 3000 no debe quedar expuesto a internet si usas Coolify o un proxy; bórralo del compose o ciérralo en
> el firewall de Hetzner.

## 2. Cloudflare R2 (archivos)

1. **Bucket.** R2 → *Create bucket* `posters`, que queda privado: los archivos se sirven con URLs firmadas.
2. **Token.** *Manage API tokens* → token con permiso *Object Read & Write* sobre ese bucket.
3. **Variables.** `STORAGE_DRIVER=s3`, `S3_ENDPOINT=https://<ACCOUNT_ID>.r2.cloudflarestorage.com`, `S3_BUCKET`,
   `S3_ACCESS_KEY_ID` y `S3_SECRET_ACCESS_KEY`.

Con `STORAGE_DRIVER=local` los archivos se quedan en el volumen `files` del servidor. Sirve para empezar, pero en
ese caso Gelato necesita que la tienda sea accesible desde internet para descargar el archivo.

## 3. Stripe (cobros)

1. **Claves.** *Developers → API keys* → copia la **secret key** (`sk_test_…`) en `STRIPE_SECRET_KEY`.
2. **Métodos de pago.** *Settings → Payments → Payment methods*: activa tarjetas, Apple Pay, Google Pay, PayPal y
   Klarna. Checkout los muestra solos.
3. **Webhook.** *Developers → Webhooks → Add endpoint*:
   - URL: `https://tu-dominio.com/api/webhooks/stripe`
   - Eventos: `checkout.session.completed`, `checkout.session.async_payment_succeeded` y `charge.refunded`.
   - Copia el *signing secret* (`whsec_…`) en `STRIPE_WEBHOOK_SECRET`.
4. **Compra de prueba.** Usa la tarjeta `4242 4242 4242 4242` con cualquier fecha futura y cualquier CVC.
5. **Pasar a real.** Activa la cuenta (datos fiscales y bancarios), cambia a claves `sk_live_…` y crea el mismo
   webhook en modo live.

> `ALLOW_SIMULATED_CHECKOUT` debe quedarse en `false` en producción: si se activa, cualquiera podría crear pedidos
> sin pagar.

## 4. Gelato (impresión y envío)

1. **Clave.** *Developer → API keys* → crea una y ponla en `GELATO_API_KEY`. Deja `GELATO_ORDER_TYPE=draft`: los
   pedidos llegarán a Gelato **como borrador** y no se imprimen hasta que los apruebes en su panel.
2. **productUid de cada variante.** Entra en `/admin/precios`. Cada combinación física (papel, enmarcado, lienzo,
   colgador × tamaño) necesita el `productUid` exacto de Gelato; el seed los deja como `TODO-…`.
   - Búscalos con la [Product API de Gelato](https://dashboard.gelato.com/docs/products/) (catálogos `posters`,
     `framed-posters`, `canvas`, `wood-hanger-posters`…) o en su catálogo web.
   - Mientras una variante tenga `TODO`, sus pedidos quedan en «needs_attention» con el aviso en el panel.
   - Desactiva («activa» = no) las combinaciones que Gelato no ofrezca.
3. **Especificaciones de archivo.** El sangrado por acabado está en `packages/themes/formats.json` (`bleedMm`).
   Compáralo con la ficha técnica de cada producto de Gelato. En lienzo suele aplicar el «mirror wrap»
   automáticamente, por eso va sin sangrado. Si cambias algo, redespliega.
4. **Webhook.** *Developer → Webhooks*: URL `https://tu-dominio.com/api/webhooks/gelato?secret=<GELATO_WEBHOOK_SECRET>`
   con los eventos de estado de pedido y de código de seguimiento.
5. **Pasar a real.** Cuando una compra de prueba llegue bien como borrador, pon `GELATO_ORDER_TYPE=order`.

## 5. Resend (emails)

1. **Dominio.** Añade tu dominio y crea los registros DNS que te indique (SPF, DKIM).
2. **Variables.** `RESEND_API_KEY=re_…` y `EMAIL_FROM="Tu Marca <pedidos@tu-dominio.com>"`.

Sin clave, los emails no se envían; se ven en `/admin/emails`.

## 6. Antes de abrir la tienda (checklist)

**Marca y textos legales:**
- [ ] `BRAND_NAME`, `CONTACT_EMAIL`, `PUBLIC_BASE_URL` y el nombre de la marca.
- [ ] Completar los textos legales de `apps/web/src/content/legal.tsx`: todos los campos `[ENTRE CORCHETES]`
      (titular, NIF, domicilio). Revisarlos con tu gestoría o un abogado.

**Productos y precios:**
- [ ] Precios revisados en `/admin/precios` (incluyen IVA).
- [ ] Todos los `productUid` de Gelato rellenos.
- [ ] Miniaturas del catálogo generadas: `/admin/catalogo` → «Regenerar todas».

**Compras de prueba:**
- [ ] Compra digital completa en modo prueba: pago, email y descarga del PNG y del PDF.
- [ ] Compra física completa en modo prueba: pago y borrador en Gelato con el archivo correcto (ábrelo y comprueba
      tamaño y sangrado).

**Paso a real:**
- [ ] Claves live de Stripe y `GELATO_ORDER_TYPE=order`.
- [ ] `ADMIN_PASSWORD` fuerte y `ALLOW_SIMULATED_CHECKOUT=false`.

## 7. Operación diaria

- **Panel `/admin`:**
  - Pedidos: reintentar renders, reenviar descargas, renovar enlaces, reintentar Gelato.
  - Renders fallidos, catálogo, precios y emails.
  - «Exportar CSV» genera el listado de pedidos para la gestoría (separador `;` y coma decimal, se abre en Excel).
- **Copias de seguridad.** Las copias de Hetzner cubren el servidor entero. Añade además un volcado diario de la
  base de datos:
  `docker compose exec postgres pg_dump -U poster poster | gzip > /root/backups/poster-$(date +%F).sql.gz`
  (con un cron). Los archivos en R2 se pueden regenerar, porque el diseño está guardado en `designs`.
- **Capacidad.**
  - Un worker renderiza un póster cada 30 s – 3 min según el tamaño de la ciudad; el primer render de una zona es
    el lento, luego se cachea en el volumen `osmcache`.
  - Si se acumula cola (`/admin/trabajos`), sube a un CX42 o añade otro worker (`docker compose up --scale worker=2`,
    vigilando la RAM).

## 8. Riesgos conocidos y cómo crecer

- **Datos de mapas gratuitos (uso justo).** La prueba y el archivo final usan la API pública de Overpass, y el
  buscador usa la instancia pública de Photon (komoot). Son gratis pero con límites de uso justo.
  - Con volumen, monta tu propio Overpass (`OVERPASS_URL`, un servidor de ~20–40 €/mes con el extracto de Europa)
    y Photon propio o un geocodificador de pago (`GEOCODER_URL`).
  - La vista previa usa las teselas gratuitas de OpenFreeMap.
- **Diferencias entre vista previa y archivo final.** Las teselas generalizan las calles menores en zooms bajos,
  así que la vista previa es orientativa. El botón «Ver prueba exacta» y las condiciones de venta lo explican.

**Fiscalidad (a revisar con tu gestoría):**
- Los precios incluyen IVA español.
- En descargas digitales vendidas a particulares de otros países de la UE, al superar **10.000 €/año** hay que
  aplicar el IVA del país del cliente (ventanilla única OSS). El CSV incluye el país de facturación de cada pedido.
- **Verifactu** es obligatorio desde el 1-ene-2027 (sociedades) o el 1-jul-2027 (resto). La tienda no emite
  facturas: la facturación debe hacerse con un programa adaptado.
