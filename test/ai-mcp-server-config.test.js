const test = require("node:test");
const assert = require("node:assert/strict");

const mcpServerConfigModule = require("../nodes/ai-mcp-server-config");
const { resolveMcpServerConfigs } = require("../nodes/adapters/nodered/input-mapper");

function buildRedMock() {
  const registry = {};

  return {
    registry,
    nodes: {
      createNode(node, config) {
        node.id = "node-id";
        node.name = config.name;
      },
      registerType(type, ctor) {
        registry[type] = { ctor };
      }
    }
  };
}

function makeConfigNode(config) {
  const RED = buildRedMock();
  mcpServerConfigModule(RED);
  const Ctor = RED.registry["ai-mcp-server-config"].ctor;
  return new Ctor(config);
}

test("registers ai-mcp-server-config type", () => {
  const RED = buildRedMock();
  mcpServerConfigModule(RED);
  assert.ok(RED.registry["ai-mcp-server-config"]);
});

test("getServerConfig returns normalized object for streamableHttp", () => {
  const node = makeConfigNode({
    name: "my-tools",
    transport: "streamableHttp",
    url: " http://127.0.0.1:3000/mcp ",
    command: "",
    argsRaw: "",
    envJson: "{}"
  });

  const cfg = node.getServerConfig();
  assert.equal(cfg.name, "my-tools");
  assert.equal(cfg.transport, "streamableHttp");
  assert.equal(cfg.url, "http://127.0.0.1:3000/mcp");
  assert.deepEqual(cfg.args, []);
  assert.deepEqual(cfg.env, {});
});

test("getServerConfig returns normalized object for stdio", () => {
  const node = makeConfigNode({
    name: "local-stdio",
    transport: "stdio",
    url: "",
    command: "npx",
    argsRaw: "-y\n@my/mcp-server\n--port=3001",
    envJson: '{"API_KEY": "abc"}'
  });

  const cfg = node.getServerConfig();
  assert.equal(cfg.transport, "stdio");
  assert.equal(cfg.command, "npx");
  assert.deepEqual(cfg.args, ["-y", "@my/mcp-server", "--port=3001"]);
  assert.deepEqual(cfg.env, { API_KEY: "abc" });
});

test("getServerConfig tolerates invalid envJson and returns empty env", () => {
  const node = makeConfigNode({
    name: "bad-env",
    transport: "sse",
    url: "http://localhost/sse",
    command: "",
    argsRaw: "",
    envJson: "INVALID_JSON"
  });

  const cfg = node.getServerConfig();
  assert.deepEqual(cfg.env, {});
});

test("resolveMcpServerConfigs resolves IDs to server configs", () => {
  const node = makeConfigNode({
    name: "test-server",
    transport: "streamableHttp",
    url: "http://localhost/mcp",
    command: "",
    argsRaw: "",
    envJson: "{}"
  });

  const getNodeFn = (id) => (id === "cfg-001" ? node : null);
  const configs = resolveMcpServerConfigs(["cfg-001"], getNodeFn);
  assert.equal(configs.length, 1);
  assert.equal(configs[0].name, "test-server");
});

test("resolveMcpServerConfigs throws on unknown ID", () => {
  const getNodeFn = () => null;
  assert.throws(
    () => resolveMcpServerConfigs(["missing-id"], getNodeFn),
    /MCP server config node not found: missing-id/
  );
});

test("resolveMcpServerConfigs returns empty array for empty input", () => {
  const result = resolveMcpServerConfigs([], () => null);
  assert.deepEqual(result, []);
});
