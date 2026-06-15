const {
  DEFAULT_MAX_DURATION_MS,
  DEFAULT_MAX_ITERATIONS,
  DEFAULT_MAX_TOOL_CALLS
} = require("../domain/agent-constants");
const { executeReasoningLoop, extractImageOutput } = require("../domain/agent-loop");
const { createRetryableInvoker } = require("../adapters/llm/retryable-model");

async function runAgentUseCase(options) {
  const {
    model,
    mcpManager,
    input,
    systemPrompt,
    modelType = "text",
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

  // ── Image path: single direct invocation, no reasoning loop ──────
  if (modelType === "image") {
    const startTs = Date.now();
    const messages = [];
    if (systemPrompt && String(systemPrompt).trim()) {
      messages.push({ role: "system", content: systemPrompt });
    }
    messages.push({ role: "user", content: input });

    const response = await invokeModel(messages);
    
    // Debug: log raw response structure for troubleshooting
    if (typeof onModelAction === "function") {
      onModelAction({
        iteration: 0,
        rawModelText: JSON.stringify(response).slice(0, 500),
        action: null
      });
    }
    
    const imageOutput = extractImageOutput(response);

    if (!imageOutput || !imageOutput.base64) {
      const errorMsg = imageOutput && imageOutput.text
        ? `Image model did not generate image. Response: ${imageOutput.text}`
        : "Image model returned no usable output";
      throw new Error(errorMsg);
    }

    return {
      output: imageOutput,
      trace: [
        {
          iteration: 1,
          type: "image",
          mimeType: imageOutput.mimeType,
          outputLength: imageOutput.base64.length
        }
      ],
      usage: { iterations: 1, toolCalls: 0, durationMs: Date.now() - startTs }
    };
  }

  // ── Text/agent path: reasoning loop (unchanged) ───────────────────
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
