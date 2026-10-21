import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { test } from "node:test";
import {
  FIXTURE_VERSION,
  RUNTIME_PATH,
  createRuntimeHandler,
  runtimePayload,
} from "../server/mcp-runtime-fixture.js";

test("payload reads only the dummy key and exposes exactly two fields", () => {
  const reads = [];
  const environment = new Proxy({}, {
    get(_target, key) {
      reads.push(key);
      assert.equal(key, "MCP_TEST_MESSAGE");
      return "hello-after-update";
    },
    ownKeys() {
      assert.fail("The endpoint must never enumerate environment keys");
    },
  });
  assert.deepEqual(runtimePayload(environment), {
    version: FIXTURE_VERSION,
    message: "hello-after-update",
  });
  assert.deepEqual(reads, ["MCP_TEST_MESSAGE"]);
});

test("only approved dummy strings are exposed; unset and arbitrary values become null", () => {
  for (const value of [undefined, "", "not-an-approved-dummy-value", 123, null]) {
    assert.equal(runtimePayload({ MCP_TEST_MESSAGE: value }).message, null);
  }
  for (const value of ["hello-from-the-customer-flow", "hello-after-update"]) {
    assert.equal(runtimePayload({ MCP_TEST_MESSAGE: value }).message, value);
  }
  assert.match(FIXTURE_VERSION, /^customer-mcp-fixture-v[12]$/);
});

test("HTTP endpoint is uncached, bounded, read-only, and observes the supplied runtime value", async (t) => {
  const environment = {
    MCP_TEST_MESSAGE: "hello-from-the-customer-flow",
    UNRELATED_SECRET: "do-not-expose-this-test-sentinel",
  };
  const handler = createRuntimeHandler(environment);
  const server = createServer((request, response) => {
    handler(request, response, () => {
      response.writeHead(404);
      response.end();
    });
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
    server.closeAllConnections();
  }));
  const url = `http://127.0.0.1:${server.address().port}${RUNTIME_PATH}`;

  const first = await fetch(`${url}?key=UNRELATED_SECRET`);
  assert.equal(first.status, 200);
  assert.equal(first.headers.get("cache-control"), "no-store");
  assert.equal(first.headers.get("x-content-type-options"), "nosniff");
  assert.match(first.headers.get("content-type"), /^application\/json/);
  assert.deepEqual(await first.json(), {
    version: FIXTURE_VERSION,
    message: "hello-from-the-customer-flow",
  });

  environment.MCP_TEST_MESSAGE = "hello-after-update";
  assert.equal((await (await fetch(url)).json()).message, "hello-after-update");
  environment.MCP_TEST_MESSAGE = environment.UNRELATED_SECRET;
  assert.deepEqual(await (await fetch(url)).json(), { version: FIXTURE_VERSION, message: null });

  const head = await fetch(url, { method: "HEAD" });
  assert.equal(head.status, 200);
  assert.equal(await head.text(), "");
  for (const method of ["POST", "PUT", "DELETE"]) {
    const result = await fetch(url, { method });
    assert.equal(result.status, 405);
    assert.equal(result.headers.get("allow"), "GET, HEAD");
    assert.equal(await result.text(), "");
  }
  for (const path of ["/", "/__mcp-test/runtime/extra", "/__mcp-test/runtime.json"]) {
    assert.equal((await fetch(new URL(path, url))).status, 404);
  }
});
