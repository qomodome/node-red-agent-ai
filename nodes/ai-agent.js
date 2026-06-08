const {
  DEFAULT_MAX_ITERATIONS,
  DEFAULT_MAX_TOOL_CALLS
} = require("./domain/agent-constants");
const { runAgentUseCase } = require("./application/run-agent-use-case");
const { createLangChainModel } = require("./adapters/llm/langchain-provider-factory");
const { McpClientManager } = require("./adapters/tools/mcp-client-manager");
const { normalizeInput, parseMcpServers, resolveMcpServerConfigs } = require("./adapters/nodered/input-mapper");

module.exports = function (RED) {
  function AiAgentNode(config) {
    RED.nodes.createNode(this, config);

    const node = this;
    node.name = config.name;
    node.provider = (config.provider || "openai").trim();
    node.model = (config.model || "").trim();
    node.systemPrompt = typeof config.systemPrompt === "string" ? config.systemPrompt : "";
    node.agentConfig = RED.nodes.getNode(config.agent);
    node.mcpServerIds = Array.isArray(config.mcpServerIds) ? config.mcpServerIds : [];
    node.maxIterations = Number(config.maxIterations || DEFAULT_MAX_ITERATIONS);
    node.maxToolCalls = Number(config.maxToolCalls || DEFAULT_MAX_TOOL_CALLS);
    node.rateLimitRetries = Number(config.rateLimitRetries || 2);
    node.rateLimitBackoffMs = Number(config.rateLimitBackoffMs || 1000);
    node.awsRegion = (config.awsRegion || "us-east-1").trim();
    node.debugLogs = config.debugLogs === true || config.debugLogs === "true";

    node.on("input", async function (msg, send, done) {
      send = send || function () {
        node.send.apply(node, arguments);
      };

      done =
        done ||
        function (err) {
          if (err) {
            node.error(err, msg);
          }
        };

      let mcpManager;

      try {
        if (!node.agentConfig) {
          throw new Error("Missing ai-agent-config node");
        }

        const input = normalizeInput(msg);
        const secrets = node.agentConfig.getProviderSecrets();

        const provider = String(msg?.ai?.provider || node.provider || "openai");
        const modelName = String(msg?.ai?.model || node.model || "");
        const hasRuntimeSystemPrompt = !!(msg && msg.ai && Object.prototype.hasOwnProperty.call(msg.ai, "systemPrompt"));
        const systemPrompt = String(hasRuntimeSystemPrompt ? msg.ai.systemPrompt : node.systemPrompt || "");
        const debugEnabled = msg?.ai?.debug === true || node.debugLogs;
        const debugLog = (...parts) => {
          if (!debugEnabled) return;
          node.warn("[ai-agent debug] " + parts.map((x) => (typeof x === "string" ? x : JSON.stringify(x))).join(" "));
        };

        const mcpServers = msg?.ai?.mcpServers
          ? parseMcpServers(msg.ai.mcpServers)
          : resolveMcpServerConfigs(node.mcpServerIds, (id) => RED.nodes.getNode(id));

        debugLog("input", {
          msgId: msg?._msgid,
          provider,
          modelName,
          hasSystemPrompt: systemPrompt.trim().length > 0,
          mcpServers: mcpServers.map((s) => ({ name: s.name, transport: s.transport }))
        });

        node.status({ fill: "blue", shape: "dot", text: "initializing" });

        const model = await createLangChainModel(
          provider,
          modelName,
          secrets,
          node.awsRegion
        );

        mcpManager = new McpClientManager(mcpServers);
        await mcpManager.connect();

        const toolManifest = mcpManager.getToolManifest();
        debugLog("tools available", toolManifest.map((t) => t.name));

        node.status({ fill: "blue", shape: "dot", text: "reasoning" });

        const result = await runAgentUseCase({
          model,
          mcpManager,
          input,
          systemPrompt,
          maxIterations: node.maxIterations,
          maxToolCalls: node.maxToolCalls,
          rateLimitRetries: node.rateLimitRetries,
          rateLimitBackoffMs: node.rateLimitBackoffMs,
          onRateLimitRetry: (attempt) => {
            node.status({ fill: "yellow", shape: "ring", text: "rate-limit retry " + attempt });
            debugLog("rate-limit retry", { attempt });
          },
          onModelAction: ({ iteration, action, rawModelText }) => {
            if (!action) {
              debugLog("iteration", iteration, "invalid action", rawModelText);
              return;
            }

            if (action.type === "final") {
              debugLog("iteration", iteration, "final", { outputPreview: String(action.output || "").slice(0, 200) });
            } else {
              debugLog("iteration", iteration, "tool_call", { tool: action.tool, args: action.arguments });
            }
          },
          onToolCall: ({ phase, toolName, toolArgs, result, error }) => {
            if (phase === "start") {
              debugLog("tool start", { toolName, args: toolArgs });
            } else if (phase === "result") {
              debugLog("tool result", { toolName, resultPreview: JSON.stringify(result).slice(0, 400) });
            } else if (phase === "error") {
              debugLog("tool error", { toolName, error: String(error && error.message ? error.message : error) });
            }
          }
        });

        msg.payload = result.output;
        msg.aiAgent = {
          provider,
          model: modelName || undefined,
          trace: result.trace,
          usage: result.usage
        };

        node.status({ fill: "green", shape: "dot", text: "done" });
        send(msg);
        done();
      } catch (err) {
        node.status({ fill: "red", shape: "ring", text: "error" });
        node.error(err, msg);
        done(err);
      } finally {
        if (mcpManager) {
          await mcpManager.close();
        }
      }
    });
  }

  RED.nodes.registerType("ai-agent", AiAgentNode);
};
