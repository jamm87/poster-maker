/**
 * PLANTILLAS de textos legales. Sustituye los campos entre [CORCHETES] y revísalos con tu gestoría o
 * un abogado antes de vender: no constituyen asesoramiento jurídico.
 */
import type { ReactNode } from "react";

interface Ctx {
  brand: string;
  email: string;
  base: string;
}

type LegalDoc = { title: string; body: (c: Ctx) => ReactNode };

const OWNER = "[NOMBRE O RAZÓN SOCIAL] · NIF [NIF] · [DOMICILIO COMPLETO]";

export const LEGAL: Record<"es" | "en", Record<string, LegalDoc>> = {
  es: {
    "aviso-legal": {
      title: "Aviso legal",
      body: (c) => (
        <>
          <p>
            En cumplimiento de la Ley 34/2002 (LSSI-CE), se informa de que este sitio web ({c.base}) es titularidad de {OWNER}. Contacto:{" "}
            {c.email}. [Datos registrales, si es una sociedad.]
          </p>
          <h2>Propiedad intelectual</h2>
          <p>
            Los diseños, textos y el software de {c.brand} están protegidos. Los mapas se generan con datos © colaboradores de OpenStreetMap, disponibles
            bajo la licencia Open Database License (ODbL). El motor de render deriva del proyecto de código abierto «maptoposter» (licencia MIT).
          </p>
          <h2>Responsabilidad</h2>
          <p>El titular no se responsabiliza del mal uso del sitio ni de los daños derivados de interrupciones del servicio ajenas a su control.</p>
        </>
      ),
    },
    privacidad: {
      title: "Política de privacidad",
      body: (c) => (
        <>
          <p>Responsable del tratamiento: {OWNER}. Contacto: {c.email}.</p>
          <h2>Qué datos tratamos y para qué</h2>
          <ul>
            <li>Datos de compra (nombre, email, dirección de facturación y envío, teléfono): para gestionar tu pedido, entregar los archivos y enviar los productos físicos. Base jurídica: ejecución del contrato.</li>
            <li>Datos de facturación: para cumplir obligaciones fiscales y contables. Base jurídica: obligación legal. Se conservan el plazo legal (en general, 6 años).</li>
            <li>Diseños que creas (lugar, textos): para generar tu póster.</li>
          </ul>
          <h2>Encargados y destinatarios</h2>
          <ul>
            <li>Stripe Payments Europe Ltd. (pagos). No almacenamos datos de tarjetas.</li>
            <li>Gelato (impresión y envío de productos físicos): recibe tu nombre, dirección, email y teléfono.</li>
            <li>Resend (envío de emails transaccionales).</li>
            <li>[Proveedor de hosting] y Cloudflare (almacenamiento de archivos).</li>
          </ul>
          <p>Algunos proveedores pueden tratar datos fuera del EEE con las garantías adecuadas (cláusulas contractuales tipo).</p>
          <h2>Tus derechos</h2>
          <p>
            Puedes ejercer tus derechos de acceso, rectificación, supresión, oposición, limitación y portabilidad escribiendo a {c.email}. También puedes
            reclamar ante la Agencia Española de Protección de Datos (aepd.es).
          </p>
        </>
      ),
    },
    cookies: {
      title: "Política de cookies",
      body: () => (
        <>
          <p>Este sitio sólo utiliza cookies técnicas imprescindibles, exentas de consentimiento (art. 22.2 LSSI):</p>
          <ul>
            <li><strong>cart_id</strong>: identifica tu carrito (30 días).</li>
            <li><strong>admin_session</strong>: sesión del panel de administración (sólo personal autorizado).</li>
          </ul>
          <p>
            El pago se realiza en la plataforma de Stripe, que puede usar sus propias cookies para prevenir el fraude. Si en el futuro se añaden
            cookies analíticas o publicitarias se pedirá tu consentimiento previo.
          </p>
        </>
      ),
    },
    condiciones: {
      title: "Condiciones de venta",
      body: (c) => (
        <>
          <p>Estas condiciones regulan la compra de productos en {c.base}, ofrecidos por {OWNER}.</p>
          <h2>Productos</h2>
          <p>
            Pósters de mapas personalizados en formato digital (archivos PNG y PDF de alta resolución) y físico (papel, enmarcado, lienzo o colgador),
            producidos bajo demanda según tu diseño. La vista previa del configurador es orientativa: el archivo final se genera con los datos completos
            de OpenStreetMap y puede presentar pequeñas diferencias de detalle.
          </p>
          <h2>Precios y pago</h2>
          <p>
            Los precios se muestran en euros e incluyen el IVA. Los gastos de envío de los productos físicos se indican antes del pago. El pago se realiza
            mediante tarjeta, Apple Pay, Google Pay, PayPal o Klarna a través de Stripe.
          </p>
          <h2>Entrega</h2>
          <p>
            Productos digitales: se envía un enlace de descarga por email en cuanto el archivo está generado (normalmente, minutos). El enlace es válido
            durante el plazo y número de descargas indicados. Productos físicos: se imprimen en un centro de producción cercano a la dirección de envío;
            plazo orientativo de 3 a 9 días hábiles según destino. Sólo enviamos a países de la Unión Europea.
          </p>
          <h2>Derecho de desistimiento</h2>
          <p>
            Conforme al art. 103 del Real Decreto Legislativo 1/2007, no procede el derecho de desistimiento: (c) en productos confeccionados conforme a
            las especificaciones del consumidor o claramente personalizados, como todos los pósters de esta tienda; y (m) en contenido digital cuya
            descarga comienza con tu consentimiento expreso y tu conocimiento de que pierdes dicho derecho, consentimiento que prestas en el carrito.
          </p>
          <h2>Garantía y defectos</h2>
          <p>
            Si un producto físico llega dañado o con defectos de impresión, escríbenos a {c.email} en un plazo de 14 días con fotos y lo reponemos sin coste.
            Se aplica la garantía legal de conformidad (arts. 114 y ss. TRLGDCU).
          </p>
          <h2>Uso de los archivos digitales</h2>
          <p>Los archivos se licencian para uso personal (imprimirlos y decorar). No está permitida su reventa. Debe mantenerse la atribución a OpenStreetMap.</p>
          <h2>Resolución de conflictos</h2>
          <p>
            Puedes contactarnos en {c.email}. Estas condiciones se rigen por la legislación española; en caso de conflicto serán competentes los juzgados
            del domicilio del consumidor.
          </p>
        </>
      ),
    },
  },
  en: {
    "aviso-legal": {
      title: "Legal notice",
      body: (c) => (
        <>
          <p>
            This website ({c.base}) is owned by {OWNER}. Contact: {c.email}.
          </p>
          <h2>Intellectual property</h2>
          <p>
            Designs, texts and software of {c.brand} are protected. Maps are generated from data © OpenStreetMap contributors, available under the Open
            Database License (ODbL). The rendering engine derives from the open-source project “maptoposter” (MIT licence).
          </p>
        </>
      ),
    },
    privacidad: {
      title: "Privacy policy",
      body: (c) => (
        <>
          <p>Data controller: {OWNER}. Contact: {c.email}.</p>
          <p>
            We process your purchase data (name, email, billing and shipping address, phone) to fulfil your order and to comply with tax obligations.
            Processors: Stripe (payments), Gelato (printing and shipping), Resend (email), [hosting provider] and Cloudflare (file storage). You can
            exercise your GDPR rights by writing to {c.email} and lodge a complaint with the Spanish Data Protection Agency (aepd.es).
          </p>
        </>
      ),
    },
    cookies: {
      title: "Cookie policy",
      body: () => (
        <p>
          We only use strictly necessary cookies: <strong>cart_id</strong> (your cart, 30 days) and <strong>admin_session</strong> (staff only). Stripe
          may set its own cookies during payment for fraud prevention.
        </p>
      ),
    },
    condiciones: {
      title: "Terms of sale",
      body: (c) => (
        <>
          <p>These terms govern purchases on {c.base}, offered by {OWNER}. Prices are in euros and include VAT. We ship to EU countries only.</p>
          <p>
            Digital products are delivered as a download link by email once rendered. Physical products are printed on demand close to the delivery
            address (3–9 business days).
          </p>
          <p>
            Right of withdrawal: under Spanish consumer law (art. 103 TRLGDCU) it does not apply to personalised goods, nor to digital content whose
            download begins with your express consent and acknowledgement that you lose the right, which you give in the cart.
          </p>
          <p>Damaged or defective prints are replaced free of charge if reported to {c.email} within 14 days. Files are licensed for personal use only.</p>
        </>
      ),
    },
  },
};
