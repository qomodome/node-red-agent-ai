const test = require("node:test");
const assert = require("node:assert/strict");

const { createLangChainModel } = require("../nodes/adapters/llm/langchain-provider-factory");

async function rejectsWith(promise, messagePart) {
  await assert.rejects(promise, (err) => {
    assert.match(err.message, new RegExp(messagePart, "i"));
    return true;
  });
}

// ── z.ai ────────────────────────────────────────────────────────────
test("zai throws when API key is missing", async () => {
  await rejectsWith(
    createLangChainModel({ provider: "zai", secrets: {} }),
    "Missing z.ai API key"
  );
});

test("zai builds a ChatOpenAI with default model", async () => {
  const model = await createLangChainModel({
    provider: "zai",
    secrets: { zaiApiKey: "zk" }
  });
  assert.equal(model.constructor.name, "ChatOpenAI");
  assert.equal(model.model, "glm-5.2");
});

test("zai honors model override", async () => {
  const model = await createLangChainModel({
    provider: "zai",
    modelName: "glm-4.6",
    secrets: { zaiApiKey: "zk" }
  });
  assert.equal(model.model, "glm-4.6");
});

// ── Azure OpenAI Service ─────────────────────────────────────────────
test("azure throws when API key is missing", async () => {
  await rejectsWith(
    createLangChainModel({ provider: "azure", secrets: {} }),
    "Missing Azure OpenAI API key"
  );
});

test("azure throws when endpoint is missing", async () => {
  await rejectsWith(
    createLangChainModel({
      provider: "azure",
      secrets: { azureOpenAIApiKey: "ak" },
      azure: { deployment: "dep" }
    }),
    "Missing Azure OpenAI endpoint"
  );
});

test("azure throws when deployment is missing", async () => {
  await rejectsWith(
    createLangChainModel({
      provider: "azure",
      secrets: { azureOpenAIApiKey: "ak" },
      azure: { endpoint: "https://r.openai.azure.com" }
    }),
    "Missing Azure OpenAI deployment"
  );
});

test("azure builds an AzureChatOpenAI when fully configured", async () => {
  const model = await createLangChainModel({
    provider: "azure",
    secrets: { azureOpenAIApiKey: "ak" },
    azure: { endpoint: "https://r.openai.azure.com", deployment: "dep" }
  });
  assert.equal(model.constructor.name, "AzureChatOpenAI");
});

// ── Azure AI Inference / Foundry ─────────────────────────────────────
test("azure-ai throws when API key is missing", async () => {
  await rejectsWith(
    createLangChainModel({ provider: "azure-ai", secrets: {} }),
    "Missing Azure AI API key"
  );
});

test("azure-ai throws when endpoint is missing", async () => {
  await rejectsWith(
    createLangChainModel({
      provider: "azure-ai",
      secrets: { azureAiApiKey: "ak" }
    }),
    "Missing Azure AI Inference endpoint"
  );
});

test("azure-ai builds a ChatOpenAI when endpoint is provided", async () => {
  const model = await createLangChainModel({
    provider: "azure-ai",
    secrets: { azureAiApiKey: "ak" },
    azure: { aiEndpoint: "https://r.services.ai.azure.com/models" }
  });
  assert.equal(model.constructor.name, "ChatOpenAI");
});

// ── Existing providers still resolve ────────────────────────────────
test("openai still builds with the params object signature", async () => {
  const model = await createLangChainModel({
    provider: "openai",
    secrets: { openaiApiKey: "sk" }
  });
  assert.equal(model.constructor.name, "ChatOpenAI");
});

test("unsupported provider throws", async () => {
  await rejectsWith(
    createLangChainModel({ provider: "nope", secrets: {} }),
    "Unsupported provider: nope"
  );
});
