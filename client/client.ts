import * as readline from "node:readline/promises";
import { spawn } from "node:child_process";
import { intro, isCancel, select, text, confirm } from "@clack/prompts";
import fetch from "node-fetch";
import * as dotenv from "dotenv";
import chalk from "chalk";

dotenv.config();

const AI_URL = process.env.AI_API_URL || '';
const AI_TOKEN = process.env.AI_TOKEN || '';

type Tool = {
  name: string;
  description: string;
  category?: string;
  inputSchema: {
    properties: Record<string, any>;
    required?: string[];
  };
};

type Content = { text: string };

type ReActStep = {
  type: 'thought' | 'action' | 'observation';
  content: string;
  tool?: string;
  arguments?: Record<string, any>;
  success?: boolean;
  error?: string;
};

type ParameterCollectionResult = {
  success: boolean;
  arguments?: Record<string, any>;
  error?: string;
  userCancelled?: boolean;
};

class ReActAgent {
  private tools: Tool[];
  private maxIterations: number = 10;
  private steps: ReActStep[] = [];
  private toolUsageStats: Map<string, { successes: number; errors: number; errorMessages: string[] }> = new Map();
  private startTime: number = 0;
  private endTime: number = 0;
  private parameterRetryCount: Map<string, number> = new Map();
  private maxParameterRetries: number = 3;

  constructor(tools: Tool[]) {
    this.tools = tools;
  }

