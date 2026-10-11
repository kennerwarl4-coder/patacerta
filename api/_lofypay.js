const crypto = require("crypto");

const BASE_URL = "https://app.lofypay.com/api/v1";

/**
 * Retorna a Secret Key da LofyPay das variáveis de ambiente.
 * NUNCA exponha essa chave ao cliente.
 */
function getSecretKey() {
  const key = process.env.LOFYPAY_SECRET_KEY;
  if (!key) {
    throw new Error("LOFYPAY_SECRET_KEY não configurada no ambiente do servidor.");
  }
  return key.trim();
}

/**
 * Cria uma cobrança PIX na LofyPay.
 * Valores sempre em REAIS (number, ex.: 37.00).
 */
async function criarCobrancaPix({
  amount,
  client,
  products = [],
  external_reference,
  notification_url,
  expiration = 1800,
  trackingParameters = {},
  idempotencyKey = null,
}) {
  const secretKey = getSecretKey();

  const body = {
    amount: Number(amount),
    method: "pix",
    external_reference: String(external_reference),
    expiration: Number(expiration),
    client: {
      name: String(client.name || "").trim(),
      document: String(client.document || client.cpf || "").replace(/\D/g, ""),
      email: String(client.email || "").trim().toLowerCase(),
    },
    trackingParameters: {
      utm_source: trackingParameters?.utm_source || null,
      utm_campaign: trackingParameters?.utm_campaign || null,
      utm_medium: trackingParameters?.utm_medium || null,
      utm_content: trackingParameters?.utm_content || null,
      utm_term: trackingParameters?.utm_term || null,
      src: trackingParameters?.src || null,
      sck: trackingParameters?.sck || null,
    },
  };

  if (client.phone) {
    body.client.phone = String(client.phone).replace(/\D/g, "");
  }

  if (Array.isArray(products) && products.length > 0) {
    body.products = products;
  }

  if (notification_url) {
    body.notification_url = notification_url;
  }

  const headers = {
    "Authorization": `Bearer ${secretKey}`,
    "Content-Type": "application/json",
  };

  if (idempotencyKey) {
    headers["Idempotency-Key"] = String(idempotencyKey);
  }

  const response = await fetch(`${BASE_URL}/gateway`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  const requestId = response.headers.get("x-request-id") || "n/a";
  const retryAfter = response.headers.get("retry-after");

  let data;
  try {
    data = await response.json();
  } catch (err) {
    throw new Error(`Falha ao ler resposta da LofyPay (HTTP ${response.status}, request-id: ${requestId})`);
  }

  if (response.status === 429) {
    const erro = new Error("Limite de requisições atingido. Tente novamente em instantes.");
    erro.status = 429;
    erro.retryAfter = retryAfter;
    erro.requestId = requestId;
    throw erro;
  }

  // ATENÇÃO: HTTP 200 NÃO garante sucesso. Trate como sucesso só se status for "success" (ou "OK") E vier idTransaction.
  const isSuccess = (data.status === "success" || data.status === "OK") && Boolean(data.idTransaction);

  if (!response.ok || !isSuccess) {
    const mensagemErro = data.message || data.error || (data.status === "error" ? data.message : null) || `Erro ao gerar PIX (HTTP ${response.status})`;
    const erro = new Error(mensagemErro);
    erro.status = response.status;
    erro.requestId = requestId;
    erro.details = data;
    throw erro;
  }

  return {
    idTransaction: data.idTransaction,
    paymentCode: data.paymentCode,
    paymentCodeBase64: data.paymentCodeBase64 || null,
    amount: body.amount,
    external_reference: body.external_reference,
    expiration: body.expiration,
    requestId,
  };
}

/**
 * Consulta o status da transação na LofyPay (fonte da verdade).
 * Status possíveis: WAITING_FOR_APPROVAL, PAID_OUT, EXPIRED, REFUNDED, FAILED.
 */
async function consultarStatus(idTransaction) {
  if (!idTransaction) {
    throw new Error("idTransaction é obrigatório para consultar status.");
  }

  const secretKey = getSecretKey();

  const response = await fetch(`${BASE_URL}/status`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${secretKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ idtransaction: String(idTransaction) }),
  });

  const requestId = response.headers.get("x-request-id") || "n/a";

  let data;
  try {
    data = await response.json();
  } catch (err) {
    throw new Error(`Falha ao ler status da LofyPay (HTTP ${response.status}, request-id: ${requestId})`);
  }

  if (!response.ok) {
    const erro = new Error(data.message || `Erro ao consultar status (HTTP ${response.status})`);
    erro.status = response.status;
    erro.requestId = requestId;
    throw erro;
  }

  return {
    status: data.status, // Ex: "PAID_OUT", "WAITING_FOR_APPROVAL"
    idTransaction,
    isPaid: data.status === "PAID_OUT",
    requestId,
  };
}

/**
 * Validação do Webhook Canal B (Assinado)
 * Headers: X-LofyPay-Signature = "t=<unix>,v1=<hex>"
 * HMAC-SHA256 sobre "<t>.<corpo cru>"
 */
function verificarAssinaturaWebhook(rawBody, signatureHeader, secret) {
  if (!signatureHeader || !secret) return false;

  try {
    const parts = Object.fromEntries(
      signatureHeader.split(",").map(p => {
        const idx = p.indexOf("=");
        return [p.slice(0, idx), p.slice(idx + 1)];
      })
    );

    if (!parts.t || !parts.v1) return false;

    // Rejeitar se |agora - t| > 300 segundos
    const timestamp = Number(parts.t);
    const agora = Math.floor(Date.now() / 1000);
    if (Math.abs(agora - timestamp) > 300) {
      return false;
    }

    const esperado = crypto
      .createHmac("sha256", secret)
      .update(parts.t + "." + rawBody)
      .digest("hex");

    const bufEsperado = Buffer.from(esperado, "hex");
    const bufRecebido = Buffer.from(parts.v1, "hex");

    if (bufEsperado.length !== bufRecebido.length) return false;
    return crypto.timingSafeEqual(bufEsperado, bufRecebido);
  } catch (err) {
    return false;
  }
}

module.exports = {
  criarCobrancaPix,
  consultarStatus,
  verificarAssinaturaWebhook,
};
