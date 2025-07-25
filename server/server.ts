import * as readline from "node:readline";
import { stdin, stdout } from "node:process";
import fetch from "node-fetch";
import { MongoClient } from "mongodb";
import dotenv from "dotenv";
dotenv.config();

const GITHUB_MCP_URL = process.env.GITHUB_MCP_URL || '';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';
const MONGODB_URI =  process.env.MONGODB_URI || '';
const DB_NAME = process.env.DB_NAME || "";
const COLLECTION_NAME = process.env.COLLECTION_NAME || ""; 

const serverInfo = {
  name: "MCP Server",
  version: "1.0.0",
};

const rl = readline.createInterface({
  input: stdin,
  output: stdout,
});

const client = new MongoClient(MONGODB_URI);

let githubSessionId: string | null = null;

async function getToolSpecs() {
  try {
    await client.connect();
    const db = client.db(DB_NAME);
    const collection = db.collection(COLLECTION_NAME);
    const tools = await collection.find({}).toArray();
    
    return tools.map(tool => ({
      name: tool.toolId,
      description: tool.toolDescription,
      category: tool.category,
      inputSchema: {
        type: "object",
        properties: tool.parameters.reduce((acc: Record<string, any>, param: any) => {
          acc[param.key] = {
            type: "string",
            description: param.description || `${param.key} parameter`,
          };
          return acc;
        }, {}),
        required: tool.parameters
          .filter((param: any) => param.required === true)
          .map((param: any) => param.key),
      },
    }));
  } catch (error) {
    console.error("MongoDB Error:", error);
    throw error;
  } finally {
    await client.close();
  }
}

function sendResponse(id: number, result: object) {
  const response = {
    result,
    jsonrpc: "2.0",
    id,
  };
  console.log(JSON.stringify(response));
}

async function initializeGitHubSession() {
  try {
    const response = await fetch(GITHUB_MCP_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${GITHUB_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-03-26",
          capabilities: {
            tools: { listChanged: true },
          },
          clientInfo: {
            name: "MCP Server Proxy",
            version: "1.0.0",
          },
        },
      }),
    });

    const sessionId = response.headers.get('mcp-session-id');
    if (sessionId) {
      githubSessionId = sessionId;
    }

    const text = await response.text();

    if (!response.ok) {
      throw new Error(`GitHub MCP Initialize Error (${response.status}): ${text}`);
    }

    return JSON.parse(text);
  } catch (error) {
    throw error;
  }
}

async function proxyToGitHub(method: string, params: object) {
  if (!githubSessionId) {
    await initializeGitHubSession();
  }

  const requestBody = {
    jsonrpc: "2.0",
    id: 1,
    method,
    params,
  };

  const headers: Record<string, string> = {
    "Authorization": `Bearer ${GITHUB_TOKEN}`,
    "Content-Type": "application/json",
  };

  if (githubSessionId) {
    headers["Mcp-Session-Id"] = githubSessionId;
  }

  const response = await fetch(GITHUB_MCP_URL, {
    method: "POST",
    headers,
    body: JSON.stringify(requestBody),
  });

  const text = await response.text();

  if (!response.ok) {
    // If session expired, try to reinitialize
    if (response.status === 400 && text.includes("Invalid session ID")) {
      githubSessionId = null;
      await initializeGitHubSession();
      
      // Retry the request with new session
      const retryHeaders = {
        ...headers,
        "Mcp-Session-Id": githubSessionId!,
      };
      
      const retryResponse = await fetch(GITHUB_MCP_URL, {
        method: "POST",
        headers: retryHeaders,
        body: JSON.stringify(requestBody),
      });
      
      const retryText = await retryResponse.text();
      
      if (!retryResponse.ok) {
        throw new Error(`GitHub MCP Error (${retryResponse.status}): ${retryText}`);
      }
      
      return JSON.parse(retryText).result;
    }
    
    throw new Error(`GitHub MCP Error (${response.status}): ${text}`);
  }

  try {
    const parsed = JSON.parse(text);
    return parsed.result;
  } catch (e) {
    throw new Error(`Invalid JSON from GitHub MCP: ${text}`);
  }
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
          const toolSpecs = await getToolSpecs();
          sendResponse(json.id, {
            tools: toolSpecs.map((tool) => ({
              name: tool.name,
              description: tool.description,
              category: tool.category,
              inputSchema: {
                type: "object",
                properties: Object.entries(tool.inputSchema.properties).reduce(
                  (acc: Record<string, any>, [key, val]: [string, any]) => {
                    acc[key] = {
                      type: val.type,
                      description: val.description,
                    };
                    return acc;
                  },
                  {} as Record<string, any>
                ),
                required: tool.inputSchema.required || [],
              },
            })),
          });
        }

        if (json.method === "tools/call") {
          const toolSpecs = await getToolSpecs();
          const tool = toolSpecs.find((t) => t.name === json.params.name);
          if (tool) {
            if (tool.name === "github_token") {
              sendResponse(json.id, {
                content: [
                  {
                    text: `Your GitHub token has been received: ${json.params.arguments.token}`,
                  },
                ],
              });
            } else {
              const result = await proxyToGitHub("tools/call", json.params);
              sendResponse(json.id, result);
            }
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
    } catch (e: any) {
    }
  }
})();