  async callAI(messages: { role: string; content: string }[]) {
    const response = await fetch(AI_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${AI_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "Llama-3.3-70B-Instruct",
        messages,
        max_tokens: 1024,
      }),
    });

    const data = await response.json();
    if (data.choices && data.choices.length > 0) {
      return data.choices[0].message;
    }
    throw new Error("No response");
  }

  createReActPrompt(query: string, steps: ReActStep[]): string {
    let prompt = `You are a helpful assistant that can use various GitHub tools to help users. You should think step by step and use the ReAct (Reasoning and Acting) pattern.

For each response, you should:
1. Think about what needs to be done
2. Choose the appropriate tool(s) to use
3. Specify the tool name and required parameters in your response
4. Analyze the results and determine if more actions are needed
5. Provide a final answer when the task is complete
6. Explicitly state when the task is complete by including phrases like "Task complete" or "Query resolved"

Available tools:
${this.tools.map(t => `- ${t.name}: ${t.description}
  Required parameters: ${(t.inputSchema.required || []).join(', ') || 'None'}
  Optional parameters: ${Object.keys(t.inputSchema.properties || {}).filter(key => !(t.inputSchema.required || []).includes(key)).join(', ') || 'None'}
  Parameter details: ${JSON.stringify(t.inputSchema.properties || {}, null, 2)}`).join('\n\n')}

User Query: ${query}

When you want to use a tool, please format your response like this:
ACTION: [tool_name]
PARAMETERS: {
  "parameter1": "value1",
  "parameter2": "value2"
}

Then I will execute the tool and provide you with the results.

`;

    if (steps.length > 0) {
      prompt += "\nPrevious steps:\n";
      steps.forEach((step, index) => {
        if (step.type === 'thought') {
          prompt += `Thought ${index + 1}: ${step.content}\n`;
        } else if (step.type === 'action') {
          prompt += `Action ${index + 1}: Used ${step.tool} with arguments: ${JSON.stringify(step.arguments)}\n`;
        } else if (step.type === 'observation') {
          prompt += `Observation ${index + 1}: ${step.content}\n`;
        }
      });
    }

    prompt += "\nWhat should I do next? If you need to use a tool, please use the ACTION/PARAMETERS format. If the task is complete, explicitly state 'Task complete' or 'Query resolved' and provide a final summary.";

    return prompt;
  }

  parseToolAction(aiResponse: string): { toolName: string; parameters: any } | null {
    const lines = aiResponse.split('\n');
    console.log("lines: ", lines);
    let toolName = '';
    let parametersStr = '';
    let inParameters = false;
    let parameterLines: string[] = [];

    for (const line of lines) {
      const trimmedLine = line.trim();
      
      if (trimmedLine.startsWith('ACTION:')) {
        toolName = trimmedLine.replace('ACTION:', '').trim();
      } else if (trimmedLine.startsWith('PARAMETERS:')) {
        inParameters = true;
        const paramPart = trimmedLine.replace('PARAMETERS:', '').trim();
        if (paramPart) {
          parameterLines.push(paramPart);
        }
      } else if (inParameters && trimmedLine) {
        parameterLines.push(trimmedLine);
      } else if (inParameters && !trimmedLine) {
        break;
      }
    }

    if (toolName && parameterLines.length > 0) {
      try {
        parametersStr = parameterLines.join('\n');
        const parameters = JSON.parse(parametersStr);
        return { toolName, parameters };
      } catch (error) {
        console.log(chalk.yellow(`Failed to parse parameters: ${error}`));
        return null;
      }
    }

    return null;
  }

  async collectToolArguments(tool: Tool, toolCall: any, originalQuery: string): Promise<ParameterCollectionResult> {
    const retryKey = `${tool.name}_${Date.now()}`;
    const currentRetries = this.parameterRetryCount.get(retryKey) || 0;
    
    if (currentRetries >= this.maxParameterRetries) {
      return {
        success: false,
        error: `Maximum parameter collection retries reached for ${tool.name}`
      };
    }

    try {
      const args: Record<string, any> = {};
      const providedArgs = toolCall.parameters || {};
      const requiredFields = tool.inputSchema.required || [];
      const allFields = Object.keys(tool.inputSchema.properties ?? {});

      Object.assign(args, providedArgs);

      const missingRequired = requiredFields.filter(field => 
        args[field] === undefined || args[field] === null || args[field] === ""
      );

      const missingOptional = allFields.filter(field => 
        !requiredFields.includes(field) && 
        (args[field] === undefined || args[field] === null || args[field] === "")
      );

      if (missingRequired.length > 0 || missingOptional.length > 0) {
        console.log(chalk.yellow(`\n Tool "${tool.name}" needs additional parameters:`));
        console.log(chalk.gray(` Original query: ${originalQuery}`));
        console.log(chalk.gray(` AI provided: ${JSON.stringify(providedArgs, null, 2)}`));
        
        if (missingRequired.length > 0) {
          console.log(chalk.red(` Missing required parameters: ${missingRequired.join(', ')}`));
        }
        
        if (missingOptional.length > 0) {
          console.log(chalk.yellow(` Missing optional parameters: ${missingOptional.join(', ')}`));
        }

        const shouldCollect = await confirm({
          message: `Would you like to provide the missing parameters for ${tool.name}?`,
          initialValue: true
        });

        if (isCancel(shouldCollect) || !shouldCollect) {
          return {
            success: false,
            userCancelled: true,
            error: "User cancelled parameter collection"
          };
        }

        for (const field of missingRequired) {
          const property = tool.inputSchema.properties[field];
          const fieldDescription = property?.description || `${field} parameter`;
          
          console.log(chalk.cyan(`\n Parameter: ${field}`));
          console.log(chalk.gray(` Description: ${fieldDescription}`));
          
          if (property?.enum) {
            console.log(chalk.gray(` Allowed values: ${property.enum.join(', ')}`));
          }
          
          if (property?.type) {
            console.log(chalk.gray(` Type: ${property.type}`));
          }

          const answer = await text({ 
            message: `${field} (required)`,
            placeholder: fieldDescription,
            initialValue: typeof providedArgs[field] === 'string' ? providedArgs[field] : ""
          });

          if (isCancel(answer)) {
            return {
              success: false,
              userCancelled: true,
              error: "User cancelled parameter collection"
            };
          }

          if (!answer || answer.trim() === "") {
            console.log(chalk.red(` Required parameter "${field}" cannot be empty`));
            this.parameterRetryCount.set(retryKey, currentRetries + 1);
            return await this.collectToolArguments(tool, toolCall, originalQuery);
          }

          args[field] = answer;
        }

        if (missingOptional.length > 0) {
          const collecteOptional = await confirm({
            message: `Would you like to provide optional parameters for ${tool.name}?`,
            initialValue: false
          });

          if (!isCancel(collecteOptional) && collecteOptional) {
            for (const field of missingOptional) {
              const property = tool.inputSchema.properties[field];
              const fieldDescription = property?.description || `${field} parameter`;
              
              console.log(chalk.cyan(`\n Optional Parameter: ${field}`));
              console.log(chalk.gray(` Description: ${fieldDescription}`));
              
              if (property?.enum) {
                console.log(chalk.gray(` Allowed values: ${property.enum.join(', ')}`));
              }

              const answer = await text({ 
                message: `${field} (optional - press Enter to skip)`,
                placeholder: fieldDescription,
                initialValue: ""
              });

              if (isCancel(answer)) {
                break;
              }

              if (answer && answer.trim() !== "") {
                args[field] = answer;
              }
            }
          }
        }

        const validationResult = this.validateParameters(tool, args);
        if (!validationResult.valid) {
          console.log(chalk.red(` Parameter validation failed: ${validationResult.error}`));
          this.parameterRetryCount.set(retryKey, currentRetries + 1);
          return await this.collectToolArguments(tool, toolCall, originalQuery);
        }

        console.log(chalk.green(` All required parameters collected for ${tool.name}`));
        console.log(chalk.gray(` Final parameters: ${JSON.stringify(args, null, 2)}`));
      }

      return {
        success: true,
        arguments: args
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.log(chalk.red(` Error collecting parameters: ${errorMessage}`));
      
      return {
        success: false,
        error: errorMessage
      };
    }
  }

  private validateParameters(tool: Tool, args: Record<string, any>): { valid: boolean; error?: string } {
    const requiredFields = tool.inputSchema.required || [];
    
    for (const field of requiredFields) {
      if (args[field] === undefined || args[field] === null || args[field] === "") {
        return {
          valid: false,
          error: `Required parameter "${field}" is missing or empty`
        };
      }
    }

    for (const [field, value] of Object.entries(args)) {
      const property = tool.inputSchema.properties[field];
      if (property?.enum && !property.enum.includes(value)) {
        return {
          valid: false,
          error: `Parameter "${field}" must be one of: ${property.enum.join(', ')}`
        };
      }
    }

    return { valid: true };
  }

  async executeToolWithRetry(tool: Tool, args: Record<string, any>, sendFunction: (method: string, params: object) => Promise<any>, originalQuery: string): Promise<{ success: boolean; content?: Content[]; error?: string }> {
    const maxRetries = 2;
    let retryCount = 0;

    while (retryCount <= maxRetries) {
      try {
        const { content }: { content: Content[] } = await sendFunction("tools/call", {
          name: tool.name,
          arguments: args,
        });

        const observation = content.map(c => c.text).join('\n');
        
        if (this.isParameterError(observation) && retryCount < maxRetries) {
          console.log(chalk.yellow(` Parameter error detected, attempting to re-collect parameters...`));
          
          const paramResult = await this.collectToolArguments(tool, { parameters: args }, originalQuery);
          
          if (paramResult.success && paramResult.arguments) {
            args = paramResult.arguments;
            retryCount++;
            continue;
          } else {
            return {
              success: false,
              error: paramResult.error || "Failed to collect parameters"
            };
          }
        }

        const isError = this.isErrorResult(observation);
        
        return {
          success: !isError,
          content: content,
          error: isError ? observation : undefined
        };

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        
        if (retryCount < maxRetries) {
          console.log(chalk.yellow(` Retrying tool execution (${retryCount + 1}/${maxRetries})...`));
          retryCount++;
          await new Promise(resolve => setTimeout(resolve, 1000));
        } else {
          return {
            success: false,
            error: errorMessage
          };
        }
      }
    }

    return {
      success: false,
      error: "Maximum retries exceeded"
    };
  }

  private isParameterError(observation: string): boolean {
    const parameterErrorIndicators = [
      'missing parameter',
      'required parameter',
      'invalid parameter',
      'parameter is required',
      'missing required field',
      'required field',
      'missing argument',
      'argument is required',
      'invalid argument',
      'parameter cannot be empty',
      'field is required'
    ];
    
    const lowerObservation = observation.toLowerCase();
    return parameterErrorIndicators.some(indicator => lowerObservation.includes(indicator));
  }

  async execute(query: string, sendFunction: (method: string, params: object) => Promise<any>): Promise<void> {
    console.log(chalk.blueBright(" ReAct Agent starting..."));
    
    this.startTime = Date.now();
    let iteration = 0;
    let taskComplete = false;

    while (iteration < this.maxIterations && !taskComplete) {
      iteration++;
      console.log(chalk.gray(`\n--- Iteration ${iteration} ---`));

      try {
        const prompt = this.createReActPrompt(query, this.steps);
        const messages = [{ role: "user", content: prompt }];

        const aiResponse = await this.callAI(messages);
        console.log("Krutrim response: ", aiResponse);

        const responseContent = aiResponse.content || '';
        console.log("Response content: ", responseContent);
        
        const toolAction = this.parseToolAction(responseContent);
        console.log(toolAction);
        
        if (toolAction) {
          const tool = this.tools.find(t => t.name === toolAction.toolName);
          
          if (tool) {
            // Extract thought from response (everything before ACTION:)
            const thoughtMatch = responseContent.split('ACTION:')[0].trim();
            const thought = thoughtMatch || `I need to use ${tool.name} to proceed.`;
            
            this.steps.push({
              type: 'thought',
              content: thought
            });

            console.log(chalk.yellow(` Thought: ${thought}`));

            const paramResult = await this.collectToolArguments(tool, { parameters: toolAction.parameters }, query);

            if (!paramResult.success) {
              if (paramResult.userCancelled) {
                console.log(chalk.yellow(" User cancelled parameter collection. Ending execution."));
                taskComplete = true;
                break;
              } else {
                console.log(chalk.red(` Failed to collect parameters: ${paramResult.error}`));
                
                this.steps.push({
                  type: 'observation',
                  content: `Parameter collection failed: ${paramResult.error}`,
                  success: false,
                  error: paramResult.error
                });
                
                continue;
              }
            }

            const args = paramResult.arguments!;

            console.log(chalk.cyan(` Action: Using ${tool.name} with arguments:`, JSON.stringify(args, null, 2)));

            this.steps.push({
              type: 'action',
              content: `Using ${tool.name}`,
              tool: tool.name,
              arguments: args
            });

            if (!this.toolUsageStats.has(tool.name)) {
              this.toolUsageStats.set(tool.name, { successes: 0, errors: 0, errorMessages: [] });
            }

            const result = await this.executeToolWithRetry(tool, args, sendFunction, query);

            if (result.success && result.content) {
              const observation = result.content.map(c => c.text).join('\n');
              console.log(chalk.green(` Observation: ${observation}`));

              const stats = this.toolUsageStats.get(tool.name)!;
              stats.successes++;
              this.toolUsageStats.set(tool.name, stats);
              
              this.steps.push({
                type: 'observation',
                content: observation,
                success: true
              });
            } else {
              console.log(chalk.red(` Tool execution failed: ${result.error}`));

              const stats = this.toolUsageStats.get(tool.name)!;
              stats.errors++;
              stats.errorMessages.push(result.error || "Unknown error");
              this.toolUsageStats.set(tool.name, stats);

              this.steps.push({
                type: 'observation',
                content: `Error: ${result.error}`,
                success: false,
                error: result.error
              });
            }

            // Check if user wants to stop after this action
            const continueExecution = await confirm({
              message: `The tool ${tool.name} was executed. Is the task complete?`,
              initialValue: false
            });

            if (!isCancel(continueExecution) && continueExecution) {
              taskComplete = true;
              console.log(chalk.green.bold("\n User confirmed task completion."));
              break;
            }
          } else {
            console.log(chalk.red(` Tool ${toolAction.toolName} not found`));
            
            this.steps.push({
              type: 'observation',
              content: `Tool ${toolAction.toolName} not found`,
              success: false,
              error: `Tool ${toolAction.toolName} not found`
            });
          }
        } else {
          console.log(chalk.green(` AI Response: ${responseContent}`));
          
          const completionIndicators = [
            'task is complete',
            'finished',
            'done',
            'successfully completed',
            'final answer',
            'summary:',
            'in conclusion',
            'task complete',
            'query resolved'
          ];
          
          const lowerResponseContent = responseContent.toLowerCase();
          const isComplete = completionIndicators.some(indicator => 
            lowerResponseContent.includes(indicator)
          );

          if (isComplete) {
            taskComplete = true;
            console.log(chalk.green.bold("\n Task completed successfully!"));
          } else {
            this.steps.push({
              type: 'thought',
              content: responseContent || "Continuing to analyze..."
            });

            // Check if user wants to stop after this thought
            const continueExecution = await confirm({
              message: `The AI provided a response. Is the task complete?`,
              initialValue: false
            });

            if (!isCancel(continueExecution) && continueExecution) {
              taskComplete = true;
              console.log(chalk.green.bold("\n User confirmed task completion."));
            }
          }
        }

        if (!taskComplete && iteration < this.maxIterations) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }

      } catch (error) {
        console.error(chalk.red(` Error in iteration ${iteration}:`), error);
        break;
      }
    }

    this.endTime = Date.now();

    if (iteration >= this.maxIterations && !taskComplete) {
      console.log(chalk.yellow(" Maximum iterations reached. Task may not be complete."));
    }

    this.displayFinalSummary(query, taskComplete, iteration);
  }

  private isErrorResult(observation: string): boolean {
    const errorIndicators = [
      'error',
      'failed',
      'not found',
      'unauthorized',
      'forbidden',
      'invalid',
      'cannot',
      'unable to',
      'permission denied',
      'access denied',
      'bad request',
      'not allowed'
    ];
    
    const lowerObservation = observation.toLowerCase();
    return errorIndicators.some(indicator => lowerObservation.includes(indicator));
  }

  private displayFinalSummary(query: string, taskComplete: boolean, iterations: number): void {
    const executionTime = ((this.endTime - this.startTime) / 1000).toFixed(2);
    
    console.log(chalk.blueBright("\n" + "=".repeat(80)));
    console.log(chalk.blueBright.bold(" EXECUTION SUMMARY"));
    console.log(chalk.blueBright("=".repeat(80)));
    
    console.log(chalk.white.bold("\n Basic Information:"));
    console.log(chalk.gray(` Query: ${query}`));
    console.log(chalk.gray(` Execution Time: ${executionTime} seconds`));
    console.log(chalk.gray(` Iterations: ${iterations}`));
    console.log(chalk.gray(` Task Status: ${taskComplete ? chalk.green('COMPLETED') : chalk.red('INCOMPLETE')}`));
    
    console.log(chalk.white.bold("\n Tool Usage Statistics:"));
    
    if (this.toolUsageStats.size === 0) {
      console.log(chalk.gray("   No tools were used during execution"));
    } else {
      const toolsUsed = Array.from(this.toolUsageStats.entries());
      const totalSuccesses = toolsUsed.reduce((sum, [, stats]) => sum + stats.successes, 0);
      const totalErrors = toolsUsed.reduce((sum, [, stats]) => sum + stats.errors, 0);
      
      console.log(chalk.gray(`   Total Tools Used: ${toolsUsed.length}`));
      console.log(chalk.gray(`   Total Successful Executions: ${chalk.green(totalSuccesses)}`));
      console.log(chalk.gray(`   Total Failed Executions: ${chalk.red(totalErrors)}`));
      console.log(chalk.gray(`   Success Rate: ${totalSuccesses + totalErrors > 0 ? ((totalSuccesses / (totalSuccesses + totalErrors)) * 100).toFixed(1) : 0}%`));
    }
    
    console.log(chalk.white.bold("\n Individual Tool Performance:"));
    
    if (this.toolUsageStats.size === 0) {
      console.log(chalk.gray("   No tool performance data available"));
    } else {
      Array.from(this.toolUsageStats.entries()).forEach(([toolName, stats]) => {
        const total = stats.successes + stats.errors;
        const successRate = total > 0 ? ((stats.successes / total) * 100).toFixed(1) : 0;
        
        console.log(chalk.cyan(`\n    ${toolName}:`));
        console.log(chalk.gray(`       Successes: ${stats.successes}`));
        console.log(chalk.gray(`       Errors: ${stats.errors}`));
        console.log(chalk.gray(`       Success Rate: ${successRate}%`));
        console.log(chalk.gray(`       Status: ${stats.errors === 0 ? chalk.green('WORKING CORRECTLY') : chalk.red('HAD ERRORS')}`));
        
        if (stats.errorMessages.length > 0) {
          console.log(chalk.gray(`       Error Messages:`));
          stats.errorMessages.forEach((error, index) => {
            console.log(chalk.red(`         ${index + 1}. ${error.substring(0, 100)}${error.length > 100 ? '...' : ''}`));
          });
        }
      });
    }
    
    console.log(chalk.white.bold("\n Step-by-Step Execution Flow:"));
    
    if (this.steps.length === 0) {
      console.log(chalk.gray("   No execution steps recorded"));
    } else {
      this.steps.forEach((step, index) => {
        const stepNumber = `${index + 1}`.padStart(2, '0');
        
        if (step.type === 'thought') {
          console.log(chalk.blue(`   ${stepNumber}.  THOUGHT: ${step.content}`));
        } else if (step.type === 'action') {
          const status = step.success !== undefined ? 
            (step.success ? chalk.green('[SUCCESS]') : chalk.red('[FAILED]')) : 
            chalk.yellow('[EXECUTED]');
          console.log(chalk.cyan(`   ${stepNumber}.  ACTION: ${step.content} ${status}`));
          if (step.arguments) {
            console.log(chalk.gray(`       Arguments: ${JSON.stringify(step.arguments)}`));
          }
        } else if (step.type === 'observation') {
          const status = step.success !== undefined ? 
            (step.success ? chalk.green('[SUCCESS]') : chalk.red('[ERROR]')) : 
            chalk.yellow('[RESULT]');
          const preview = step.content.substring(0, 150);
          console.log(chalk.green(`   ${stepNumber}.  OBSERVATION: ${status} ${preview}${step.content.length > 150 ? '...' : ''}`));
        }
      });
    }

    console.log(chalk.blueBright("\n" + "=".repeat(80)));
  }

  reset(): void {
    this.steps = [];
    this.toolUsageStats.clear();
    this.parameterRetryCount.clear();
    this.startTime = 0;
    this.endTime = 0;
  }
}

