export function logRequest(req: Request) {
  const url = new URL(req.url);
  console.log(`${new Date().toISOString()} - ${req.method} ${url.pathname}`);
}

export function logGenerate(prompt: string, responseLength: number) {
  console.log(`Generating for prompt: ${prompt.substring(0, 50)}...`);
  console.log(`Generated response length: ${responseLength}`);
}

export function logError(message: string) {
  console.error(`Error: ${message}`);
}