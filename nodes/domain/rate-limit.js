function isRateLimitError(err) {
  if (!err) return false;

  const status = err.status || err.statusCode || err.response?.status;
  if (status === 429) return true;

  const code = String(err.code || "").toLowerCase();
  if (code.includes("rate")) return true;

  const message = String(err.message || "").toLowerCase();
  return message.includes("rate limit") || message.includes("too many requests") || message.includes("429");
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

module.exports = {
  isRateLimitError,
  sleep
};
