class McpClientManager {
  constructor(serverConfigs) {
    this.serverConfigs = serverConfigs;
    this.connections = [];
    this.tools = new Map();
  }

  async connect() {
    const sdk = await import("@modelcontextprotocol/sdk/client/index.js");
    const sseMod = await import("@modelcontextprotocol/sdk/client/sse.js");
    const streamableHttpMod = await import("@modelcontextprotocol/sdk/client/streamableHttp.js");
    const stdioMod = await import("@modelcontextprotocol/sdk/client/stdio.js");

    for (const cfg of this.serverConfigs) {
      const client = new sdk.Client(
        {
          name: "node-red-ai-agent",
          version: "0.1.0"
        },
        {
          capabilities: {
            tools: {}
          }
        }
      );

      let transport;
      if (cfg.transport === "sse") {
        transport = new sseMod.SSEClientTransport(new URL(cfg.url));
      } else if (cfg.transport === "stdio") {
        transport = new stdioMod.StdioClientTransport({
          command: cfg.command,
          args: cfg.args,
          env: cfg.env
        });
      } else {
        transport = new streamableHttpMod.StreamableHTTPClientTransport(new URL(cfg.url));
      }

      await client.connect(transport);

      const listResult = await client.listTools({});
      const tools = Array.isArray(listResult?.tools) ? listResult.tools : [];

      for (const tool of tools) {
        const qualifiedName = cfg.name + "." + tool.name;
        this.tools.set(qualifiedName, {
          toolName: tool.name,
          description: tool.description || "",
          inputSchema: tool.inputSchema || {},
          client
        });
      }

      this.connections.push({ client });
    }
  }

  getToolManifest() {
    return Array.from(this.tools.entries()).map(([name, tool]) => ({
      name,
      description: tool.description,
      inputSchema: tool.inputSchema
    }));
  }

  async callTool(name, args) {
    const target = this.tools.get(name);
    if (!target) {
      throw new Error("Unknown MCP tool: " + name);
    }

    const result = await target.client.callTool({
      name: target.toolName,
      arguments: args || {}
    });

    if (result?.structuredContent !== undefined) {
      return result.structuredContent;
    }

    if (Array.isArray(result?.content)) {
      return result.content;
    }

    return result;
  }

  async close() {
    for (const connection of this.connections) {
      try {
        await connection.client.close();
      } catch {
        // Ignore close errors.
      }
    }
  }
}

module.exports = {
  McpClientManager
};