class ThoughtAgent {
  private tools: Tool[];
  private maxIterations: number = 10;
  private steps: ReActStep[] = [];
  private startTime: number = 0;
  private endTime: number = 0;

  constructor(tools: Tool[]) {
    this.tools = tools;
  }

  async callAI(messages: { role: string; content: string }[], tools: any[]) {
    const response = await fetch(AI_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${AI_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "Llama-3.3-70B-Instruct",
        messages,
        tools,
        tool_choice: "auto",
        max_tokens: 1024,
      }),
    });

    const data = await response.json();
    if (data.choices && data.choices.length > 0) {
      return data.choices[0].message;
    }
    throw new Error("No response");
  }

  formatToolsForAI(tools: Tool[]) {
    return tools.map((tool) => ({
      type: "function",
      function: {
        name: tool.name,
        description: tool.description,
        parameters: {
          type: "object",
          properties: tool.inputSchema.properties,
          required: tool.inputSchema.required || [],
        },
      },
    }));
  }

  createThoughtPrompt(query: string, steps: ReActStep[]): string {
    let prompt = `You are a planning assistant that suggests appropriate tools and parameters for tasks using the ReAct (Reasoning and Acting) pattern, but you do not execute the tools. Your job is to:

1. Analyze the user's query
2. Reason step-by-step about which tool(s) should be used
3. Suggest the tool and its parameters
4. Accept observations provided by the user
5. Provide reasoning for next steps or a final summary
6. Explicitly state when the task is complete by including phrases like "Task complete" or "Query resolved"

Available tools: ${this.tools.map(t => `${t.name} - ${t.description}`).join(', ')}

User Query: ${query}

`;

    if (steps.length > 0) {
      prompt += "\nPrevious steps:\n";
      steps.forEach((step, index) => {
        if (step.type === 'thought') {
          prompt += `Thought ${index + 1}: ${step.content}\n`;
        } else if (step.type === 'action') {
          prompt += `Suggested Action ${index + 1}: ${step.content} with arguments: ${JSON.stringify(step.arguments)}\n`;
        } else if (step.type === 'observation') {
          prompt += `Observation ${index + 1}: ${step.content}\n`;
        }
      });
    }

    prompt += "\nWhat should be done next? If a tool is needed, suggest it with appropriate parameters using the function calling capability. If the task is complete, explicitly state 'Task complete' or 'Query resolved' and provide a final summary. If an observation is needed, request it from the user.";

    return prompt;
  }

  async suggest(query: string): Promise<void> {
    console.log(chalk.blueBright(" Thought Agent starting..."));
    
    this.startTime = Date.now();
    let iteration = 0;
    let taskComplete = false;

    while (iteration < this.maxIterations && !taskComplete) {
      iteration++;
      console.log(chalk.gray(`\n--- Iteration ${iteration} ---`));

      try {
        const prompt = this.createThoughtPrompt(query, this.steps);
        const messages = [{ role: "user", content: prompt }];

        const aiResponse = await this.callAI(messages, this.formatToolsForAI(this.tools));

        if (aiResponse.tool_calls && aiResponse.tool_calls.length > 0) {
          for (const toolCall of aiResponse.tool_calls) {
            const tool = this.tools.find(t => t.name === toolCall.function.name);
            
            if (tool) {
              this.steps.push({
                type: 'thought',
                content: aiResponse.content || `Suggesting to use ${tool.name} to proceed.`
              });

              console.log(chalk.yellow(`Thought: Suggesting to use ${tool.name} to proceed.`));

              let parsedArgs;
              try {
                parsedArgs = typeof toolCall.function.arguments === 'string' 
                  ? JSON.parse(toolCall.function.arguments)
                  : toolCall.function.arguments;
              } catch (e) {
                parsedArgs = {};
              }

              console.log(chalk.cyan(` Suggested Action: Use ${tool.name} with arguments:`, JSON.stringify(parsedArgs, null, 2)));

              this.steps.push({
                type: 'action',
                content: `Suggesting ${tool.name}`,
                tool: tool.name,
                arguments: parsedArgs
              });

              const collectObservation = await confirm({
                message: `Would you like to provide an observation for the suggested ${tool.name} action?`,
                initialValue: false
              });

              if (!isCancel(collectObservation) && collectObservation) {
                const observation = await text({
                  message: `Please provide the observation for ${tool.name} action`,
                  placeholder: "Enter observation result or outcome"
                });

                if (isCancel(observation)) {
                  console.log(chalk.yellow(" User cancelled observation input. Ending execution."));
                  taskComplete = true;
                  break;
                }

                if (observation && observation.trim() !== "") {
                  this.steps.push({
                    type: 'observation',
                    content: observation
                  });
                  console.log(chalk.green(` Observation: ${observation}`));
                }
              }

              // Check if user wants to stop after this suggestion
              const continueExecution = await confirm({
                message: `The tool ${tool.name} was suggested. Is the task complete?`,
                initialValue: false
              });

              if (!isCancel(continueExecution) && continueExecution) {
                taskComplete = true;
                console.log(chalk.green.bold("\n User confirmed task completion."));
                break;
              }
            } else {
              console.log(chalk.red(` Tool ${toolCall.function.name} not found`));
            }
          }
        } else {
          console.log(chalk.green(` AI Response: ${aiResponse.content}`));
          
          const completionIndicators = [
            'task is complete',
            'finished',
            'done',
            'successfully completed',
            'final answer',
            'summary:',
            'in conclusion',
            'task complete',
            'query resolved'
          ];
          
          const responseContent = aiResponse.content?.toLowerCase() || '';
          const isComplete = completionIndicators.some(indicator => 
            responseContent.includes(indicator)
          );

          if (isComplete) {
            taskComplete = true;
            console.log(chalk.green.bold("\n Task analysis completed successfully!"));
          } else {
            this.steps.push({
              type: 'thought',
              content: aiResponse.content || "Continuing to analyze..."
            });

            const collectObservation = await confirm({
              message: `Would you like to provide an observation to continue the analysis?`,
              initialValue: false
            });

            if (!isCancel(collectObservation) && collectObservation) {
              const observation = await text({
                message: `Please provide the observation to continue analysis`,
                placeholder: "Enter observation or additional information"
              });

              if (isCancel(observation)) {
                console.log(chalk.yellow(" User cancelled observation input. Ending execution."));
                taskComplete = true;
              } else if (observation && observation.trim() !== "") {
                this.steps.push({
                  type: 'observation',
                  content: observation
                });
                console.log(chalk.green(` Observation: ${observation}`));
              }
            }

            // Check if user wants to stop after this thought
            const continueExecution = await confirm({
              message: `The AI provided a response. Is the task complete?`,
              initialValue: false
            });

            if (!isCancel(continueExecution) && continueExecution) {
              taskComplete = true;
              console.log(chalk.green.bold("\n User confirmed task completion."));
            }
          }
        }

        if (!taskComplete && iteration < this.maxIterations) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }

      } catch (error) {
        console.error(chalk.red(` Error in iteration ${iteration}:`), error);
        break;
      }
    }

    this.endTime = Date.now();

    if (iteration >= this.maxIterations && !taskComplete) {
      console.log(chalk.yellow(" Maximum iterations reached. Task analysis may not be complete."));
    }

    this.displayFinalSummary(query, taskComplete, iteration);
  }

  private displayFinalSummary(query: string, taskComplete: boolean, iterations: number): void {
    const executionTime = ((this.endTime - this.startTime) / 1000).toFixed(2);
    
    console.log(chalk.blueBright("\n" + "=".repeat(80)));
    console.log(chalk.blueBright.bold(" THOUGHT AGENT SUMMARY"));
    console.log(chalk.blueBright("=".repeat(80)));
    
    console.log(chalk.white.bold("\n Basic Information:"));
    console.log(chalk.gray(` Query: ${query}`));
    console.log(chalk.gray(` Execution Time: ${executionTime} seconds`));
    console.log(chalk.gray(` Iterations: ${iterations}`));
    console.log(chalk.gray(` Task Status: ${taskComplete ? chalk.green('COMPLETED') : chalk.red('INCOMPLETE')}`));
    
    console.log(chalk.white.bold("\n Step-by-Step Analysis Flow:"));
    
    if (this.steps.length === 0) {
      console.log(chalk.gray("   No analysis steps recorded"));
    } else {
      this.steps.forEach((step, index) => {
        const stepNumber = `${index + 1}`.padStart(2, '0');
        
        if (step.type === 'thought') {
          console.log(chalk.blue(`   ${stepNumber}.  THOUGHT: ${step.content}`));
        } else if (step.type === 'action') {
          console.log(chalk.cyan(`   ${stepNumber}.  SUGGESTED ACTION: ${step.content}`));
          if (step.arguments) {
            console.log(chalk.gray(`       Arguments: ${JSON.stringify(step.arguments)}`));
          }
        } else if (step.type === 'observation') {
          console.log(chalk.green(`   ${stepNumber}.  OBSERVATION: ${step.content.substring(0, 150)}${step.content.length > 150 ? '...' : ''}`));
        }
      });
    }

    console.log(chalk.blueBright("\n" + "=".repeat(80)));
  }

  reset(): void {
    this.steps = [];
    this.startTime = 0;
    this.endTime = 0;
  }
}

