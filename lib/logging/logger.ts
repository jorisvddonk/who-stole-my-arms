export function logRequest(req: Request, sessionId?: string | null, componentName?: string | null) {
  const url = new URL(req.url);
  const datePart = `\x1b[33m${new Date().toISOString()}\x1b[0m`; // Yellow
  const sessionPart = sessionId ? `\x1b[34m[${sessionId}]\x1b[0m` : ''; // Blue
  const componentPart = componentName ? `\x1b[32m[${componentName}]\x1b[0m` : ''; // Green
  console.log(`${datePart} - ${sessionPart}${componentPart} ${req.method} ${url.pathname}`);
}

export function logGenerate(prompt: string, responseLength: number) {
  console.log(`Generating for prompt: ${prompt.substring(0, 50)}...`);
  console.log(`Generated response length: ${responseLength}`);
}

export function logError(message: string) {
  console.error(`Error: ${message}`);
}

export function logToolCall(toolName: string, args: Record<string, any>, result: any, sessionId?: string | null) {
  const datePart = `\x1b[33m${new Date().toISOString()}\x1b[0m`; // Yellow
  const sessionPart = sessionId ? `\x1b[34m[${sessionId}]\x1b[0m` : ''; // Blue
  const toolPart = `\x1b[35m[TOOL:${toolName}]\x1b[0m`; // Magenta
  console.log(`${datePart} - ${sessionPart}${toolPart} Called with args: ${JSON.stringify(args)} -> Result: ${JSON.stringify(result)}`);
}