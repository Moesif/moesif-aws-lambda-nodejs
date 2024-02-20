# Moesif AWS Lambda Middleware for Node.js

[![NPM](https://nodei.co/npm/moesif-aws-lambda-nodejs.png?compact=true&stars=true)](https://nodei.co/npm/moesif-aws-lambda/)

[![Built For][ico-built-for]][link-built-for]
[![Software License][ico-license]][link-license]
[![Source Code][ico-source]][link-source]

Node.js Middleware for AWS Lambda that automatically logs API calls
and sends to [Moesif](https://www.moesif.com) for API analytics and monitoring.

Designed for APIs that are hosted on AWS Lambda using Amazon API Gateway or Application Load Balancer
as a trigger. Works with REST APIs, GraphQL APIs (such as with apollo-server-lambda) and more.

[Source Code on GitHub](https://github.com/moesif/moesif-aws-lambda-nodejs)

<div class="notice--info">
    <h4>
        Express apps
    </h4>
    <br>
    <p>
        Alternatively, if you're running the Node.js Express Framework on AWS Lambda and prefer to not have any AWS specific dependencies,
        Moesif has <a href="https://www.moesif.com/docs/server-integration/nodejs/">Express Middleware</a> also available.
        However, moesif-nodejs won't capture lambda specific context like Trace Id.
    </p>
</div>


## How to install

```shell
npm install --save moesif-aws-lambda
```

## How to use

The following shows how import the controllers and use:

### 1. Import the module:


```javascript
// Import Modules
'use strict'
const moesif = require('moesif-aws-lambda');

const moesifOptions = {
    applicationId: 'Your Moesif Application Id',

    identifyUser: function (event, context) {
        return event.requestContext.identity.cognitoIdentityId
    },
    identifyCompany: function (event, context) {
        return '5678'
    }
};

exports.handler = function (event, context, callback) {
    callback(null, {
        statusCode: '200',
        body: JSON.stringify({key: 'hello world'}),
        headers: {
            'Content-Type': 'application/json',
        },
    });
};

exports.handler = moesif(moesifOptions, exports.handler);


```

Depends on the version of node, you can also import directly:

```javascript
import moesif from 'moesif-aws-lambda'
```

If you are using ESM or later version of ESM, please try the following method:

```javascript
const moesifImportWrapper = await import('moesif-aws-lambda');
const moesif = moesifImportWrapper.default;
```

### 2. Enter Moesif Application Id
Your Moesif Application Id can be found in the [_Moesif Portal_](https://www.moesif.com/).
After signing up for a Moesif account, your Moesif Application Id will be displayed during the onboarding steps.

You can always find your Moesif Application Id at any time by logging
into the [_Moesif Portal_](https://www.moesif.com/), click on the top right menu,
 and then clicking _Installation_.

### 3. Trigger your API

Grab the URL to your API Gateway or LB and make some calls using a tool like Postman or CURL.

> In order for your event to log to Moesif, you must test using the Amazon API Gateway trigger. Do not invoke your lambda directly using AWS Console as the payload won't contain a valid HTTP payload.


## Repo file structure

- `lib/index.js` the middleware lib
- `app.js` sample AWS Lambda function using the middleware


## Configuration options

#### __`logBody`__
Type: `Boolean`
logBody is default to true, set to false to remove logging request and response body to Moesif.

#### __`identifyUser`__

Type: `(event, context) => String`
identifyUser is a function that takes AWS lambda `event` and `context` objects as arguments
and returns a userId. This enables Moesif to attribute API requests to individual unique users
so you can understand who calling your API. This can be used simultaneously with `identifyCompany`
to track both individual customers and the companies their a part of.


```javascript
options.identifyUser = function (event, context) {
  // your code here, must return a string
  return event.requestContext.identity.cognitoIdentityId
}
```

#### __`identifyCompany`__

Type: `(event, context) => String`
identifyCompany is a function that takes AWS lambda `event` and `context` objects as arguments
and returns a companyId. If your business is B2B, this enables Moesif to attribute
API requests to specific companies or organizations so you can understand which accounts are
calling your API. This can be used simultaneously with `identifyUser` to track both
individual customers and the companies their a part of.


```javascript
options.identifyCompany = function (event, context) {
  // your code here, must return a string
  return '5678'
}
```

#### __`getSessionToken`__

Type: `(event, context) => String`
getSessionToken a function that takes AWS lambda `event` and `context` objects as arguments and returns a
session token (i.e. such as an API key).


```javascript
options.getSessionToken = function (event, context) {
  // your code here, must return a string.
  return event.headers['Authorization'];
}
```

#### __`getApiVersion`__

Type: `(event, context) => String`
getApiVersion is a function that takes AWS lambda `event` and `context` objects as arguments and
returns a string to tag requests with a specific version of your API.


```javascript
options.getApiVersion = function (event, context) {
  // your code here. must return a string.
  return '1.0.5'
}
```

#### __`getMetadata`__

Type: `(event, context) => String`
getMetadata is a function that AWS lambda `event` and `context` objects as arguments and returns an object that allows you
to add custom metadata that will be associated with the req. The metadata must be a simple javascript object that can be converted to JSON. For example, you may want to save a VM instance_id, a trace_id, or a tenant_id with the request.


```javascript
options.getMetadata = function (event, context)  {
  // your code here:
  return {
    foo: 'custom data',
    bar: 'another custom data'
  };
}
```

#### __`skip`__

Type: `(event, context) => Boolean`
skip is a function that takes AWS lambda `event` and `context` objects as arguments and returns true
if the event should be skipped (i.e. not logged)
<br/>_The default is shown below and skips requests to the root path "/"._


```javascript
options.skip = function (event, context) {
  // your code here. must return a boolean.
  if (event.path === '/') {
    // Skip probes to home page.
    return true;
  }
  return false
}
```

#### __`maskContent`__

Type: `MoesifEventModel => MoesifEventModel`
maskContent is a function that takes the final Moesif event model (rather than the AWS lambda event/context objects) as an
argument before being sent to Moesif. With maskContent, you can make modifications to headers or body such as
removing certain header or body fields.


```javascript
options.maskContent = function(moesifEvent) {
  // remove any field that you don't want to be sent to Moesif.
  return moesifEvent;
}
 ```

`EventModel` format:

```json
{
  "request": {
    "time": "2019-08-08T04:45:42.914",
    "uri": "https://api.acmeinc.com/items/83738/reviews/",
    "verb": "POST",
    "api_version": "1.1.0",
    "ip_address": "61.48.220.123",
    "headers": {
      "Host": "api.acmeinc.com",
      "Accept": "*/*",
      "Connection": "Keep-Alive",
      "Content-Type": "application/json",
      "Content-Length": "126",
      "Accept-Encoding": "gzip"
    },
    "body": {
      "items": [
        {
          "direction_type": 1,
          "item_id": "fwdsfrf",
          "liked": false
        },
        {
          "direction_type": 2,
          "item_id": "d43d3f",
          "liked": true
        }
      ]
    }
  },
  "response": {
    "time": "2019-08-08T04:45:42.924",
    "status": 500,
    "headers": {
      "Vary": "Accept-Encoding",
      "Pragma": "no-cache",
      "Expires": "-1",
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-cache"
    },
    "body": {
      "Error": "InvalidArgumentException",
      "Message": "Missing field location"
    }
  },
  "user_id": "my_user_id",
  "company_id": "my_company_id",
  "session_token":"end_user_session_token",
  "tags": "tag1, tag2"
}

```

#### __`debug`__
Type: `Boolean`
Set to true to print debug logs if you're having integration issues.

For more documentation regarding what fields and meaning,
see below or the [Moesif Node API Documentation](https://www.moesif.com/docs/api?javascript).

Name | Required | Description
--------- | -------- | -----------
request | __true__ | The object that specifies the request message
request.time| __true__ | Timestamp for the request in ISO 8601 format
request.uri| __true__ | Full uri such as _https://api.com/?query=string_ including host, query string, etc
request.verb| __true__ | HTTP method used, i.e. `GET`, `POST`
request.api_version| false | API Version you want to tag this request with such as _1.0.0_
request.ip_address| false | IP address of the requester, If not set, we use the IP address of your logging API calls.
request.headers| __true__ | Headers of the  request as a `Map<string, string>`. Multiple headers with the same key name should be combined together such that the values are joined by a comma. [HTTP Header Protocol on w3.org](https://www.w3.org/Protocols/rfc2616/rfc2616-sec4.html#sec4.2)
request.body| false | Body of the request in JSON format or Base64 encoded binary data (see _transfer_encoding_)
request.transfer_encoding| false | A string that specifies the transfer encoding of Body being sent to Moesif. If field nonexistent, body assumed to be JSON or text. Only possible value is _base64_ for sending binary data like protobuf
||
response | false | The object that specifies the response message, not set implies no response received such as a timeout.
response.time| __true__ | Timestamp for the response in ISO 8601 format
response.status| __true__ | HTTP status code as number such as _200_ or _500_
response.ip_address| false | IP address of the responding server
response.headers| __true__ | Headers of the response as a `Map<string, string>`. Multiple headers with the same key name should be combined together such that the values are joined by a comma. [HTTP Header Protocol on w3.org](https://www.w3.org/Protocols/rfc2616/rfc2616-sec4.html#sec4.2)
response.body| false | Body of the response in JSON format or Base64 encoded binary data (see _transfer_encoding_)
response.transfer_encoding| false | A string that specifies the transfer encoding of Body being sent to Moesif. If field nonexistent, body assumed to be JSON or text. Only possible value is _base64_ for sending binary data like protobuf
||
session_token | _Recommend_ | The end user session token such as a JWT or API key, which may or may not be temporary. Moesif will auto-detect the session token automatically if not set.
user_id | _Recommend_ | Identifies this API call to a permanent user_id
metadata | false | A JSON Object consisting of any custom metadata to be stored with this event.


## Capture Outgoing

If you want to capture all outgoing API calls from your Node.js app to third parties like
Stripe or to your own dependencies, call `startCaptureOutgoing()` to start capturing.

```javascript
const moesif = require('moesif-aws-lambda');
var moesifMiddleware = moesif(options);
moesifMiddleware.startCaptureOutgoing();
```

The same set of above options is also applied to outgoing API calls, with a few key differences:

For options functions that take `req` and `res` as input arguments, the request and response objects passed in
are not Express or Node.js req or res objects when the request is outgoing, but Moesif does mock
some of the fields for convenience.
Only a subset of the Node.js req/res fields are available. Specifically:

- *_mo_mocked*: Set to `true` if it is a mocked request or response object (i.e. outgoing API Call)
- *headers*: object, a mapping of header names to header values. Case sensitive
- *url*: string. Full request URL.
- *method*: string. Method/verb such as GET or POST.
- *statusCode*: number. Response HTTP status code
- *getHeader*: function. (string) => string. Reads out a header on the request. Name is case insensitive
- *get*: function. (string) => string. Reads out a header on the request. Name is case insensitive
- *body*: JSON object. The request body as sent to Moesif


## Update a Single User

Create or update a user profile in Moesif.
The metadata field can be any customer demographic or other info you want to store.
Only the `userId` field is required.
This method is a convenient helper that calls the Moesif API lib.
For details, visit the [Node.js API Reference](https://www.moesif.com/docs/api?javascript--nodejs#update-a-user).

```javascript
var moesifMiddleware = moesif(options);

// Only userId is required.
// Campaign object is optional, but useful if you want to track ROI of acquisition channels
// See https://www.moesif.com/docs/api#users for campaign schema
// metadata can be any custom object
var user = {
  userId: '12345',
  companyId: '67890', // If set, associate user with a company object
  campaign: {
    utmSource: 'google',
    utmMedium: 'cpc',
    utmCampaign: 'adwords',
    utmTerm: 'api+tooling',
    utmContent: 'landing'
  },
  metadata: {
    email: 'john@acmeinc.com',
    firstName: 'John',
    lastName: 'Doe',
    title: 'Software Engineer',
    salesInfo: {
        stage: 'Customer',
        lifetimeValue: 24000,
        accountOwner: 'mary@contoso.com'
    }
  }
};

moesifMiddleware.updateUser(user, callback);
```

## Update Users in Batch
Similar to updateUser, but used to update a list of users in one batch.
Only the `userId` field is required.
This method is a convenient helper that calls the Moesif API lib.
For details, visit the [Node.js API Reference](https://www.moesif.com/docs/api?javascript--nodejs#update-users-in-batch).

```javascript
var moesifMiddleware = moesif(options);

// Only userId is required.
// Campaign object is optional, but useful if you want to track ROI of acquisition channels
// See https://www.moesif.com/docs/api#users for campaign schema
// metadata can be any custom object
var user = {
  userId: '12345',
  companyId: '67890', // If set, associate user with a company object
  campaign: {
    utmSource: 'google',
    utmMedium: 'cpc',
    utmCampaign: 'adwords',
    utmTerm: 'api+tooling',
    utmContent: 'landing'
  },
  metadata: {
    email: 'john@acmeinc.com',
    firstName: 'John',
    lastName: 'Doe',
    title: 'Software Engineer',
    salesInfo: {
        stage: 'Customer',
        lifetimeValue: 24000,
        accountOwner: 'mary@contoso.com'
    }
  }
};

var users = [user]

moesifMiddleware.updateUsersBatch(users, callback);
```

## Update a Single Company

Create or update a company profile in Moesif.
The metadata field can be any company demographic or other info you want to store.
Only the `companyId` field is required.
This method is a convenient helper that calls the Moesif API lib.
For details, visit the [Node.js API Reference](https://www.moesif.com/docs/api?javascript--nodejs#update-a-company).


```javascript
var moesifMiddleware = moesif(options);

// Only companyId is required.
// Campaign object is optional, but useful if you want to track ROI of acquisition channels
// See https://www.moesif.com/docs/api#update-a-company for campaign schema
// metadata can be any custom object
var company = {
  companyId: '67890',
  companyDomain: 'acmeinc.com', // If domain is set, Moesif will enrich your profiles with publicly available info
  campaign: {
    utmSource: 'google',
    utmMedium: 'cpc',
    utmCampaign: 'adwords',
    utmTerm: 'api+tooling',
    utmContent: 'landing'
  },
  metadata: {
    orgName: 'Acme, Inc',
    planName: 'Free Plan',
    dealStage: 'Lead',
    mrr: 24000,
    demographics: {
      alexaRanking: 500000,
      employeeCount: 47
    }
  }
};

moesifMiddleware.updateCompany(company, callback);
```

## Update Companies in Batch
Similar to updateCompany, but used to update a list of companies in one batch.
Only the `companyId` field is required.
This method is a convenient helper that calls the Moesif API lib.
For details, visit the [Node.js API Reference](https://www.moesif.com/docs/api?javascript--nodejs#update-companies-in-batch).

```javascript
var moesifMiddleware = moesif(options);

// Only companyId is required.
// Campaign object is optional, but useful if you want to track ROI of acquisition channels
// See https://www.moesif.com/docs/api#update-a-company for campaign schema
// metadata can be any custom object
var company = {
  companyId: '67890',
  companyDomain: 'acmeinc.com', // If domain is set, Moesif will enrich your profiles with publicly available info
  campaign: {
    utmSource: 'google',
    utmMedium: 'cpc',
    utmCampaign: 'adwords',
    utmTerm: 'api+tooling',
    utmContent: 'landing'
  },
  metadata: {
    orgName: 'Acme, Inc',
    planName: 'Free Plan',
    dealStage: 'Lead',
    mrr: 24000,
    demographics: {
      alexaRanking: 500000,
      employeeCount: 47
    }
  }
};

var companies = [company]

moesifMiddleware.updateCompaniesBatch(companies, callback);
```

## Examples

- [REST API Example on GitHub](https://github.com/Moesif/moesif-aws-lambda-node-js-example).
- [Apollo GraphQL Example on GitHUb](https://github.com/Moesif/moesif-aws-lambda-apollo-example).

## Other integrations

To view more documentation on integration options, please visit __[the Integration Options Documentation](https://www.moesif.com/docs/getting-started/integration-options/).__

[ico-built-for]: https://img.shields.io/badge/built%20for-aws%20lambda-blue.svg
[ico-license]: https://img.shields.io/badge/License-Apache%202.0-green.svg
[ico-source]: https://img.shields.io/github/last-commit/moesif/moesif-aws-lambda-nodejs.svg?style=social

[link-built-for]: https://aws.amazon.com/lambda/
[link-license]: https://raw.githubusercontent.com/Moesif/moesif-aws-lambda-nodejs/master/LICENSE
[link-source]: https://github.com/moesif/moesif-aws-lambda-nodejs
