const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, ".env") });

// Use basic assertions to avoid Node version dependency on node:test
const assert = require("assert");

const moesif = require("../lib");
const governanceRulesManager = require("../lib/governanceRulesManager");
const moesifConfigManager = require("../lib/moesifConfigManager");

// Stub config and rules to avoid network calls
moesifConfigManager._config = { sample_rate: 100 };

// Make rules available and return a blocking response
const BLOCK_RULE_ID = "test-rule-id";
governanceRulesManager.hasRules = function () { return true; };
governanceRulesManager.governRequest = function () {
  return {
    status: 451,
    headers: { "X-Blocked": "true" },
    body: { reason: "blocked by test" },
    blocked_by: BLOCK_RULE_ID,
  };
};

const handler = async (event, context) => {
  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ok: true }),
  };
};

const context = { getRemainingTimeInMillis: () => 1000 };

async function run() {
  const moesifWrappedHandler = moesif({
    applicationId: process.env.MOESIF_APPLICATION_ID || "dummy",
    waitForGovernanceOnColdStart: true,
    governanceLoadTimeoutMs: 1000,
  }, handler);

  const event = { headers: {}, httpMethod: "GET", path: "/", requestContext: {} };

  const response = await moesifWrappedHandler(event, { ...context });

  assert.deepStrictEqual(response.statusCode, 451);
  assert.ok(response.headers["X-Moesif-Transaction-Id"]);
  assert.deepStrictEqual(response.headers["X-Moesif-Blocked-By"], BLOCK_RULE_ID);
  assert.ok(response.body);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
