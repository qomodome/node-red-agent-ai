# node-red-contrib-ai-agent-mcp

Node-RED custom nodes to run an AI agent with LangChain.js and MCP tools.

## What you get

- `ai-agent-config`: stores provider credentials and shared defaults
- `ai-agent`: executes a reasoning loop, can call MCP tools, then returns final output
- Provider support target: OpenAI GPT, Google Gemini, AWS Bedrock

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

## Install

```bash
npm install node-red-contrib-ai-agent-mcp
```

## Message contract

Input:

- `msg.payload` string or object with `input`
- optional overrides in `msg.ai`:
  - `provider`: `openai | gemini | bedrock`
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

Create package tarball:

```bash
npm pack
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
