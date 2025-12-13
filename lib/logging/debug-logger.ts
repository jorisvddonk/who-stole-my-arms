export const DEBUG_COLOR = '\x1b[32m';
export const GLOBAL_COLOR = '\x1b[34m';
export const AGENT_COLOR = '\x1b[1;32m';
export const TOOL_COLOR = '\x1b[1;35m';
export const YELLOW = '\x1b[33m';
export const BRIGHT_YELLOW = '\x1b[1;33m';
export const RESET = '\x1b[0m';

export abstract class Logger {
    private static debugMode: boolean = false;

    static setDebugMode(mode: boolean) {
        Logger.debugMode = mode;
    }

    static debugLog(message: string) {
        if (Logger.debugMode) console.log(`${DEBUG_COLOR}[DEBUG]${RESET} ${message}`);
    }

    static globalLog(message: string) {
        if (Logger.debugMode) console.log(`${GLOBAL_COLOR}[GLOBAL]${RESET} ${message}`);
    }
}