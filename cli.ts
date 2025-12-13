import { KoboldAPI } from './lib/llm-api/KoboldAPI.js';
import { LLMAgent, ChunkType, Chunk, Task, Tool } from './lib/core/LLMAgent';
import { Arena } from './lib/core/Arena';
import { AgentManager } from './lib/agents/AgentManager.js';
import { Logger, DEBUG_COLOR, GLOBAL_COLOR, AGENT_COLOR, TOOL_COLOR, YELLOW, BRIGHT_YELLOW, RESET } from './lib/logging/debug-logger';
import prompts from 'prompts';
import { Command } from 'commander';

let ROOT_AGENT_NAME: string;

const koboldAPI = new KoboldAPI();
Logger.setDebugMode(process.argv.includes('--debug'));

const agentManager = AgentManager.getInstance();
await agentManager.init(koboldAPI);

const arena = new Arena(koboldAPI, agentManager);

arena.eventEmitter.on('parseError', (details: any) => {
    if (details.agentName) {
        Logger.globalLog(`ParseError from ${AGENT_COLOR}${details.agentName}${RESET}: ${details.type} - ${details.error}`);
    } else {
        Logger.globalLog(`ParseError: ${details.type} - ${details.error}`);
    }
});

arena.eventEmitter.on('error', (details: any) => {
    if (details.agentName) {
        Logger.globalLog(`Error from ${AGENT_COLOR}${details.agentName}${RESET}: ${details.error}`);
    } else {
        Logger.globalLog(`Error: ${details.error}`);
    }
});

arena.eventEmitter.on('toolCall', (details: any) => {
    if (details.agentName) {
        Logger.globalLog(`ToolCall from ${AGENT_COLOR}${details.agentName}${RESET}: ${TOOL_COLOR}${details.call.name}${RESET} with ${JSON.stringify(details.call.parameters)}`);
    } else {
        Logger.globalLog(`ToolCall: ${TOOL_COLOR}${details.call.name}${RESET} with ${JSON.stringify(details.call.parameters)}`);
    }
});

arena.eventEmitter.on('agentCall', (details: any) => {
    if (details.agentName) {
        Logger.globalLog(`AgentCall from ${AGENT_COLOR}${details.agentName}${RESET}: ${TOOL_COLOR}${details.call.name}${RESET} with ${JSON.stringify(details.call.input)}`);
    } else {
        Logger.globalLog(`AgentCall: ${TOOL_COLOR}${details.call.name}${RESET} with ${JSON.stringify(details.call.input)}`);
    }
});

arena.eventEmitter.on('chunk', (details: any) => {
    if (details.agentName) {
        Logger.globalLog(`Chunk from ${AGENT_COLOR}${details.agentName}${RESET}: ${details.chunk.type} - ${details.chunk.content}`);
    } else {
        Logger.globalLog(`Chunk: ${details.chunk.type} - ${details.chunk.content}`);
    }
});

async function handle_user_input(text: string, arena: Arena, isInteractive: boolean = false) {
    arena.errorCount = 0;
    Logger.debugLog(`Handling user input: "${text}"`);

    if (!arena.currentContinuationTask) {
        // Create new root task
        const rootTask: Task = {
            id: Arena.generateId(),
            agent_name: ROOT_AGENT_NAME,
            input: text,
            parent_task_id: null,
            scratchpad: [{ type: ChunkType.Input, content: text, processed: true }],
            retryCount: 0
        };
        Logger.debugLog(`Created root task ${rootTask.id} (${AGENT_COLOR}${rootTask.agent_name}${RESET})`);
        arena.taskStore[rootTask.id] = rootTask;
        arena.currentContinuationTask = rootTask;
        arena.taskQueue.push(rootTask);
    } else {
        // Append to existing scratchpad and re-queue
        const newInputChunk = { type: ChunkType.Input, content: text, processed: true };
        arena.agents[ROOT_AGENT_NAME].addChunk(arena.currentContinuationTask, newInputChunk);
        arena.taskQueue.push(arena.currentContinuationTask);
        Logger.debugLog(`Appended new input to existing continuation task ${arena.currentContinuationTask!.id}`);
    }

    await arena.run_event_loop(isInteractive);
}

