const test = require("node:test");
const assert = require("node:assert/strict");

const {
  executeReasoningLoop,
  extractJsonObject,
  extractImageOutput,
  normalizeInput,
  parseMcpServers
} = require("../nodes/runtime");

test("parseMcpServers accepts valid streamableHttp config", () => {
  const parsed = parseMcpServers(
    JSON.stringify([
      {
        name: "srv",
        transport: "streamableHttp",
        url: "http://localhost:3000/mcp"
      }
    ])
  );

  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].name, "srv");
});

test("normalizeInput supports payload string and payload.input", () => {
  assert.equal(normalizeInput({ payload: "hello" }), "hello");
  assert.equal(normalizeInput({ payload: { input: "world" } }), "world");
});

test("extractJsonObject returns first valid JSON object", () => {
  const parsed = extractJsonObject("foo {\"type\":\"final\",\"output\":\"ok\"} bar");
  assert.deepEqual(parsed, { type: "final", output: "ok" });
});

test("executeReasoningLoop performs tool call then final output", async () => {
  const modelOutputs = [
    '{"type":"tool_call","tool":"math.sum","arguments":{"a":1,"b":2},"thought":"Need sum"}',
    '{"type":"final","output":"Result is 3"}'
  ];

  const result = await executeReasoningLoop({
    invokeModel: async () => ({ content: modelOutputs.shift() }),
    invokeTool: async (tool, args) => {
      assert.equal(tool, "math.sum");
      assert.deepEqual(args, { a: 1, b: 2 });
      return { value: 3 };
    },
    input: "sum 1 and 2",
    tools: [
      {
        name: "math.sum",
        description: "sum two values",
        inputSchema: {
          type: "object",
          properties: {
            a: { type: "number" },
            b: { type: "number" }
          },
          required: ["a", "b"]
        }
      }
    ],
    maxIterations: 4,
    maxToolCalls: 4,
    maxDurationMs: 5000
  });

  assert.equal(result.output, "Result is 3");
  assert.equal(result.usage.toolCalls, 1);
  assert.equal(result.trace.length, 2);
});

test("extractImageOutput parses OpenAI image_url data-URI content block", () => {
  const response = {
    content: [
      {
        type: "image_url",
        image_url: { url: "data:image/png;base64,iVBORw0KGgo=" }
      }
    ]
  };
  const result = extractImageOutput(response);
  assert.equal(result.base64, "iVBORw0KGgo=");
  assert.equal(result.mimeType, "image/png");
  assert.equal(result.textOnly, false);
});

test("extractImageOutput parses Anthropic/Bedrock base64 image source", () => {
  const response = {
    content: [
      {
        type: "image",
        source: { type: "base64", media_type: "image/jpeg", data: "/9j/4AAQ=" }
      }
    ]
  };
  const result = extractImageOutput(response);
  assert.equal(result.base64, "/9j/4AAQ=");
  assert.equal(result.mimeType, "image/jpeg");
  assert.equal(result.textOnly, false);
});

test("extractImageOutput returns textOnly=true when model responds with text", () => {
  const response = {
    content: "Model response: I cannot generate images."
  };
  const result = extractImageOutput(response);
  assert.equal(result.base64, null);
  assert.equal(result.mimeType, null);
  assert.equal(result.text, "Model response: I cannot generate images.");
  assert.equal(result.textOnly, true);
});

test("extractImageOutput parses LangChain Gemini media part", () => {
  const response = {
    content: [{ type: "media", mimeType: "image/png", data: "abc123def=" }]
  };
  const result = extractImageOutput(response);
  assert.equal(result.base64, "abc123def=");
  assert.equal(result.mimeType, "image/png");
  assert.equal(result.textOnly, false);
});

test("extractImageOutput parses raw Gemini inlineData part", () => {
  const response = {
    content: [{ inlineData: { mimeType: "image/jpeg", data: "xyz789==" } }]
  };
  const result = extractImageOutput(response);
  assert.equal(result.base64, "xyz789==");
  assert.equal(result.mimeType, "image/jpeg");
  assert.equal(result.textOnly, false);
});

test("runAgentUseCase with modelType image throws when model returns text only", async () => {
  const { runAgentUseCase } = require("../nodes/application/run-agent-use-case");

  const fakeModel = {
    invoke: async () => ({
      content: "I cannot generate images, I can only analyze them."
    })
  };

  const fakeMcpManager = {
    getToolManifest: () => [],
    callTool: async () => { throw new Error("callTool must not be called in image mode"); }
  };

  try {
    await runAgentUseCase({
      model: fakeModel,
      mcpManager: fakeMcpManager,
      input: "A cat on a surfboard",
      systemPrompt: "",
      modelType: "image"
    });
    assert.fail("Expected error to be thrown");
  } catch (err) {
    assert(err.message.includes("Image model did not generate image"));
    assert(err.message.includes("I cannot generate images"));
  }
});
