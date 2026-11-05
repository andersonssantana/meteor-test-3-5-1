import assert from "node:assert/strict";
import { test } from "node:test";
import { collectRuntimeIdentity, parseCgroupIdentifiers } from "../server/runtime-identity.mjs";

test("only approved identity fields are collected, never credentials or settings", () => {
  const snapshot = collectRuntimeIdentity({
    env: {
      HOSTNAME: "test-app-7bc6b789d5-abc12",
      MONTI_OPTIONS_HOSTNAME: "test-app-7bc6b789d5-abc12",
      KADIRA_OPTIONS_HOSTNAME: "legacy-test-host",
      POD_UID: "12345678-abcd-1234-abcd-123456789abc",
      MONTI_APP_SECRET: "secret-sentinel",
      MONTI_APP_ID: "private-app-sentinel",
      MONGO_URL: "mongodb://secret-sentinel",
      METEOR_SETTINGS: '{"private":"secret-sentinel"}',
      OTHER_ENV: "unknown-sentinel",
    },
    getHostname: () => "test-app-7bc6b789d5-abc12",
    readCgroup: () => "0::/\n",
    newProcessId: () => "local-correlation-id",
  });
  assert.equal(snapshot.environment.MONTI_OPTIONS_HOSTNAME, snapshot.osHostname);
  assert.equal(snapshot.environment.KADIRA_OPTIONS_HOSTNAME, "legacy-test-host");
  assert.equal(snapshot.environment.POD_UID, "12345678-abcd-1234-abcd-123456789abc");
  assert.equal(snapshot.environment.GALAXY_CONTAINER_ID, null);
  assert.deepEqual(Object.keys(snapshot.environment), [
    "HOSTNAME", "MONTI_OPTIONS_HOSTNAME", "KADIRA_OPTIONS_HOSTNAME", "GALAXY_CONTAINER_ID",
    "METEOR_CONTAINER_ID", "CONTAINER_ID", "POD_NAME", "POD_UID",
  ]);
  assert.doesNotMatch(JSON.stringify(snapshot), /sentinel|MONGO_URL|METEOR_SETTINGS|MONTI_APP_SECRET|MONTI_APP_ID|OTHER_ENV/);
  assert.deepEqual(snapshot.cgroup, { status: "readable", podUids: [], containerIds: [] });
});

test("unexpected values and filesystem errors cannot leak raw details into logs", () => {
  const snapshot = collectRuntimeIdentity({
    env: { HOSTNAME: "bad\nprivate-value", POD_NAME: "x".repeat(254) },
    getHostname: () => "test-host",
    readCgroup: () => { throw new Error("private-path-sentinel"); },
  });
  assert.equal(snapshot.environment.HOSTNAME, "[omitted: unexpected identifier format]");
  assert.equal(snapshot.environment.POD_NAME, "[omitted: unexpected identifier format]");
  assert.equal(snapshot.cgroup.status, "unavailable");
  assert.doesNotMatch(JSON.stringify(snapshot), /private-value|sentinel/);
});

test("extracts only pod UIDs and container IDs from cgroup v1 and systemd paths", () => {
  const podUid = "12345678-abcd-1234-abcd-123456789abc";
  const containerId = "a".repeat(64);
  const paths = [
    `11:memory:/kubepods/burstable/pod${podUid}/${containerId}`,
    `1:name=systemd:/kubepods.slice/kubepods-burstable.slice/kubepods-burstable-pod${podUid.replaceAll("-", "_")}.slice/cri-containerd-${containerId}.scope`,
  ].join("\n");
  assert.deepEqual(parseCgroupIdentifiers(paths), { podUids: [podUid], containerIds: [containerId] });
  assert.doesNotMatch(JSON.stringify(parseCgroupIdentifiers(paths)), /kubepods|memory|systemd/);
});
