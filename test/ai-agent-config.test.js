const test = require("node:test");
const assert = require("node:assert/strict");

const configModule = require("../nodes/ai-agent-config");

function buildRedMock() {
  const registry = {};

  return {
    registry,
    nodes: {
      createNode(node, config) {
        node.id = "node-id";
        node.name = config.name;
      },
      registerType(type, ctor, opts) {
        registry[type] = { ctor, opts };
      }
    }
  };
}

test("registers ai-agent-config with credentials", () => {
  const RED = buildRedMock();
  configModule(RED);

  assert.ok(RED.registry["ai-agent-config"]);
  assert.deepEqual(RED.registry["ai-agent-config"].opts, {
    credentials: {
      openaiApiKey: { type: "password" },
      googleApiKey: { type: "password" },
      awsAccessKeyId: { type: "text" },
      awsSecretAccessKey: { type: "password" },
      awsSessionToken: { type: "password" },
      zaiApiKey: { type: "password" },
      azureOpenAIApiKey: { type: "password" },
      azureAiApiKey: { type: "password" }
    }
  });
});

test("getProviderSecrets trims values", () => {
  const RED = buildRedMock();
  configModule(RED);

  const Ctor = RED.registry["ai-agent-config"].ctor;
  const node = new Ctor({ name: "cfg" });

  node.credentials = {
    openaiApiKey: " sk-openai ",
    googleApiKey: " g-key ",
    awsAccessKeyId: " AKIA123 ",
    awsSecretAccessKey: " secret ",
    awsSessionToken: " token ",
    zaiApiKey: " zai-key ",
    azureOpenAIApiKey: " azure-openai-key ",
    azureAiApiKey: " azure-ai-key "
  };

  assert.deepEqual(node.getProviderSecrets(), {
    openaiApiKey: "sk-openai",
    googleApiKey: "g-key",
    awsAccessKeyId: "AKIA123",
    awsSecretAccessKey: "secret",
    awsSessionToken: "token",
    zaiApiKey: "zai-key",
    azureOpenAIApiKey: "azure-openai-key",
    azureAiApiKey: "azure-ai-key"
  });
});
