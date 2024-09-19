const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, ".env") });
const moesif = require("../lib");

var https = require("https");
const { describe, it } = require("node:test");
const { ok } = require("assert/strict");
const { deepEqual, deepStrictEqual } = require("assert");

const moesifOptions = {
  applicationId: process.env.MOESIF_APPLICATION_ID,

  identifyUser: function (event, context) {
    return (
      event.requestContext &&
      event.requestContext.identity &&
      event.requestContext.identity.cognitoIdentityId
    );
  },
};

var handler = async (event, context) => {
  // Outgoing API call to third party
  https.get(
    {
      host: "jsonplaceholder.typicode.com",
      path: "/posts/1",
    },
    function (res) {
      var body = "";
      res.on("data", function (d) {
        body += d;
      });

      res.on("end", function () {
        var parsed = JSON.parse(body);
        console.log(parsed);
      });
    }
  );
  return {
    statusCode: 200,
    body: JSON.stringify({
      message: "Success!",
    }),
    headers: {
      "Content-Type": "application/json",
    },
  };
};

const context = {
  getRemainingTimeInMillis: () => 1000,
};

describe("testing response for async/await Lambda", async () => {
  const moesifWrappedHandler = moesif(moesifOptions, handler);

  const event = {
    headers: {},
  };

  const response = await moesifWrappedHandler(event, { ...context });

  it("should contain 'X-Moesif-Transaction-Id' header", async (t) => {
    ok(response.headers["X-Moesif-Transaction-Id"]);
  });

  it("should have 'application/json' as the 'Content-Type' header", async (t) => {
    deepEqual(response.headers["Content-Type"], "application/json");
  });

  it("should have expected body", async (t) => {
    ok(response.body);
  });

  it("should have '200 OK' status code", async (t) => {
    deepStrictEqual(response.statusCode, 200);
  });
});
