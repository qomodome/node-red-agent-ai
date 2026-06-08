async function createLangChainModel(provider, modelName, secrets, region) {
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

  throw new Error("Unsupported provider: " + providerKey);
}

module.exports = {
  createLangChainModel
};
