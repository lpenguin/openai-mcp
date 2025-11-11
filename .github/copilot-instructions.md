# AI Coding Agent Instructions

## Project Overview

This is an **OpenAI Image Generation MCP Server** — a TypeScript-based Model Context Protocol server that exposes OpenAI's image generation models (gpt-image-1, gpt-image-1-mini, DALL-E 3, DALL-E 2) as MCP tools for use with Claude and other MCP clients.

## Architecture

### Core Components

**Two-layer architecture:**

1. **MCP Server Layer** (`src/mcp-server.ts`) — Handles MCP protocol
   - Exposes 4 separate tools: `generate_image_gpt`, `generate_image_gpt_mini`, `generate_image_dalle3`, `generate_image_dalle2`
   - Each tool routes to a dedicated handler that validates arguments and calls the provider
   - Uses `@modelcontextprotocol/sdk` for stdio-based communication
   - All debugging/logging goes to stderr, not stdout (MCP protocol requirement)

2. **OpenAI Provider Layer** (`src/openai-provider.ts`) — Handles API interaction
   - Abstracts OpenAI API calls with model-specific parameter handling
   - Supports both base64 (`b64_json`) and URL response formats from OpenAI
   - Handles file I/O: creates output directories, manages multi-image saving (numbered filenames)
   - Has fallback mock PNG generation for testing against non-functional servers

### Key Design Patterns

**Model-Specific Type System:**
- Each model has a distinct options interface (`GptImage1Options`, `DallE3Options`, etc.)
- Union type `ImageGenerationOptions` ensures type safety during dispatch
- gpt-image-1/mini support 24 parameters (size, quality, background, compression, format)
- DALL-E 3 only supports n=1 (enforced in handler)
- DALL-E 2 supports basic parameters (size, n, quality)

**Parameter Transformation:**
- All handlers convert user arguments → model-specific options → OpenAI API params
- `response_format: 'b64_json'` always used (response images saved to disk, not returned)
- Both URL and base64 response handling in `saveImages()` method

**Multi-Image Handling:**
- Single image: saved to exact output path
- Multiple images: numbered with pattern `basename_1.ext`, `basename_2.ext`, etc.

## Development Workflows

### Build & Run

```bash
npm install          # Install dependencies
npm run build        # TypeScript compilation to dist/
npm start            # Run compiled server (stdio transport)
npm run dev          # Build + run (useful for development)
```

### Testing

```bash
npm run integration-test  # Full integration test against mock server
```

The test suite spawns the server as a subprocess and sends JSON-RPC requests, simulating MCP client behavior. It validates tool listing and all four image generation calls.

### Environment Setup

- **Required:** `OPENAI_API_KEY` environment variable (sk-... format)
- **Optional:** `OPENAI_API_URL` for custom API endpoint (used for testing with mock servers)
- Dev setup: Create `.env` file or set env vars before `npm start`

## Critical Implementation Details

### Validation & Error Handling

1. **API Key Validation:** Check happens in mcp-server constructor; warns if format doesn't match `sk-*`
2. **Required Parameters:** Prompt and output path are always required; missing args throw `McpError` with `InvalidParams` code
3. **Error Responses:** Don't throw; return `{ content: [...], isError: true }` to prevent server crash
4. **Logging Convention:** All logs to stderr (with `console.error()`), includes request details and response metadata

### Response Format

Success response includes:
- `success: true`
- `model`: which model was used
- `savedFiles`: array of filesystem paths where images were written
- `response`: raw OpenAI response object

### File I/O Edge Cases

1. **Directory Creation:** `fs.mkdirSync(outputDir, { recursive: true })` if output dir doesn't exist
2. **Mock Server Fallback:** If OpenAI returns neither `b64_json` nor `url`, generates minimal valid PNG placeholder
3. **Base64 Decoding:** `Buffer.from(b64_json, 'base64')` then `fs.writeFileSync()`
4. **URL Downloads:** Uses axios to fetch URLs with `responseType: 'arraybuffer'`

## Common Tasks

### Adding a New Model

1. Define model options interface in `openai-provider.ts` (with specific parameters)
2. Add union to `ImageGenerationOptions` type
3. Add tool definition in `setupToolHandlers()` with schema
4. Create `handleModelGeneration()` method that builds options and calls provider
5. Add route in `CallToolRequestSchema` handler
6. Update integration test to include new model

### Modifying Parameters

- Model-specific parameter sets are split by interface — changes to one don't affect others
- Update both TypeScript interface AND the tool schema's `inputSchema` properties
- Ensure enum values match between interface and schema

### Testing Against Mock Server

Set `OPENAI_API_URL=http://localhost:5002/v1` and run `npm run integration-test`. The mock server only needs to respond with valid OpenAI-shaped responses; actual image generation isn't required (fallback PNG is used).

## Versioning & Conventional Commits

- Project uses **Conventional Commits** for commit messages (e.g., `feat:`, `fix:`, `docs:`, `refactor:`)
- Commit types: `feat` (new features), `fix` (bug fixes), `docs` (documentation), `refactor` (code changes), `test`, `chore`
- Include `(scope)` for clarity: `feat(dalle3): add style parameter`
- Breaking changes marked with `!`: `feat!: redesign tool interface`
- Version bumping is automated from commit history (see CHANGELOG.md)
- Always update CHANGELOG.md when making significant changes

## Package & Publishing

- Entry point: `dist/mcp-server.js` (with Node.js shebang)
- Published to npm as `@lpenguin/openai-image-mcp`
- Can be run via `npx @lpenguin/openai-image-mcp` or globally installed
- Prepublish hook runs `npm run build` automatically
