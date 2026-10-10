const { consultarStatus } = require("./_lofypay");

module.exports = async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const idTransaction =
    (req.body && req.body.idTransaction) ||
    (req.query && req.query.idTransaction) ||
    null;

  if (!idTransaction) {
    return res.status(400).json({
      success: false,
      message: "idTransaction não informado.",
    });
  }

  try {
    const resultado = await consultarStatus(idTransaction);

    return res.status(200).json({
      success: true,
      status: resultado.status, // "PAID_OUT", "WAITING_FOR_APPROVAL", "EXPIRED", etc.
      isPaid: resultado.isPaid,
      idTransaction,
    });
  } catch (error) {
    console.error("[LofyPay check-status error]", {
      idTransaction,
      message: error.message,
      requestId: error.requestId,
    });

    return res.status(error.status || 500).json({
      success: false,
      message: error.message || "Erro ao consultar status do pagamento.",
      requestId: error.requestId || null,
    });
  }
};
