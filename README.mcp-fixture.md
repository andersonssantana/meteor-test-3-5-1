# Customer MCP runtime and rollback fixture

This dedicated test branch adds a small read-only endpoint for controlled staging
validation. It does not change `main` and must not be deployed until the exact
customer prompts have been registered for the next test stages.

## Runtime endpoint

`GET /__mcp-test/runtime` returns exactly two JSON fields:

```json
{"version":"customer-mcp-fixture-v1","message":"hello-after-update"}
```

The version marker is a source-code constant. The second healthy revision changes
it to `customer-mcp-fixture-v2` so a deployed code version can be identified without
relying on deployment metadata alone.

The endpoint reads only `MCP_TEST_MESSAGE`. It returns that value only when it is
one of these deliberately harmless strings:

- `hello-from-the-customer-flow`
- `hello-after-update`

An unset or different value produces `message: null`. No environment enumeration,
Meteor settings, database URL, credentials, or other environment values are
exposed. Query parameters cannot select a different key. Responses use
`Cache-Control: no-store`; `HEAD` has no body and other methods return `405`.

This endpoint is public fixture data, not a general environment diagnostics API.
The existing application still requires its MongoDB connection as before.

## Local checks

```sh
meteor npm ci --no-audit --no-fund
npm run test:runtime-fixture
meteor test --once --driver-package meteortesting:mocha
meteor build ../fixture-build --directory --server-only
```

The Node tests exercise actual HTTP responses, allowed-value filtering, exact
environment-key access, cache policy, methods, and route boundaries. Meteor tests
also exercise the payload in the framework's server test environment.
