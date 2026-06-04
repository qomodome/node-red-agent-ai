class McpClientManager {
  constructor(serverConfigs) {
    this.serverConfigs = serverConfigs;
    this.connections = [];
    this.tools = new Map();
    this._sdk = null;
    this._sseMod = null;
    this._streamableHttpMod = null;
    this._stdioMod = null;
  }

  async connect() {
    this._sdk = await import("@modelcontextprotocol/sdk/client/index.js");
    this._sseMod = await import("@modelcontextprotocol/sdk/client/sse.js");
    this._streamableHttpMod = await import("@modelcontextprotocol/sdk/client/streamableHttp.js");
    this._stdioMod = await import("@modelcontextprotocol/sdk/client/stdio.js");

    for (const cfg of this.serverConfigs) {
      const client = await this._createConnectedClient(cfg);
      const listResult = await client.listTools({});
      this._registerServerTools(cfg, client, listResult);
      this.connections.push({ cfg, client });
    }
  }

  async _createConnectedClient(cfg) {
    const client = new this._sdk.Client(
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
      transport = new this._sseMod.SSEClientTransport(new URL(cfg.url));
    } else if (cfg.transport === "stdio") {
      transport = new this._stdioMod.StdioClientTransport({
        command: cfg.command,
        args: cfg.args,
        env: cfg.env
      });
    } else {
      transport = new this._streamableHttpMod.StreamableHTTPClientTransport(new URL(cfg.url));
    }

    await client.connect(transport);
    return client;
  }

  _registerServerTools(cfg, client, listResult) {
    const tools = Array.isArray(listResult?.tools) ? listResult.tools : [];

    for (const tool of tools) {
      const qualifiedName = cfg.name + "." + tool.name;
      this.tools.set(qualifiedName, {
        toolName: tool.name,
        description: tool.description || "",
        inputSchema: tool.inputSchema || {},
        client,
        serverName: cfg.name
      });
    }
  }

  _removeServerTools(serverName) {
    for (const [name, tool] of this.tools.entries()) {
      if (tool.serverName === serverName) {
        this.tools.delete(name);
      }
    }
  }

  _isRetryableTransportError(error) {
    const message = String(error && error.message ? error.message : "").toLowerCase();
    const causeCode = String(error && error.cause && error.cause.code ? error.cause.code : "").toUpperCase();

    return (
      message.includes("fetch failed") ||
      causeCode === "UND_ERR_SOCKET" ||
      causeCode === "ECONNRESET" ||
      causeCode === "ECONNREFUSED" ||
      causeCode === "ETIMEDOUT"
    );
  }

  async _reconnectServer(serverName) {
    const connIndex = this.connections.findIndex((x) => x.cfg && x.cfg.name === serverName);
    if (connIndex < 0) {
      throw new Error("Cannot reconnect unknown MCP server: " + serverName);
    }

    const oldConn = this.connections[connIndex];
    try {
      await oldConn.client.close();
    } catch {
      // Ignore close errors during reconnect.
    }

    const client = await this._createConnectedClient(oldConn.cfg);
    const listResult = await client.listTools({});

    this._removeServerTools(serverName);
    this._registerServerTools(oldConn.cfg, client, listResult);
    this.connections[connIndex] = { cfg: oldConn.cfg, client };
  }

  getToolManifest() {
    return Array.from(this.tools.entries()).map(([name, tool]) => ({
      name,
      description: tool.description,
      inputSchema: tool.inputSchema
    }));
  }

  async callTool(name, args) {
    let target = this.tools.get(name);
    if (!target) {
      throw new Error("Unknown MCP tool: " + name);
    }

    let result;
    try {
      result = await target.client.callTool({
        name: target.toolName,
        arguments: args || {}
      });
    } catch (error) {
      if (!this._isRetryableTransportError(error) || !target.serverName) {
        throw error;
      }

      await this._reconnectServer(target.serverName);
      target = this.tools.get(name);
      if (!target) {
        throw error;
      }

      result = await target.client.callTool({
        name: target.toolName,
        arguments: args || {}
      });
    }

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
