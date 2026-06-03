const { isRateLimitError, sleep } = require("../../domain/rate-limit");

function createRetryableInvoker(model, options) {
  const rateLimitRetries = Number(options?.rateLimitRetries || 0);
  const rateLimitBackoffMs = Number(options?.rateLimitBackoffMs || 1000);
  const onRetry = typeof options?.onRetry === "function" ? options.onRetry : null;

  return async function invoke(messages) {
    for (let attempt = 0; attempt <= rateLimitRetries; attempt += 1) {
      try {
        return await model.invoke(messages);
      } catch (err) {
        if (!isRateLimitError(err) || attempt >= rateLimitRetries) {
          throw err;
        }

        const backoff = rateLimitBackoffMs * Math.pow(2, attempt);
        if (onRetry) {
          onRetry(attempt + 1, backoff);
        }
        await sleep(backoff);
      }
    }

    throw new Error("Rate-limit retries exhausted");
  };
}

module.exports = {
  createRetryableInvoker
};
