module.exports = function (RED) {
  function AiAgentConfigNode(config) {
    RED.nodes.createNode(this, config);

    this.name = config.name;

    this.getProviderSecrets = () => {
      const creds = this.credentials || {};
      return {
        openaiApiKey: typeof creds.openaiApiKey === "string" ? creds.openaiApiKey.trim() : "",
        googleApiKey: typeof creds.googleApiKey === "string" ? creds.googleApiKey.trim() : "",
        awsAccessKeyId: typeof creds.awsAccessKeyId === "string" ? creds.awsAccessKeyId.trim() : "",
        awsSecretAccessKey:
          typeof creds.awsSecretAccessKey === "string" ? creds.awsSecretAccessKey.trim() : "",
        awsSessionToken: typeof creds.awsSessionToken === "string" ? creds.awsSessionToken.trim() : "",
        zaiApiKey: typeof creds.zaiApiKey === "string" ? creds.zaiApiKey.trim() : "",
        azureOpenAIApiKey:
          typeof creds.azureOpenAIApiKey === "string" ? creds.azureOpenAIApiKey.trim() : "",
        azureAiApiKey: typeof creds.azureAiApiKey === "string" ? creds.azureAiApiKey.trim() : ""
      };
    };
  }

  RED.nodes.registerType("ai-agent-config", AiAgentConfigNode, {
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
};
