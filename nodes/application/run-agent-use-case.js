const {
  DEFAULT_MAX_DURATION_MS,
  DEFAULT_MAX_ITERATIONS,
  DEFAULT_MAX_TOOL_CALLS
} = require("../domain/agent-constants");
const { executeReasoningLoop } = require("../domain/agent-loop");
const { createRetryableInvoker } = require("../adapters/llm/retryable-model");

async function runAgentUseCase(options) {
  const {
    model,
    mcpManager,
    input,
    systemPrompt,
    maxIterations = DEFAULT_MAX_ITERATIONS,
    maxToolCalls = DEFAULT_MAX_TOOL_CALLS,
    maxDurationMs = DEFAULT_MAX_DURATION_MS,
    rateLimitRetries,
    rateLimitBackoffMs,
    onRateLimitRetry,
    onModelAction,
    onToolCall
  } = options;

  const invokeModel = createRetryableInvoker(model, {
    rateLimitRetries,
    rateLimitBackoffMs,
    onRetry: onRateLimitRetry
  });

  return executeReasoningLoop({
    invokeModel,
    invokeTool: async (toolName, toolArgs) => {
      if (typeof onToolCall === "function") {
        onToolCall({ phase: "start", toolName, toolArgs });
      }

      try {
        const result = await mcpManager.callTool(toolName, toolArgs);
        if (typeof onToolCall === "function") {
          onToolCall({ phase: "result", toolName, result });
        }
        return result;
      } catch (error) {
        if (typeof onToolCall === "function") {
          onToolCall({ phase: "error", toolName, error });
        }
        throw error;
      }
    },
    input,
    systemPrompt,
    tools: mcpManager.getToolManifest(),
    maxIterations,
    maxToolCalls,
    maxDurationMs,
    onModelAction
  });
}

module.exports = {
  runAgentUseCase
};
