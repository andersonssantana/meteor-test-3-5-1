import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { hostname } from "node:os";

// Deliberate allowlist: never enumerate process.env or serialize Meteor.settings.
const identityVariables = [
  "HOSTNAME",
  "MONTI_OPTIONS_HOSTNAME",
  "KADIRA_OPTIONS_HOSTNAME",
  "GALAXY_CONTAINER_ID",
  "METEOR_CONTAINER_ID",
  "CONTAINER_ID",
  "POD_NAME",
  "POD_UID",
];

function identifier(value) {
  if (value === undefined || value === null || value === "") return null;
  return /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,252}$/.test(value)
    ? value
    : "[omitted: unexpected identifier format]";
}

export function parseCgroupIdentifiers(contents) {
  // Only extract identifiers, never log the raw cgroup paths. Some runtimes
  // expose only `0::/`; empty arrays do not prove the pod has no UID.
  const podUids = [...contents.matchAll(/pod([a-f0-9]{8}[-_][a-f0-9]{4}[-_][a-f0-9]{4}[-_][a-f0-9]{4}[-_][a-f0-9]{12})(?=[/.\s]|$)/gi)]
    .map((match) => match[1].replaceAll("_", "-").toLowerCase());
  const containerIds = [...contents.matchAll(/(?:^|[/:\s-])([a-f0-9]{64})(?=[/.\s]|$)/gi)]
    .map((match) => match[1].toLowerCase());
  return {
    podUids: [...new Set(podUids)],
    containerIds: [...new Set(containerIds)],
  };
}

export function collectRuntimeIdentity({
  env = process.env,
  getHostname = hostname,
  readCgroup = () => readFileSync("/proc/self/cgroup", "utf8"),
  newProcessId = randomUUID,
} = {}) {
  let cgroup;
  try {
    cgroup = { status: "readable", ...parseCgroupIdentifiers(readCgroup()) };
  } catch {
    // macOS and restricted containers may not have this Linux file. Never
    // include an error message, because it could contain filesystem details.
    cgroup = { status: "unavailable", podUids: [], containerIds: [] };
  }

  return {
    schemaVersion: 1,
    // A diagnostic correlation ID, NOT a Galaxy container ID or a pod UID.
    processStartId: newProcessId(),
    nodeVersion: process.version,
    osHostname: identifier(getHostname()),
    environment: Object.fromEntries(
      identityVariables.map((name) => [name, identifier(env[name])]),
    ),
    cgroup,
  };
}
