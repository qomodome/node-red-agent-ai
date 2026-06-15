const {
  DEFAULT_MAX_DURATION_MS,
  DEFAULT_MAX_ITERATIONS,
  DEFAULT_MAX_TOOL_CALLS
} = require("./agent-constants");

function extractText(response) {
  if (!response) return "";
  if (typeof response === "string") return response;
  if (typeof response.content === "string") return response.content;

  if (Array.isArray(response.content)) {
    return response.content
      .map((part) => {
        if (typeof part === "string") return part;
        if (part && typeof part.text === "string") return part.text;
        return "";
      })
      .join("\n")
      .trim();
  }

  return "";
}

function extractJsonObject(text) {
  const source = String(text || "").trim();
  if (!source) return null;

  let start = -1;
  let depth = 0;

  for (let i = 0; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === "{") {
      if (start === -1) start = i;
      depth += 1;
    } else if (ch === "}") {
      depth -= 1;
      if (depth === 0 && start !== -1) {
        const candidate = source.slice(start, i + 1);
        try {
          return JSON.parse(candidate);
        } catch {
            console.warn("Failed to parse JSON candidate from model response:", candidate);
          // Keep scanning.
        }
      }
    }
  }

  return null;
}

function toAction(modelText) {
  const parsed = extractJsonObject(modelText);
  if (!parsed || typeof parsed !== "object") return null;

  if (parsed.type === "final" && typeof parsed.output === "string") {
    return {
      type: "final",
      output: parsed.output
    };
  }

  if (
    parsed.type === "tool_call" &&
    typeof parsed.tool === "string" &&
    parsed.tool.trim() !== "" &&
    parsed.arguments &&
    typeof parsed.arguments === "object" &&
    !Array.isArray(parsed.arguments)
  ) {
    return {
      type: "tool_call",
      tool: parsed.tool.trim(),
      arguments: parsed.arguments,
      thought: typeof parsed.thought === "string" ? parsed.thought : ""
    };
  }

  return null;
}

function buildSystemPrompt(availableTools, customSystemPrompt) {
  const toolLines = availableTools.length
    ? availableTools
        .map((tool) => {
          const schema = tool.inputSchema ? JSON.stringify(tool.inputSchema) : "{}";
          return "- " + tool.name + ": " + (tool.description || "No description") + " | inputSchema=" + schema;
        })
        .join("\n")
    : "- no tools available";

  const basePrompt = [
    "You are an AI agent running in Node-RED.",
    "You can think step-by-step and optionally call tools.",
    "Always respond in strict JSON with one of these shapes:",
    '{"type":"tool_call","tool":"<name>","arguments":{...},"thought":"short reason"}',
    '{"type":"final","output":"final answer for user"}',
    "Never output anything outside JSON.",
    "Available tools:",
    toolLines
  ].join("\n");

  const custom = String(customSystemPrompt || "").trim();
  if (!custom) {
    return basePrompt;
  }

  return [
    basePrompt,
    "Additional system instructions from node configuration:",
    custom,
    "These additional instructions must still respect the strict JSON output contract above."
  ].join("\n\n");
}

async function executeReasoningLoop(options) {
  const {
    invokeModel,
    invokeTool,
    input,
    systemPrompt,
    tools,
    maxIterations = DEFAULT_MAX_ITERATIONS,
    maxToolCalls = DEFAULT_MAX_TOOL_CALLS,
    maxDurationMs = DEFAULT_MAX_DURATION_MS,
    onModelAction
  } = options;

  const startTs = Date.now();
  let toolCalls = 0;

  const messages = [
    { role: "system", content: buildSystemPrompt(tools, systemPrompt) },
    { role: "user", content: input }
  ];

  const trace = [];

  for (let iteration = 1; iteration <= maxIterations; iteration += 1) {
    if (Date.now() - startTs > maxDurationMs) {
      throw new Error("Agent timeout: maxDurationMs exceeded");
    }

    const modelResponse = await invokeModel(messages);
    const modelText = extractText(modelResponse);
    const action = toAction(modelText);

    if (typeof onModelAction === "function") {
      onModelAction({
        iteration,
        rawModelText: modelText,
        action: action || null
      });
    }

    if (!action) {
      throw new Error("Model response is not valid JSON action");
    }

    if (action.type === "final") {
      trace.push({
        iteration,
        type: "final",
        output: action.output
      });

      return {
        output: action.output,
        trace,
        usage: {
          iterations: iteration,
          toolCalls,
          durationMs: Date.now() - startTs
        }
      };
    }

    if (toolCalls >= maxToolCalls) {
      throw new Error("Agent limit exceeded: maxToolCalls reached");
    }

    const toolName = action.tool;
    const toolResult = await invokeTool(toolName, action.arguments);
    toolCalls += 1;

    trace.push({
      iteration,
      type: "tool_call",
      thought: action.thought,
      tool: toolName,
      arguments: action.arguments,
      result: toolResult
    });

    messages.push({ role: "assistant", content: modelText });
    messages.push({
      role: "user",
      content: JSON.stringify({
        type: "tool_result",
        tool: toolName,
        result: toolResult
      })
    });
  }

  throw new Error("Agent limit exceeded: maxIterations reached");
}

function extractImageOutput(response) {
  if (!response) return { base64: null, mimeType: null, text: null, textOnly: false };

  const parts = Array.isArray(response.content) ? response.content : [];

  for (const part of parts) {
    if (!part || typeof part !== "object") continue;

    // OpenAI-style: {type:"image_url", image_url:{url:"data:image/TYPE;base64,DATA"}}
    if (part.type === "image_url" && part.image_url && typeof part.image_url.url === "string") {
      const url = part.image_url.url;
      const match = url.match(/^data:(image\/[^;]+);base64,(.+)$/);
      if (match) {
        return { base64: match[2], mimeType: match[1], text: null, textOnly: false };
      }
      return { base64: url, mimeType: "image/png", text: null, textOnly: false };
    }

    // Anthropic/Bedrock-style: {type:"image", source:{type:"base64", media_type:"TYPE", data:"DATA"}}
    if (
      part.type === "image" &&
      part.source &&
      part.source.type === "base64" &&
      typeof part.source.data === "string"
    ) {
      return {
        base64: part.source.data,
        mimeType: part.source.media_type || "image/png",
        text: null,
        textOnly: false
      };
    }

    // LangChain Gemini media-part style: {type:"media", mimeType:"image/TYPE", data:"BASE64"}
    if (part.type === "media" && typeof part.data === "string" && part.data.length > 0) {
      return {
        base64: part.data,
        mimeType: (typeof part.mimeType === "string" && part.mimeType) || "image/png",
        text: null,
        textOnly: false
      };
    }

    // Raw Gemini API inline-data style: {inlineData:{mimeType:"TYPE", data:"BASE64"}}
    if (part.inlineData && typeof part.inlineData.data === "string" && part.inlineData.data.length > 0) {
      return {
        base64: part.inlineData.data,
        mimeType: (typeof part.inlineData.mimeType === "string" && part.inlineData.mimeType) || "image/png",
        text: null,
        textOnly: false
      };
    }
  }

  // Fallback: model returned text instead of image
  const text = extractText(response);
  return {
    base64: null,
    mimeType: null,
    text: text || null,
    textOnly: true
  };
}

module.exports = {
  executeReasoningLoop,
  extractJsonObject,
  extractText,
  extractImageOutput
};
