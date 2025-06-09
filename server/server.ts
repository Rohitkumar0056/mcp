import * as readline from "node:readline";
import { stdin, stdout } from "node:process";

const serverInfo = {
  name: "MCP Server",
  version: "1.0.0",
};

const tools = [
  {
    name: "echo",
    description: "Echoes back your input.",
    inputSchema: {
      type: "object",
      properties: { message: { type: "string" } },
      required: ["message"],
    },
    execute: async (args: any) => ({
      content: [{ type: "text", text: args.message }],
    }),
  },
];

const rl = readline.createInterface({
  input: stdin,
  output: stdout,
});

function sendResponse(id: number, result: object) {
  const response = {
    result,
    jsonrpc: "2.0",
    id,
  };
  console.log(JSON.stringify(response));
}

(async function main() {
  for await (const line of rl) {
    try {
      const json = JSON.parse(line);

      if (json.jsonrpc === "2.0") {
        if (json.method === "initialize") {
          sendResponse(json.id, {
            protocolVersion: "2025-03-26",
            capabilities: {
              tools: { listChanged: true },
            },
            serverInfo,
          });
        }

        if (json.method === "tools/list") {
          sendResponse(json.id, {
            tools: tools.map((tool) => ({
              name: tool.name,
              description: tool.description,
              inputSchema: tool.inputSchema,
            })),
          });
        }
        
        if (json.method === "tools/call") {
          const tool = tools.find((t) => t.name === json.params.name);
          if (tool) {
            const toolResponse = await tool.execute(json.params.arguments);
            sendResponse(json.id, toolResponse);
          } else {
            sendResponse(json.id, {
              error: {
                code: -32602,
                message: "Tool not found",
              },
            });
          }
        }
      }
    } catch (e) {
      console.error(e);
    }
  }
})();