// Debug REPL
async function startDebugRepl(arena: Arena) {
    Logger.globalLog('startDebugRepl called');
    console.log('\n\x1b[1;36m=== DEBUG REPL ===\x1b[0m');
    console.log('\x1b[1;33mAvailable commands:\x1b[0m');
    console.log('  \x1b[1;32m/invocations\x1b[0m  - Show invocation tree');
    console.log('  \x1b[1;32m/tasks\x1b[0m        - List all tasks');
    console.log('  \x1b[1;32m/task <id>\x1b[0m    - Show details of specific task');
    console.log('  \x1b[1;32m/queue\x1b[0m        - Show current task queue');
    console.log('  \x1b[1;32m/clear\x1b[0m        - Clear invocation history');
    console.log('  \x1b[1;32m/help\x1b[0m         - Show this help');
    console.log('  \x1b[1;32m/exit\x1b[0m         - Exit REPL');
    console.log('\x1b[1;36m==================\x1b[0m\n');

    Logger.globalLog(`stdin isTTY: ${process.stdin.isTTY}`);
    // Use Node.js readline since Bun supports it
    const readline = await import('readline');
    Logger.globalLog('readline imported');
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        prompt: '\x1b[1;31mdebug>\x1b[1;37m '
    });
    Logger.globalLog('interface created');

    const askCommand = () => {
        Logger.globalLog('setting prompt');
        rl.prompt();

        rl.once('line', (line) => {
            Logger.globalLog(`line received: ${line}`);
            // Reset terminal colors
            process.stdout.write('\x1b[0m');

            const trimmedLine = line.trim();
            const args = trimmedLine.split(/\s+/);
            let command = args[0]?.toLowerCase() || '';

            // Handle slash commands
            if (command.startsWith('/')) {
                command = command.substring(1);
            }

            switch (command) {
                case 'invocations':
                    Logger.globalLog('handling invocations');
                    arena.printInvocationTree();
                    askCommand();
                    break;
                case 'tasks':
                    Logger.globalLog('handling tasks');
                    console.log('\x1b[1;33mAll tasks:\x1b[0m');
                    Object.values(arena.taskStore).forEach((task: Task) => {
                        console.log(`  \x1b[90m${task.id}\x1b[0m: \x1b[1;32m${task.agent_name}\x1b[0m (parent: \x1b[90m${task.parent_task_id || 'none'}\x1b[0m, retries: \x1b[1;33m${task.retryCount}\x1b[0m)`);
                    });
                    askCommand();
                    break;
                case 'task':
                    Logger.globalLog('handling task');
                    if (args[1]) {
                        const task = arena.taskStore[args[1]];
                        if (task) {
                            console.log(`\x1b[1;33mTask \x1b[90m${task.id}\x1b[33m:\x1b[0m`);
                            console.log(`  \x1b[36m├──\x1b[0m Agent: \x1b[1;32m${task.agent_name}\x1b[0m`);
                            console.log(`  \x1b[36m├──\x1b[0m Parent: \x1b[90m${task.parent_task_id || 'none'}\x1b[0m`);
                            console.log(`  \x1b[36m├──\x1b[0m Retry Count: \x1b[1;33m${task.retryCount}\x1b[0m`);
                            console.log(`  \x1b[36m├──\x1b[0m Input:\x1b[0m`);
                            console.log(`  \x1b[36m│\x1b[0m   \x1b[35m${JSON.stringify(task.input, null, 2).replace(/\n/g, '\n  \x1b[36m│\x1b[0m   \x1b[35m')}\x1b[0m`);
                            console.log(`  \x1b[36m└──\x1b[0m Scratchpad:\x1b[0m`);
                            if (task.scratchpad.length === 0) {
                                console.log(`      \x1b[33m(empty)\x1b[0m`);
                            } else {
                                task.scratchpad.forEach((chunk, index) => {
                                    let typeColor = '\x1b[34m'; // default blue for llmOutput
                                    if (chunk.type === ChunkType.Input) typeColor = '\x1b[32m'; // green
                                    else if (chunk.type === ChunkType.ToolOutput) typeColor = '\x1b[33m'; // yellow
                                    else if (chunk.type === ChunkType.AgentOutput) typeColor = '\x1b[36m'; // cyan
                                    else if (chunk.type === ChunkType.Error) typeColor = '\x1b[31m'; // red
                                    const processedColor = chunk.processed ? '\x1b[32m✓' : '\x1b[31m✗';
                                    console.log(`      \x1b[36m${index}\x1b[0m: ${typeColor}${chunk.type}\x1b[0m ${processedColor}\x1b[0m - \x1b[35m${chunk.content}\x1b[0m`);
                                });
                            }
                        } else {
                            console.log(`\x1b[31mTask ${args[1]} not found\x1b[0m`);
                        }
                    } else {
                        console.log('\x1b[31mUsage: /task <id>\x1b[0m');
                    }
                    askCommand();
                    break;
                case 'queue':
                    Logger.globalLog('handling queue');
                    console.log('\x1b[1;33mCurrent task queue:\x1b[0m');
                    if (arena.taskQueue.length === 0) {
                        console.log('  \x1b[32m(empty)\x1b[0m');
                    } else {
                        arena.taskQueue.forEach((task: Task, index: number) => {
                            console.log(`  \x1b[90m${index}\x1b[0m: \x1b[90m${task.id}\x1b[0m (\x1b[1;32m${task.agent_name}\x1b[0m)`);
                        });
                    }
                    askCommand();
                    break;
                case 'clear':
                    Logger.globalLog('handling clear');
                    arena.invocationLog.length = 0;
                    for (const key in arena.taskStore) {
                        delete arena.taskStore[key];
                    }
                    arena.taskQueue.length = 0;
                    arena.errorCount = 0;
                    console.log('\x1b[32mInvocation history and tasks cleared\x1b[0m');
                    askCommand();
                    break;
                case 'help':
                    Logger.globalLog('handling help');
                    console.log('\x1b[1;33mAvailable commands:\x1b[0m');
                    console.log('  \x1b[1;32m/invocations\x1b[0m  - Show invocation tree');
                    console.log('  \x1b[1;32m/tasks\x1b[0m        - List all tasks');
                    console.log('  \x1b[1;32m/task <id>\x1b[0m    - Show details of specific task');
                    console.log('  \x1b[1;32m/queue\x1b[0m        - Show current task queue');
                    console.log('  \x1b[1;32m/clear\x1b[0m        - Clear invocation history');
                    console.log('  \x1b[1;32m/help\x1b[0m         - Show this help');
                    console.log('  \x1b[1;32m/exit\x1b[0m         - Exit REPL');
                    askCommand();
                    break;
                case 'exit':
                case 'quit':
                    Logger.globalLog('exiting repl');
                    console.log('\x1b[32mExiting debug REPL...\x1b[0m');
                    rl.close();
                    return;
                case '':
                    Logger.globalLog('empty command');
                    askCommand();
                    break;
                default:
                    Logger.globalLog(`unknown command: ${command}`);
                    if (trimmedLine && !trimmedLine.startsWith('/')) {
                        handle_user_input(trimmedLine, arena, true).then(() => askCommand()).catch((err) => {
                            console.error('Error handling user input:', err);
                            askCommand();
                        });
                    } else {
                        console.log(`\x1b[31mUnknown command: ${command}\x1b[0m`);
                        askCommand();
                    }
                    break;
            }
        });
    };

    askCommand();
}

