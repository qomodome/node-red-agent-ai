const test = require("node:test");
const assert = require("node:assert/strict");

const {
  executeReasoningLoop,
  extractJsonObject,
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
