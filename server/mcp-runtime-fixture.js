export const FIXTURE_VERSION = "customer-mcp-fixture-v1";
export const RUNTIME_PATH = "/__mcp-test/runtime";

const dummyMessages = new Set([
  "hello-from-the-customer-flow",
  "hello-after-update",
]);

export function runtimePayload(environment = process.env) {
  // Intentionally read one allowlisted dummy key, never enumerate the environment.
  const message = environment.MCP_TEST_MESSAGE;
  return {
    version: FIXTURE_VERSION,
    message: dummyMessages.has(message) ? message : null,
  };
}

export function createRuntimeHandler(environment = process.env) {
  return (request, response, next) => {
    if (request.url?.split("?")[0] !== RUNTIME_PATH) {
      next();
      return;
    }

    response.setHeader("Cache-Control", "no-store");
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("Content-Type", "application/json; charset=utf-8");

    if (request.method !== "GET" && request.method !== "HEAD") {
      response.setHeader("Allow", "GET, HEAD");
      response.writeHead(405);
      response.end();
      return;
    }

    response.writeHead(200);
    response.end(
      request.method === "HEAD" ? undefined : JSON.stringify(runtimePayload(environment)),
    );
  };
}
