# node-red-ai-agent-mcp

Drop an AI agent into any Node-RED flow — it runs a reasoning loop, calls MCP tools, and returns the final answer.

## What you get

- `ai-agent-config`: stores provider credentials and shared defaults
- `ai-agent`: executes a reasoning loop, can call MCP tools, then returns final output
- Provider support: **OpenAI GPT**, **Google Gemini**, **AWS Bedrock**

## Architecture

The node runtime is organized with an hexagonal architecture to keep business logic decoupled from framework details.

- Domain layer: core reasoning loop and policies
- Application layer: use case orchestration
- Adapters layer: Node-RED I/O mapping, LangChain model factory, MCP client integration

Current structure:

```text
nodes/
  domain/
  application/
  adapters/
    nodered/
    llm/
    tools/
```

## Requirements

- Node.js 18+
- Node-RED 3+

## Installation

From the Node-RED editor:

1. Go to `Manage palette` > `Install` tab
2. Search for `@qomodome/node-red-agent-ai`
3. Click `Install`

From the command line:

```bash
npm install @qomodome/node-red-agent-ai
```

## Use the node

1. Add an `ai-agent-config` node and set credentials for the provider you want to use.
2. (Optional) Add one or more `ai-mcp-server-config` nodes if you want external tools.
3. Add an `ai-agent` node and link it to your `ai-agent-config`.
4. Pick provider/model in the node UI (or override from `msg.ai`).
5. Send a message like this:

```js
msg.payload = {
  input: "Summarize today tickets in 5 bullet points"
};

msg.ai = {
  provider: "gemini", // openai | gemini | bedrock
  model: "gemini-3.5-flash"
};

return msg;
```

If `msg.ai` is missing, `ai-agent` uses the defaults configured in the node editor.

## Node reference

### ai-agent-config

- `name` (optional): label in editor
- `openaiApiKey` (optional): used when provider is `openai`
- `googleApiKey` (optional): used when provider is `gemini`
- `awsAccessKeyId` (optional): AWS key id for `bedrock`
- `awsSecretAccessKey` (optional): AWS secret for `bedrock`
- `awsSessionToken` (optional): AWS session token when needed

### ai-mcp-server-config

- `name` (optional): label in editor
- `transport` (required): `streamableHttp` | `sse` | `stdio`
- `url` (required for HTTP transports): MCP endpoint URL
- `command` (required for `stdio`): executable to spawn
- `argsRaw` (optional): one argument per line for `stdio`
- `envJson` (optional): JSON object with env vars for `stdio`

### ai-agent

- `agent` (required): reference to `ai-agent-config`
- `provider` (required): `openai` | `gemini` | `bedrock`
- `model` (optional): provider model override
- `systemPrompt` (optional): persistent agent instruction
- `awsRegion` (optional): used for `bedrock` (default `us-east-1`)
- `mcpServerIds` (optional): linked `ai-mcp-server-config` nodes
- `debugLogs` (optional): verbose runtime logs
- advanced limits (optional): `maxIterations`, `maxToolCalls`, `maxDurationMs`, `temperature`, `rateLimitRetries`, `rateLimitBackoffMs`

## Message contract

Input:

- `msg.payload` string or object with `input`
- optional overrides in `msg.ai`:
  - `provider`: `openai` · `gemini` · `bedrock`
  - `model`: model id/name
  - `mcpServers`: array of MCP server configs

Output on success:

- `msg.payload`: final assistant text
- `msg.aiAgent.trace`: iteration-by-iteration trace
- `msg.aiAgent.usage`: counters and timings

Error behavior:

- Errors are propagated with `node.error(err, msg)` and `done(err)`
- Use standard Node-RED `catch` nodes for handling
- Internal handling is limited to rate-limit retry/backoff

## Local Docker run

From repository root:

```bash
docker compose up --build
```

Then open:

```text
http://localhost:1880
```

Notes:

- The setup installs this local module inside `/data/node_modules`
- Flows persist in a named Docker volume
- Rebuild after source changes:

```bash
docker compose up --build --force-recreate
```

## Development

Run tests:

```bash
npm test
```

## Publishing

The publish process is automated via GitHub Actions when pushing a tag that matches the `package.json` version. To publish a new version:

```bash
npm version X.Y.Z
git push origin main vX.Y.Z
```

For manual publish (not recommended - use only for emergencies):

0. Verify you have an npm account and are logged in with `npm whoami`. If not, run `npm login --scope=@qomodome --auth-type=web` and follow the prompts.
1. Update version in `package.json`
2. Verify contents with `npm pack --dry-run`
3. Publish to npm:

```bash
npm publish --access public
```

## License

MIT License. See [LICENSE](./LICENSE) for details.
