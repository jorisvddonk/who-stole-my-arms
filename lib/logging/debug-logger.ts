export const DEBUG_COLOR = '\x1b[32m';
/** ANSI color code for global messages */
export const GLOBAL_COLOR = '\x1b[34m';
/** ANSI color code for agent-related messages */
export const AGENT_COLOR = '\x1b[1;32m';
/** ANSI color code for tool-related messages */
export const TOOL_COLOR = '\x1b[1;35m';
/** ANSI color code for yellow text */
export const YELLOW = '\x1b[33m';
/** ANSI color code for bright yellow text */
export const BRIGHT_YELLOW = '\x1b[1;33m';
/** ANSI color code to reset text formatting */
export const RESET = '\x1b[0m';

/**
 * Abstract logger class providing debug and global logging functionality.
 */
export abstract class Logger {
    private static debugMode: boolean = false;

    /**
     * Enables or disables debug mode for logging.
     * @param mode Whether debug logging should be enabled
     */
    static setDebugMode(mode: boolean) {
        Logger.debugMode = mode;
    }

    /**
     * Logs a debug message if debug mode is enabled.
     * @param message The message to log
     */
    static debugLog(message: string) {
        if (Logger.debugMode) console.log(`${DEBUG_COLOR}[DEBUG]${RESET} ${message}`);
    }

    /**
     * Logs a global message if debug mode is enabled.
     * @param message The message to log
     */
    static globalLog(message: string) {
        if (Logger.debugMode) console.log(`${GLOBAL_COLOR}[GLOBAL]${RESET} ${message}`);
    }
}