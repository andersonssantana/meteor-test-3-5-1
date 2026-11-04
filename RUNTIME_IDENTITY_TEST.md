# Galaxy runtime identity test

Branch: `test/runtime-container-identity` (based on `main`, `0b8b416`).
Meteor: 3.5.1. Monti APM agent: 3.0.0-beta.20, as resolved by Meteor.

## What this branch observes

Each server process emits one JSON line prefixed with `[runtime-identity]` at
startup. Read it in the app's private Galaxy logs. It contains:

- `osHostname`: Node's `os.hostname()`.
- `environment`: the exact values of `HOSTNAME`, `MONTI_OPTIONS_HOSTNAME`,
  `GALAXY_CONTAINER_ID`, `METEOR_CONTAINER_ID`, `CONTAINER_ID`, `POD_NAME`,
  and `POD_UID`. Missing or empty variables are `null`.
- `cgroup`: pod UIDs and 64-character container IDs extracted from
  `/proc/self/cgroup`, if readable. Raw paths are never logged. A readable
  cgroup v2 file may expose no identifiers; this does not prove the UID is
  inaccessible by every other mechanism.
- `processStartId`: a new, locally generated correlation ID on every process
  start. **This is not the container/pod identity.**
- Node/Meteor versions and the observation timestamp.

No new HTTP route, Meteor method, publication or client view exposes the
snapshot. The diagnostic does not enumerate environment variables or read
Meteor settings, service-account tokens, Kubernetes APIs or network metadata.
Unexpected identifier formats are omitted. Existing app behavior is unchanged.

## Deployment prerequisites

Before deploying, confirm the exact production test app, owner, region,
container size/count, plan, total spend limit and cleanup time. No deployment,
plan change or paid resource creation is performed by preparing this branch.
Use a test database only: this scaffold seeds its tutorial `Links` collection
when empty, as it already did on `main`.

Galaxy's integrated Monti APM requires the Professional plan. The agent is
included in this branch. Let Galaxy configure its credentials automatically;
do not add `Monti.connect`, manual Monti settings or credentials to the repo.
Do not override `HOSTNAME` or `MONTI_OPTIONS_HOSTNAME`, because that would change
the observation. Verify the integration is enabled on the chosen test app.

Sources: [Galaxy Monti APM setup](https://docs.galaxycloud.app/docs/apps/meteor/monti-apm)
and [Monti custom hostnames](https://docs.montiapm.com/knowledge-base/send-data-with-a-custom-hostname).

## Compare the deployed runtime

1. Deploy this branch in normal production mode to the confirmed test app.
   Do not use a debug build. Record the deployed commit and version.
2. In Galaxy, record the container ID and full pod name (if displayed), along
   with the container's start time. Copy its `[runtime-identity]` log line.
3. Confirm the separate `Monti APM: Connected` log and open Galaxy's APM link.
   Allow approximately a minute for metrics to appear. Loading the existing
   app creates normal method/publication traffic; no load generator is added.
4. Record the host label in Monti's server metrics. Compare it exactly with
   `MONTI_OPTIONS_HOSTNAME` and `osHostname`. Compare the Galaxy ID separately
   with `POD_UID`, other ID variables and any cgroup IDs. A pod name, pod UID
   and container runtime ID are different identities, even if related.
5. If the approved test scope permits, restart one container and repeat.
   Use the timestamp and `processStartId` to distinguish observations. If the
   app has multiple containers, retain one row per process/container; avoid
   comparing logs from one instance with the dashboard row of another.

| Time / version | Galaxy container ID | Galaxy pod name | processStartId | osHostname | MONTI_OPTIONS_HOSTNAME | POD_UID / cgroup pod UID | Monti host |
| --- | --- | --- | --- | --- | --- | --- | --- |
| | | | | | | | |

Report observations as observed, not inferred. `null` means that specific env
variable was not set; it does not establish that no other interface could
provide the same ID. Installation of the agent alone is not proof that it
connected or that Monti received data.

After collecting the evidence, return the test app to its approved baseline
or remove it as agreed. This branch's startup diagnostic is temporary.

## Local verification

```sh
meteor npm ci
npm run test:identity
meteor build /tmp/meteor-runtime-identity-build --directory --server-only
```

The pure Node tests cover the allowlist, absent variables, format rejection,
filesystem-error redaction and cgroup parsing. Local tests cannot establish
which IDs Galaxy injects in production or what its Monti dashboard displays.

Verified on 2026-11-04: all three Node tests passed, the production server
bundle built successfully, and `meteor run --production` started the app
with an isolated local MongoDB and no Monti credentials. The startup snapshot
reported Meteor 3.5.1 / Node 24.15.0; all seven container env variables were
`null` on macOS and cgroup was unavailable. The local app returned HTTP 200
and was then stopped. No Monti connection or Galaxy runtime identity has
been validated yet.
