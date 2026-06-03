function parseMcpServers(rawValue) {
  if (!rawValue) return [];

  const value = typeof rawValue === "string" ? rawValue.trim() : rawValue;
  if (value === "") return [];

  const parsed = typeof value === "string" ? JSON.parse(value) : value;
  if (!Array.isArray(parsed)) {
    throw new Error("mcpServers must be a JSON array");
  }

  return parsed.map((server, index) => {
    if (!server || typeof server !== "object") {
      throw new Error("mcpServers[" + index + "] must be an object");
    }

    const normalized = {
      name: String(server.name || "").trim(),
      transport: String(server.transport || "streamableHttp").trim(),
      url: server.url ? String(server.url).trim() : "",
      command: server.command ? String(server.command).trim() : "",
      args: Array.isArray(server.args) ? server.args.map((x) => String(x)) : [],
      env: server.env && typeof server.env === "object" ? server.env : {}
    };

    if (!normalized.name) {
      throw new Error("mcpServers[" + index + "].name is required");
    }

    if (normalized.transport === "stdio") {
      if (!normalized.command) {
        throw new Error("mcpServers[" + index + "].command is required for stdio transport");
      }
    } else if (!normalized.url) {
      throw new Error("mcpServers[" + index + "].url is required for HTTP/SSE transports");
    }

    return normalized;
  });
}

function normalizeInput(msg) {
  if (typeof msg.payload === "string") return msg.payload;
  if (msg.payload && typeof msg.payload.input === "string") return msg.payload.input;
  if (typeof msg.topic === "string" && msg.topic.trim()) return msg.topic;
  throw new Error("Missing input: use msg.payload string or msg.payload.input");
}

/**
 * Resolve an array of ai-mcp-server-config node IDs to normalized server config objects.
 * @param {string[]} mcpServerIds - Array of Node-RED config node IDs.
 * @param {function(string): object|null} getNodeFn - RED.nodes.getNode or equivalent.
 * @returns {object[]} Array of normalized server config objects.
 */
function resolveMcpServerConfigs(mcpServerIds, getNodeFn) {
  if (!Array.isArray(mcpServerIds) || mcpServerIds.length === 0) return [];

  return mcpServerIds.map(function (id) {
    const configNode = getNodeFn(id);
    if (!configNode) {
      throw new Error("MCP server config node not found: " + id);
    }
    if (typeof configNode.getServerConfig !== "function") {
      throw new Error("Node " + id + " is not an ai-mcp-server-config node");
    }
    return configNode.getServerConfig();
  });
}

module.exports = {
  parseMcpServers,
  normalizeInput,
  resolveMcpServerConfigs
};
