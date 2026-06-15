const {
  DEFAULT_MAX_DURATION_MS,
  DEFAULT_MAX_ITERATIONS,
  DEFAULT_MAX_TOOL_CALLS
} = require("./domain/agent-constants");
const { executeReasoningLoop, extractJsonObject, extractText, extractImageOutput } = require("./domain/agent-loop");
const { isRateLimitError, sleep } = require("./domain/rate-limit");
const { normalizeInput, parseMcpServers } = require("./adapters/nodered/input-mapper");

module.exports = {
  DEFAULT_MAX_ITERATIONS,
  DEFAULT_MAX_TOOL_CALLS,
  DEFAULT_MAX_DURATION_MS,
  executeReasoningLoop,
  extractJsonObject,
  extractText,
  extractImageOutput,
  isRateLimitError,
  normalizeInput,
  parseMcpServers,
  sleep
};
