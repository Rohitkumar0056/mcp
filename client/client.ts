import * as readline from "node:readline/promises";
import { spawn } from "node:child_process";
import { intro, isCancel, select, text } from "@clack/prompts";
import fetch from "node-fetch";
import * as dotenv from "dotenv";
dotenv.config();

type Tool = {
  name: string;
  description: string;
  inputSchema: {
    properties: Record<string, any>;
  };
};

type Content = { text: string };

async function callOpenAI(prompt: string) {
  const response = await fetch("https://cloud.olakrutrim.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer j2xc332dlAfRv-8UeA17`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "Llama-3.3-70B-Instruct",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 256,
    }),
  });

  const data = await response.json();
  if (data.choices && data.choices.length > 0) {
    return data.choices[0].message.content;
  }
  throw new Error("No response");
}

(async function main() {
  const npx = process.platform === "win32" ? "npx.cmd" : "npx";
  const serverProcess = spawn(npx, ["ts-node", "../server/server.ts"], {
    stdio: ["pipe", "pipe", "inherit"],
    shell: true,
  });

  const rl = readline.createInterface({
    input: serverProcess.stdout,
  });

  let lastId = 0;
  async function send(method: string, params: object = {}) {
    serverProcess.stdin.write(
      JSON.stringify({
        jsonrpc: "2.0",
        method,
        params,
        id: lastId++,
      }) + "\n"
    );
    const json = await rl.question("");
    return JSON.parse(json).result;
  }

  const { serverInfo, capabilities } = await send("initialize", {
    protocolVersion: "2025-03-26",
    capabilities: {},
    clientInfo: { name: "simple-client", version: "0.1.0" },
  });

  const tools: Tool[] = capabilities.tools
    ? (await send("tools/list", {})).tools
    : [];

  intro(`Connected to ${serverInfo.name} v${serverInfo.version}`);

  while (true) {
    const action = await select({
      message: "What would you like to do?",
      options: [
        { value: "ai", label: "Ask AI" },
        ...(tools.length > 0 ? [{ value: "tool", label: "Run a tool" }] : []),
      ],
    });
    if (isCancel(action)) process.exit(0);

    if (action === "tool") {
      const tool = await select({
        message: "Select a tool.",
        options: tools.map((tool) => ({ value: tool, label: tool.name })),
      });

      if (isCancel(tool)) process.exit(0);

      const args: Record<string, any> = {};
      for (const key of Object.keys(tool.inputSchema.properties ?? {})) {
        const answer = await text({ message: `${key}:`, initialValue: "" });
        if (isCancel(answer)) process.exit(0);
        args[key] = answer;
      }

      const { content }: { content: Content[] } = await send("tools/call", {
        name: tool.name,
        arguments: args,
      });

      for (const c of content) {
        try {
          console.log(JSON.parse(c.text));
        } catch {
          console.log(c.text);
        }
      }
    }

    if (action === "ai") {
      const promptValue = await text({
        message: "What would you like to ask AI?",
        defaultValue: "Say hello!",
      });

      if (isCancel(promptValue)) process.exit(0);

      const aiResponse = await callOpenAI(promptValue);
      console.log("AI:", aiResponse);
    }
  }
})();
