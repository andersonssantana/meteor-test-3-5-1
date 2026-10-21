import assert from "assert";
import { Meteor } from "meteor/meteor";
import { FIXTURE_VERSION, runtimePayload } from "../server/mcp-runtime-fixture";

describe("test-3-5-1", function () {
  it("package.json has correct name", async function () {
    const { name } = await import("../package.json");
    assert.strictEqual(name, "test-3-5-1");
  });

  if (Meteor.isClient) {
    it("client is not server", function () {
      assert.strictEqual(Meteor.isServer, false);
    });
  }

  if (Meteor.isServer) {
    it("server is not client", function () {
      assert.strictEqual(Meteor.isClient, false);
    });

    it("runtime fixture exposes only its version and the approved dummy value", function () {
      const payload = runtimePayload({
        MCP_TEST_MESSAGE: "hello-after-update",
        UNRELATED_SECRET: "do-not-expose-this-test-sentinel",
      });
      assert.deepStrictEqual(payload, {
        version: FIXTURE_VERSION,
        message: "hello-after-update",
      });
      assert.match(FIXTURE_VERSION, /^customer-mcp-fixture-v[12]$/);
    });

    it("runtime fixture suppresses an arbitrary value even in the dummy key", function () {
      assert.strictEqual(runtimePayload({ MCP_TEST_MESSAGE: "unexpected-test-sentinel" }).message, null);
    });
  }
});
