"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const readline = __importStar(require("node:readline"));
const node_process_1 = require("node:process");
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
        execute: async (args) => ({
            content: [{ type: "text", text: args.message }],
        }),
    },
];
const rl = readline.createInterface({
    input: node_process_1.stdin,
    output: node_process_1.stdout,
});
function sendResponse(id, result) {
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
                    }
                    else {
                        sendResponse(json.id, {
                            error: {
                                code: -32602,
                                message: "Tool not found",
                            },
                        });
                    }
                }
            }
        }
        catch (e) {
            console.error(e);
        }
    }
})();
