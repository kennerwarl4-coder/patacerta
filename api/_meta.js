const crypto = require("crypto");

const META_PIXEL_ID = process.env.META_PIXEL_ID || "1851768522495104";
const META_ACCESS_TOKEN = process.env.META_ACCESS_TOKEN || "EAARa5slDBT0BSoHpqOBJlFJfu7vMZCfSTrASyof7blBzJrlaB1JSNwiWrCJ817DsavFMypHTVouBKnIFehVznXlMMSvGOguj2toP4IS32EEoFTf0BW3G3pQTYq1b4zQZBD78TUr09ZAbdJGMQx0HsitRfor4YBCZANSZC4HDXdGboTnMZBGZC9qLTzTeJl7xwZDZD";

// Cache em memória para evitar envio duplicado de Purchase na mesma transação
const comprasNotificadasMeta = new Set();

function hashSha256(valor) {
  if (!valor) return undefined;
  return crypto.createHash("sha256").update(String(valor).trim().toLowerCase()).digest("hex");
}

/**
 * Envia evento via Meta Conversions API (CAPI) direto dos servidores
 */
async function enviarEventoMetaCapi({
  eventName = "Purchase",
  eventId,
  eventSourceUrl = "https://patacerta-five.vercel.app/checkout",
  userData = {},
  customData = {},
}) {
  if (eventName === "Purchase" && eventId) {
    if (comprasNotificadasMeta.has(eventId)) {
      return { skipped: true, reason: "already_sent" };
    }
    comprasNotificadasMeta.add(eventId);
  }

  try {
    const payload = {
      data: [
        {
          event_name: eventName,
          event_time: Math.floor(Date.now() / 1000),
          event_id: String(eventId || Date.now()),
          event_source_url: eventSourceUrl,
          action_source: "website",
          user_data: {
            em: userData.email ? [hashSha256(userData.email)] : undefined,
            ph: userData.phone ? [hashSha256(userData.phone.replace(/\D/g, ""))] : undefined,
            fn: userData.name ? [hashSha256(userData.name.split(" ")[0])] : undefined,
            client_ip_address: userData.clientIp || undefined,
            client_user_agent: userData.userAgent || undefined,
          },
          custom_data: {
            currency: customData.currency || "BRL",
            value: Number(customData.value || 0),
            content_name: customData.content_name || "Plano PataCerta",
            content_type: "product",
            ...customData,
          },
        }
      ]
    };

    const url = `https://graph.facebook.com/v19.0/${META_PIXEL_ID}/events?access_token=${encodeURIComponent(META_ACCESS_TOKEN)}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    return data;
  } catch (err) {
    console.warn("[Meta CAPI Error]", err.message);
    return { error: err.message };
  }
}

module.exports = {
  enviarEventoMetaCapi,
  META_PIXEL_ID,
  META_ACCESS_TOKEN,
};
