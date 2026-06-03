module.exports = function (RED) {
  function AiMcpServerConfigNode(config) {
    RED.nodes.createNode(this, config);

    this.name = config.name || "";
    this.transport = (config.transport || "streamableHttp").trim();
    this.url = (config.url || "").trim();
    this.command = (config.command || "").trim();
    this.argsRaw = (config.argsRaw || "").trim();
    this.envJson = (config.envJson || "{}").trim();

    if (RED.log && typeof RED.log.debug === "function") {
      RED.log.debug(
        "[ai-mcp-server-config] init id=" +
          this.id +
          " name=" +
          this.name +
          " transport=" +
          this.transport
      );
    }

    this.getServerConfig = () => {
      const args = this.argsRaw
        ? this.argsRaw.split(/\n/).map((x) => x.trim()).filter(Boolean)
        : [];

      let env = {};
      try {
        const parsed = JSON.parse(this.envJson || "{}");
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          env = parsed;
        }
      } catch {
        // fall through with empty env
      }

      if (RED.log && typeof RED.log.debug === "function") {
        RED.log.debug(
          "[ai-mcp-server-config] getServerConfig id=" +
            this.id +
            " name=" +
            this.name +
            " transport=" +
            this.transport +
            " args=" +
            args.length
        );
      }

      return {
        name: this.name,
        transport: this.transport,
        url: this.url,
        command: this.command,
        args,
        env
      };
    };
  }

  RED.nodes.registerType("ai-mcp-server-config", AiMcpServerConfigNode);
};
