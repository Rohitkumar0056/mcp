# ReAct Agent MCP

This project is a GitHub mcp based server and client system that acts as a proxy between GitHub MCP. It enables dynamic tool listing and invocation for AI agents, supporting ReAct-style workflows.

## Features

- **Dynamic Tool Loading:** Tools are defined in MongoDB and loaded at runtime.
- **GitHub MCP Proxy:** Forwards tool calls and manages session with GitHub MCP.
- **ReAct Agent:** Implements Reasoning and Acting pattern for step-by-step AI workflows and multi tool execution.
- **Thought Agent:** Processes the user query and suggests the best suitable tool.
- **Tool Agent:** For manual tool execution for executing developer operations.
- **Secure Configuratio:** Uses environment variables for all secrets and connection strings.

## Project Structure

```
.
├── client/
│   └── client.ts         # Client-side agent logic
├── server/
│   └── server.ts         # Main server logic, MongoDB integration
├── .env                  # Environment variables (not committed)
├── .gitignore
├── README.md
```

## Prerequisites

- Node.js (v16+ recommended)
- MongoDB instance (local or Atlas)

## Setup

1. **Clone the repository:**
   ```
   git clone
   cd ReAct-Agent-MCP
   ```

2. **Install dependencies:**
   ```
   npm install
   ```

3. **Configure environment variables:**

   Create a `.env` file in the root directory

4. **Populate MongoDB:**
   - Insert your tool definitions into the specified collection following the schema in `server/server.ts`.

5. **Run the server:**
   ```
   npm run start
   ```
   or (if using TypeScript directly)
   ```
   npx ts-node server/server.ts
   ```

6. **Run the client:**
   ```
   npx ts-node client/client.ts
   ```

## Usage

- The server listens for JSON-RPC requests, loads tools from MongoDB, and proxies tool calls to GitHub Copilot MCP.
- The client implements a ReAct agent that interacts with the server and guides the AI through tool usage.

## License

MIT
