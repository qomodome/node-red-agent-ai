const ZAI_DEFAULT_BASE_URL = "https://api.z.ai/api/paas/v4";
const ZAI_DEFAULT_MODEL = "glm-5.2";
const AZURE_OPENAI_DEFAULT_API_VERSION = "2024-10-21";

// Accepts a single params object so providers that need more than a region
// (Azure, z.ai) can receive their own config without growing the positional list.
async function createLangChainModel(params) {
  const {
    provider,
    modelName,
    secrets = {},
    region,
    azure = {},
    zai = {}
  } = params || {};

  const providerKey = String(provider || "openai").trim().toLowerCase();

  if (providerKey === "openai" || providerKey === "gpt") {
    const { ChatOpenAI } = await import("@langchain/openai");
    if (!secrets.openaiApiKey) {
      throw new Error("Missing OpenAI API key in ai-agent-config");
    }

    return new ChatOpenAI({
      apiKey: secrets.openaiApiKey,
      model: modelName || "gpt-5.4-mini"
    });
  }

  if (providerKey === "gemini" || providerKey === "google") {
    const { ChatGoogleGenerativeAI } = await import("@langchain/google-genai");
    if (!secrets.googleApiKey) {
      throw new Error("Missing Google API key in ai-agent-config");
    }

    return new ChatGoogleGenerativeAI({
      apiKey: secrets.googleApiKey,
      model: modelName || "gemini-3.5-flash"
    });
  }

  if (providerKey === "bedrock" || providerKey === "aws") {
    const { ChatBedrockConverse } = await import("@langchain/aws");
    const hasAccessKeyId = Boolean(secrets.awsAccessKeyId);
    const hasSecretAccessKey = Boolean(secrets.awsSecretAccessKey);

    if (hasAccessKeyId !== hasSecretAccessKey) {
      throw new Error("Provide both AWS Access Key ID and Secret Access Key, or leave both empty to use IAM role credentials");
    }

    const bedrockOptions = {
      model: modelName || "anthropic.claude-opus-4-8",
      region: region || "us-east-1"
    };

    if (hasAccessKeyId && hasSecretAccessKey) {
      bedrockOptions.credentials = {
        accessKeyId: secrets.awsAccessKeyId,
        secretAccessKey: secrets.awsSecretAccessKey,
        sessionToken: secrets.awsSessionToken || undefined
      };
    }

    return new ChatBedrockConverse(bedrockOptions);
  }

  // z.ai (GLM) — OpenAI-compatible API reached through a custom base URL.
  if (providerKey === "zai" || providerKey === "z.ai" || providerKey === "glm") {
    const { ChatOpenAI } = await import("@langchain/openai");
    if (!secrets.zaiApiKey) {
      throw new Error("Missing z.ai API key in ai-agent-config");
    }

    const baseURL = String(zai.baseUrl || "").trim() || ZAI_DEFAULT_BASE_URL;

    return new ChatOpenAI({
      apiKey: secrets.zaiApiKey,
      model: modelName || ZAI_DEFAULT_MODEL,
      configuration: { baseURL }
    });
  }

  // Azure OpenAI Service — first-party deployments via AzureChatOpenAI.
  if (providerKey === "azure" || providerKey === "azure-openai") {
    const { AzureChatOpenAI } = await import("@langchain/openai");
    if (!secrets.azureOpenAIApiKey) {
      throw new Error("Missing Azure OpenAI API key in ai-agent-config");
    }

    const endpoint = String(azure.endpoint || "").trim();
    const deployment = String(azure.deployment || "").trim();

    if (!endpoint) {
      throw new Error("Missing Azure OpenAI endpoint in ai-agent node (e.g. https://<resource>.openai.azure.com)");
    }
    if (!deployment) {
      throw new Error("Missing Azure OpenAI deployment name in ai-agent node");
    }

    return new AzureChatOpenAI({
      azureOpenAIApiKey: secrets.azureOpenAIApiKey,
      azureOpenAIEndpoint: endpoint,
      azureOpenAIApiDeploymentName: deployment,
      azureOpenAIApiVersion: String(azure.apiVersion || "").trim() || AZURE_OPENAI_DEFAULT_API_VERSION,
      model: modelName || deployment
    });
  }

  // Azure AI Foundry / Model Inference — OpenAI-compatible endpoint.
  // Sends the key both as a Bearer token and as an `api-key` header so it
  // works with key-authenticated Foundry and serverless inference endpoints.
  if (providerKey === "azure-ai" || providerKey === "azureai" || providerKey === "azure-inference") {
    const { ChatOpenAI } = await import("@langchain/openai");
    if (!secrets.azureAiApiKey) {
      throw new Error("Missing Azure AI API key in ai-agent-config");
    }

    const endpoint = String(azure.aiEndpoint || "").trim();
    if (!endpoint) {
      throw new Error("Missing Azure AI Inference endpoint in ai-agent node (e.g. https://<resource>.services.ai.azure.com/models)");
    }

    const configuration = {
      baseURL: endpoint,
      defaultHeaders: { "api-key": secrets.azureAiApiKey }
    };

    const apiVersion = String(azure.aiApiVersion || "").trim();
    if (apiVersion) {
      configuration.defaultQuery = { "api-version": apiVersion };
    }

    return new ChatOpenAI({
      apiKey: secrets.azureAiApiKey,
      model: modelName || "",
      configuration
    });
  }

  throw new Error("Unsupported provider: " + providerKey);
}

module.exports = {
  createLangChainModel
};
