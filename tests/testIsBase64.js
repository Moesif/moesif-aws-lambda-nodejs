
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, ".env") });

var https = require("https");
const { describe, it } = require("node:test");
const util = require("node:util");
const { ok } = require("assert/strict");
const { deepEqual, deepStrictEqual } = require("assert");
const moesif = require("../lib");
const dataUtils = require('../lib/dataUtils');



describe("testing response for callback-style Lambda", async () => {

  const response = await promiseHandler(event, { ...context });
  it("should contain 'X-Moesif-Transaction-Id' header", async (t) => {
    ok(response.headers["X-Moesif-Transaction-Id"]);
  });

  it("should have 'application/json' as the 'Content-Type' header", async (t) => {
    deepEqual(response.headers["Content-Type"], "application/json");
  });

  it("should have expected body", async (t) => {
    deepStrictEqual(
      response.body,
      JSON.stringify({
        key: "hello world",
      })
    );
  });

  it("should have '200 OK' status code", async (t) => {
    deepStrictEqual(response.statusCode, 200);
  });
});
