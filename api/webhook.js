const { consultarStatus, verificarAssinaturaWebhook } = require("./_lofypay");
const { enviarEventoMetaCapi } = require("./_meta");

// Cache de idTransactions já marcadas como pagas nesta execução (deduplicação em memória)
const transacoesConfirmadas = new Set();
const entregasProcessadas = new Set();

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Método não permitido." });
  }

  // IDs de deduplicação dos headers da LofyPay
  const deliveryId  = req.headers["x-lofypay-id"];
  const signature   = req.headers["x-lofypay-signature"];

  // 1. Idempotência por X-LofyPay-Id
  if (deliveryId && entregasProcessadas.has(deliveryId)) {
    return res.status(200).json({ received: true, deduplicated: true });
  }

  // 2. Validação de assinatura (Canal B) – se vier o header e o secret estiver configurado
  const webhookSecret = process.env.LOFYPAY_WEBHOOK_SECRET;
  if (signature && webhookSecret) {
    // Vercel parseia o body automaticamente; precisamos do raw body para HMAC
    // O raw body é exposto via req.rawBody quando bodyParser está desabilitado
    // Usamos JSON.stringify(req.body) como fallback (funciona quando não há diferença de formatação)
    const rawBody = req.rawBody
      || (typeof req.body === "string" ? req.body : JSON.stringify(req.body));

    const assinaturaValida = verificarAssinaturaWebhook(rawBody, signature, webhookSecret);
    if (!assinaturaValida) {
      console.warn("[LofyPay Webhook] Assinatura inválida rejeitada.", {
        deliveryId,
        signature: signature?.slice(0, 40),
      });
      return res.status(401).json({ message: "Assinatura do webhook inválida." });
    }
  }

  // Responde 200 IMEDIATAMENTE (LofyPay exige resposta em até 8 s)
  // Processamento real acontece assincronamente depois
  res.status(200).json({ received: true });

  // 3. Extrair idTransaction do payload (Canal A ou B)
  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch (_) {}
  }

  let idTransaction = null;
  let externalReference = null;

  if (body && body.event && body.data) {
    // Canal B (assinado, evento tipado)
    idTransaction = body.data.idTransaction;
    externalReference = body.data.external_reference;
  } else if (body) {
    // Canal A (notification_url por cobrança)
    idTransaction = body.idTransaction || body.idtransaction;
    externalReference = body.external_reference;
  }

  if (!idTransaction) {
    console.warn("[LofyPay Webhook] idTransaction ausente no payload.");
    return;
  }

  // 4. Deduplicação por idTransaction (não entregar duas vezes)
  if (transacoesConfirmadas.has(idTransaction)) {
    console.log(`[LofyPay Webhook] Transação ${idTransaction} já processada. Ignorando.`);
    return;
  }

  try {
    // 5. SEMPRE confirma no /status antes de liberar (regra de segurança obrigatória)
    const consulta = await consultarStatus(idTransaction);
    console.log(`[LofyPay Webhook] ${idTransaction} status: ${consulta.status} | ref: ${externalReference || "—"}`);

    if (consulta.isPaid) {
      // IDEMPOTÊNCIA: marcar antes de qualquer ação de entrega
      transacoesConfirmadas.add(idTransaction);
      if (deliveryId) entregasProcessadas.add(deliveryId);

      // ✅ PAGAMENTO CONFIRMADO COM SEGURANÇA
      console.log(`[LofyPay Webhook] ✅ PAGO: ${idTransaction} | ref: ${externalReference}`);

      // Dispara Purchase via Meta Conversions API (CAPI)
      enviarEventoMetaCapi({
        eventName: "Purchase",
        eventId: idTransaction,
        eventSourceUrl: "https://patacerta-five.vercel.app/checkout",
        customData: {
          value: consulta.amount || 67.00,
          currency: "BRL",
          content_name: "Plano PataCerta",
        },
      }).catch(err => console.warn("[Meta CAPI Webhook Error]", err.message));
    }
  } catch (err) {
    console.error("[LofyPay Webhook] Erro ao processar:", {
      idTransaction,
      message: err.message,
      requestId: err.requestId,
    });
  }
};
