import { Meteor } from "meteor/meteor";
import { collectRuntimeIdentity } from "./runtime-identity.mjs";

Meteor.startup(() => {
  // One private server log per process start. No method, publication or HTTP
  // endpoint returns this snapshot to a browser.
  console.info("[runtime-identity] " + JSON.stringify({
    ...collectRuntimeIdentity(),
    meteorRelease: Meteor.release,
    observedAt: new Date().toISOString(),
  }));
});
