async function createLangChainModel(provider, modelName, temperature, secrets, region) {
  const providerKey = String(provider || "openai").trim().toLowerCase();

  if (providerKey === "openai" || providerKey === "gpt") {
    const { ChatOpenAI } = await import("@langchain/openai");
    if (!secrets.openaiApiKey) {
      throw new Error("Missing OpenAI API key in ai-agent-config");
    }

    return new ChatOpenAI({
      apiKey: secrets.openaiApiKey,
      model: modelName || "gpt-4o-mini",
      temperature
    });
  }

  if (providerKey === "gemini" || providerKey === "google") {
    const { ChatGoogleGenerativeAI } = await import("@langchain/google-genai");
    if (!secrets.googleApiKey) {
      throw new Error("Missing Google API key in ai-agent-config");
    }

    return new ChatGoogleGenerativeAI({
      apiKey: secrets.googleApiKey,
      model: modelName || "gemini-1.5-flash",
      temperature
    });
  }

  if (providerKey === "bedrock" || providerKey === "aws") {
    const { ChatBedrockConverse } = await import("@langchain/aws");
    if (!secrets.awsAccessKeyId || !secrets.awsSecretAccessKey) {
      throw new Error("Missing AWS credentials in ai-agent-config");
    }

    return new ChatBedrockConverse({
      model: modelName || "anthropic.claude-3-5-sonnet-20240620-v1:0",
      region: region || "us-east-1",
      credentials: {
        accessKeyId: secrets.awsAccessKeyId,
        secretAccessKey: secrets.awsSecretAccessKey,
        sessionToken: secrets.awsSessionToken || undefined
      },
      temperature
    });
  }

  throw new Error("Unsupported provider: " + providerKey);
}

module.exports = {
  createLangChainModel
};