async function collectToolArguments(tool: Tool, toolCall: any) {
  const args: Record<string, any> = {};
  const providedArgs = toolCall.arguments || {};
  const requiredFields = tool.inputSchema.required || [];

  Object.assign(args, providedArgs);

  for (const key of Object.keys(tool.inputSchema.properties ?? {})) {
    if (args[key] === undefined || args[key] === "") {
      const isRequired = requiredFields.includes(key);
      if (isRequired) {
        const property = tool.inputSchema.properties[key];
        const fieldDescription = property?.description || `${key} parameter`;
        
        console.log(chalk.cyan(`\n Parameter: ${key}`));
        console.log(chalk.gray(` Description: ${fieldDescription}`));
        
        if (property?.enum) {
          console.log(chalk.gray(` Allowed values: ${property.enum.join(', ')}`));
        }

        const label = `${key} (required)`;
        const answer = await text({ 
          message: label, 
          placeholder: fieldDescription,
          initialValue: typeof providedArgs[key] === 'string' ? providedArgs[key] : "" 
        });

        if (isCancel(answer)) process.exit(0);
        args[key] = answer;
      }
    }
  }

  return args;
}

async function callAI(messages: { role: string; content: string }[], tools: any[]) {
  const response = await fetch(AI_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${AI_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "Llama-3.3-70B-Instruct",
      messages,
      tools,
      tool_choice: "auto", 
      max_tokens: 1024,
    }),
  });

  const data = await response.json();
  if (data.choices && data.choices.length > 0) {
    return data.choices[0].message;
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

  const reactAgent = new ReActAgent(tools);
  const thoughtAgent = new ThoughtAgent(tools);

  function formatToolsForAI(tools: Tool[]) {
    return tools.map((tool) => ({
      type: "function",
      function: {
        name: tool.name,
        description: tool.description,
        parameters: {
          type: "object",
          properties: tool.inputSchema.properties,
          required: tool.inputSchema.required || [],
        },
      },
    }));
  }

  function dumpContent(content: Content[]) {
    for (const c of content) {
      try {
        console.log(JSON.parse(c.text));
      } catch {
        console.log(c.text);
      }
    }
  }

  while (true) {
    const action = await select({
      message: "What would you like to do?",
      options: [
        { value: "react", label: "Ask ReAct Agent (Advanced AI with multi-tool support)" },
        { value: "ai", label: "Ask AI (Basic single-tool support)" },
        ...(tools.length > 0 ? [{ value: "tool", label: "Manually run a tool" }] : []),
        { value: "thought", label: "Ask Thought Agent (Suggests tools and parameters without execution)" },
      ],
    });
    if (isCancel(action)) process.exit(0);

    if (action === "react") {
      const promptValue = await text({
        message: "What would you like me to help you with?",
        defaultValue: "Create a new repository called 'my-project', add a README file, and create an issue to add documentation",
      });

      if (isCancel(promptValue)) process.exit(0);

      try {
        reactAgent.reset();
        await reactAgent.execute(promptValue, send);
      } catch (error) {
        console.error(chalk.red("Error:"), error);
      }
    }

    if (action === "tool") {
      const categorized = tools.reduce((acc: Record<string, Tool[]>, tool) => {
        const category = (tool as any).category || "Uncategorized";
        acc[category] = acc[category] || [];
        acc[category].push(tool);
        return acc;
      }, {});

      const category = await select({
        message: "Select a category.",
        options: Object.keys(categorized).map((cat) => ({ value: cat, label: cat })),
      });
      if (isCancel(category)) process.exit(0);

      const tool = await select({
        message: "Select a tool.",
        options: categorized[category].map((tool) => ({ value: tool, label: tool.name })),
      });

      if (isCancel(tool)) process.exit(0);

      const args: Record<string, any> = {};
      const requiredFields = tool.inputSchema.required || [];

      for (const key of Object.keys(tool.inputSchema.properties ?? {})) {
        const property = tool.inputSchema.properties[key];
        const isRequired = requiredFields.includes(key);
        const fieldDescription = property?.description || `${key} parameter`;
        
        console.log(chalk.cyan(`\n Parameter: ${key}`));
        console.log(chalk.gray(` Description: ${fieldDescription}`));
        
        if (property?.enum) {
          console.log(chalk.gray(` Allowed values: ${property.enum.join(', ')}`));
        }
        
        if (property?.type) {
          console.log(chalk.gray(` Type: ${property.type}`));
        }

        const label = `${key} (${isRequired ? "required" : "optional"})`;
        const answer = await text({ 
          message: label, 
          placeholder: fieldDescription,
          initialValue: "" 
        });

        if (isCancel(answer)) process.exit(0);

        if (isRequired || answer !== "") {
          args[key] = answer;
        }
      }

      try {
        const { content }: { content: Content[] } = await send("tools/call", {
          name: tool.name,
          arguments: args,
        });

        dumpContent(content);
      } catch (error) {
        console.error(chalk.red("Tool execution error:"), error);
      }
    }

    if (action === "ai") {
      const promptValue = await text({
        message: "What would you like me to help you with?",
        defaultValue: "Create a new repository called 'my-project'",
      });

      if (isCancel(promptValue)) process.exit(0);

      try {
        const messages: { role: string; content: string }[] = [
          { role: "user", content: promptValue }
        ];

        const aiResponse = await callAI(messages, formatToolsForAI(tools));
        
        if (aiResponse.tool_calls && aiResponse.tool_calls.length > 0) {
          const toolCall = aiResponse.tool_calls[0];
          const tool = tools.find(t => t.name === toolCall.function.name);
          
          if (tool) {
            console.log(chalk.blueBright(
              `AI wants to use tool: ${tool.name} - ${tool.description}`
            ));

            let parsedArgs;
            try {
              parsedArgs = typeof toolCall.function.arguments === 'string' 
                ? JSON.parse(toolCall.function.arguments)
                : toolCall.function.arguments;
            } catch (e) {
              parsedArgs = {};
            }

            const args = await collectToolArguments(tool, { arguments: parsedArgs });

            console.log(chalk.yellow(`Calling ${tool.name} with arguments:`, JSON.stringify(args, null, 2)));

            const { content }: { content: Content[] } = await send("tools/call", {
              name: tool.name,
              arguments: args,
            });

            dumpContent(content);

            messages.push({
              role: "assistant", 
              content: aiResponse.content || `I'm calling the ${tool.name} tool for you.`
            });
            messages.push({
              role: "user",
              content: `Tool result: ${content.map(c => c.text).join('\n')}`
            });

            const followUpResponse = await callAI(messages, []);
            console.log(chalk.green("AI:"), followUpResponse.content);
          } else {
            console.log(chalk.red(`Tool ${toolCall.function.name} not found`));
          }
        } else {
          console.log(chalk.green("AI:"), aiResponse.content);
        }
      } catch (error) {
        console.error(chalk.red("Error:"), error);
      }
    }

    if (action === "thought") {
      const promptValue = await text({
        message: "What would you like me to help you with?",
        defaultValue: "Create a new repository called 'my-project', add a README file, and create an issue to add documentation",
      });

      if (isCancel(promptValue)) process.exit(0);

      try {
        thoughtAgent.reset();
        await thoughtAgent.suggest(promptValue);
      } catch (error) {
        console.error(chalk.red("Error:"), error);
      }
    }
  }
})();