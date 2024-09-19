
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, ".env") });

var https = require("https");
const { describe, it } = require("node:test");
const util = require("node:util");
const { ok } = require("assert/strict");
const dataUtils = require('../lib/dataUtils');


describe("test isStrBase64", async () => {

  it("should be valid base 64' header", async (t) => {
    ok(dataUtils.isStrBase64("eyJmb28iOiJiYXIifQ=="));
  });

  it("object should not be base 64", async (t) => {
    ok(!dataUtils.isStrBase64({ foo: "bar"}));
  });
});
