const { criarCobrancaPix } = require("./_lofypay");

// Preços fixados no servidor para evitar adulteração no frontend
const PRECOS_PLANOS = {
  basico: { nome: "Plano Básico PataCerta", valor: 37.00 },
  premium: { nome: "Plano Premium PataCerta", valor: 67.00 },
};

function validarCpf(cpf) {
  const limpo = String(cpf || "").replace(/\D/g, "");
  if (limpo.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(limpo)) return false;

  let soma = 0;
  for (let i = 0; i < 9; i++) soma += parseInt(limpo.charAt(i)) * (10 - i);
  let resto = (soma * 10) % 11;
  if (resto === 10 || resto === 11) resto = 0;
  if (resto !== parseInt(limpo.charAt(9))) return false;

  soma = 0;
  for (let i = 0; i < 10; i++) soma += parseInt(limpo.charAt(i)) * (11 - i);
  resto = (soma * 10) % 11;
  if (resto === 10 || resto === 11) resto = 0;
  return resto === parseInt(limpo.charAt(10));
}

function validarEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || "").trim());
}

module.exports = async function handler(req, res) {
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ success: false, message: "Método não permitido." });
  }

  try {
    const { planId = "premium", client = {}, utms = {}, petName = "" } = req.body || {};

    const plano = PRECOS_PLANOS[planId] || PRECOS_PLANOS.premium;

    const nome = String(client.name || "").trim();
    const email = String(client.email || "").trim().toLowerCase();
    const documento = String(client.document || "").replace(/\D/g, "");

    if (!nome || nome.split(" ").length < 2) {
      return res.status(400).json({
        success: false,
        message: "Por favor, informe seu nome e sobrenome completos.",
      });
    }

    if (!validarEmail(email)) {
      return res.status(400).json({
        success: false,
        message: "E-mail inválido. O acesso ao plano será enviado para este e-mail.",
      });
    }

    if (!validarCpf(documento)) {
      return res.status(400).json({
        success: false,
        message: "CPF inválido. O Banco Central exige um CPF válido para emitir o QR Code Pix.",
      });
    }

    const externalRef = `PATA-${planId.toUpperCase()}-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

    // Base URL da aplicação para notification_url
    const host = req.headers["x-forwarded-host"] || req.headers.host;
    const proto = req.headers["x-forwarded-proto"] || "https";
    const notificationUrl = host ? `${proto}://${host}/api/webhook` : undefined;

    const resultado = await criarCobrancaPix({
      amount: plano.valor,
      client: {
        name: nome,
        email,
        document: documento,
      },
      external_reference: externalRef,
      notification_url: notificationUrl,
      expiration: 1800, // 30 minutos
      trackingParameters: {
        utm_source: utms.utm_source || null,
        utm_medium: utms.utm_medium || null,
        utm_campaign: utms.utm_campaign || null,
        utm_content: utms.utm_content || null,
        utm_term: utms.utm_term || null,
        src: utms.src || null,
        sck: utms.sck || null,
      },
      idempotencyKey: externalRef,
    });

    return res.status(200).json({
      success: true,
      idTransaction: resultado.idTransaction,
      paymentCode: resultado.paymentCode,
      paymentCodeBase64: resultado.paymentCodeBase64,
      amount: resultado.amount,
      planName: plano.nome,
      expiration: resultado.expiration,
      external_reference: externalRef,
      client: {
        name: nome,
        email,
      },
      petName: petName || "",
    });
  } catch (error) {
    console.error("[LofyPay create-pix error]", {
      message: error.message,
      requestId: error.requestId,
      status: error.status,
    });

    if (error.status === 429) {
      if (error.retryAfter) {
        res.setHeader("Retry-After", error.retryAfter);
      }
      return res.status(429).json({
        success: false,
        message: "Muitas tentativas simultâneas. Aguarde alguns segundos e tente novamente.",
      });
    }

    return res.status(error.status || 500).json({
      success: false,
      message: error.message || "Não foi possível gerar a chave PIX no momento. Tente novamente.",
      requestId: error.requestId || null,
    });
  }
};
