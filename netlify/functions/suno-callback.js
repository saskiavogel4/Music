// Suno API requires a callBackUrl on every task. The app polls for results instead,
// so this endpoint simply acknowledges the webhook.
exports.handler = async () => ({
  statusCode: 200,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ received: true }),
});
