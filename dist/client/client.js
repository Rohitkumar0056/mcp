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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const readline = __importStar(require("node:readline/promises"));
const node_child_process_1 = require("node:child_process");
const prompts_1 = require("@clack/prompts");
const node_fetch_1 = __importDefault(require("node-fetch"));
const dotenv = __importStar(require("dotenv"));
dotenv.config();
async function callOpenAI(prompt) {
    const response = await (0, node_fetch_1.default)("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: prompt }],
            max_tokens: 256,
        }),
    });
    const data = await response.json();
    if (data.choices && data.choices.length > 0) {
        return data.choices[0].message.content;
    }
    throw new Error("No response from OpenAI");
}
(async function main() {
    const npx = process.platform === "win32" ? "npx.cmd" : "npx";
    const serverProcess = (0, node_child_process_1.spawn)(npx, ["ts-node", "../server/server.ts"], {
        stdio: ["pipe", "pipe", "inherit"],
        shell: true,
    });
    const rl = readline.createInterface({
        input: serverProcess.stdout,
    });
    let lastId = 0;
    async function send(method, params = {}) {
        serverProcess.stdin.write(JSON.stringify({
            jsonrpc: "2.0",
            method,
            params,
            id: lastId++,
        }) + "\n");
        const json = await rl.question("");
        return JSON.parse(json).result;
    }
    const { serverInfo, capabilities } = await send("initialize", {
        protocolVersion: "2025-03-26",
        capabilities: {},
        clientInfo: { name: "simple-client", version: "0.1.0" },
    });
    const tools = capabilities.tools
        ? (await send("tools/list", {})).tools
        : [];
    (0, prompts_1.intro)(`Connected to ${serverInfo.name} v${serverInfo.version}`);
    while (true) {
        const action = await (0, prompts_1.select)({
            message: "What would you like to do?",
            options: [
                { value: "ai", label: "Ask OpenAI" },
                ...(tools.length > 0 ? [{ value: "tool", label: "Run a tool" }] : []),
            ],
        });
        if ((0, prompts_1.isCancel)(action))
            process.exit(0);
        if (action === "tool") {
            const tool = await (0, prompts_1.select)({
                message: "Select a tool.",
                options: tools.map((tool) => ({ value: tool, label: tool.name })),
            });
            if ((0, prompts_1.isCancel)(tool))
                process.exit(0);
            const args = {};
            for (const key of Object.keys(tool.inputSchema.properties ?? {})) {
                const answer = await (0, prompts_1.text)({ message: `${key}:`, initialValue: "" });
                if ((0, prompts_1.isCancel)(answer))
                    process.exit(0);
                args[key] = answer;
            }
            const { content } = await send("tools/call", {
                name: tool.name,
                arguments: args,
            });
            for (const c of content) {
                try {
                    console.log(JSON.parse(c.text));
                }
                catch {
                    console.log(c.text);
                }
            }
        }
        if (action === "ai") {
            const promptValue = await (0, prompts_1.text)({
                message: "What would you like to ask OpenAI?",
                defaultValue: "Say hello!",
            });
            if ((0, prompts_1.isCancel)(promptValue))
                process.exit(0);
            const aiResponse = await callOpenAI(promptValue);
            console.log("OpenAI:", aiResponse);
        }
    }
})();