// Simple interactive prompt
async function startInteractivePrompt(arena: Arena) {
    const readline = await import('readline');
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        prompt: '> '
    });

    console.log('Interactive prompt started. Type your message or "exit" to quit.');

    const askInput = () => {
        rl.prompt();
        rl.once('line', async (line) => {
            const input = line.trim();
            if (input.toLowerCase() === 'exit') {
                console.log('Exiting...');
                rl.close();
                return;
            }
            if (input) {
                try {
                    await handle_user_input(input, arena, true);
                } catch (err) {
                    console.error('Error:', err);
                }
            }
            askInput();
        });
    };

    askInput();
}

// Example usage
async function main() {
    Logger.globalLog('main started');
    const program = new Command();
    program
        .option('--agent <name>', 'specify agent name')
        .option('--prompt <text>', 'set the user prompt text')
        .option('--repl', 'start debug REPL')
        .option('--debug', 'enable debug logging')
        .option('--list-agents', 'list available agents and exit');
    program.parse();
    const options = program.opts();

    if (options.listAgents) {
        console.log(Object.keys(arena.agents).join('\n'));
        return;
    }

    Logger.setDebugMode(options.debug || process.argv.includes('--debug'));
    Logger.globalLog('debug mode set');

    if (options.agent) {
        ROOT_AGENT_NAME = options.agent;
        Logger.globalLog(`agent set to ${ROOT_AGENT_NAME}`);
    } else {
        const agentNames = Object.keys(arena.agents);
        const response = await prompts({
            type: 'select',
            name: 'agent',
            message: 'Which agent would you like to use?',
            choices: agentNames.map(name => ({ title: name, value: name })),
        });
        ROOT_AGENT_NAME = response.agent;
    }

    let userInput: string | null = null;

    if (options.prompt) {
        userInput = options.prompt;
        Logger.globalLog(`user input from prompt: ${userInput}`);
    } else if (!process.stdin.isTTY) {
        // Read from stdin
        const chunks: Buffer[] = [];
        for await (const chunk of process.stdin) {
            chunks.push(chunk);
        }
        userInput = Buffer.concat(chunks).toString().trim();
        Logger.globalLog(`user input from stdin: ${userInput}`);
    }

    if (userInput) {
        Logger.globalLog('handling user input');
        await handle_user_input(userInput, arena);
        Logger.globalLog('user input handled');
    }

    if (options.repl) {
        Logger.globalLog('starting repl');
        await startDebugRepl(arena);
        Logger.globalLog('repl finished');
    } else if (!userInput) {
        Logger.globalLog('starting interactive prompt');
        await startInteractivePrompt(arena);
        Logger.globalLog('interactive prompt finished');
    }
    Logger.globalLog('main ending');
}

main().catch(console.error);