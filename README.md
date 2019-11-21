# Moesif AWS Lambda Middleware

[![NPM](https://nodei.co/npm/moesif-aws-lambda-nodejs.png?compact=true&stars=true)](https://nodei.co/npm/moesif-aws-lambda/)

[![Built For][ico-built-for]][link-built-for]
[![Software License][ico-license]][link-license]
[![Source Code][ico-source]][link-source]

Middleware (NodeJS) to automatically log API calls from AWS Lambda functions
and sends to [Moesif](https://www.moesif.com) for API analytics and log analysis. 

Designed for APIs that are hosted on AWS Lambda using Amazon API Gateway as a trigger.

This middleware expects the
[Lambda proxy integration type.](https://docs.aws.amazon.com/apigateway/latest/developerguide/api-gateway-set-up-simple-proxy.html#api-gateway-set-up-lambda-proxy-integration-on-proxy-resource)
If you're using AWS Lambda with API Gateway, you are most likely using the proxy integration type.

[Source Code on GitHub](https://github.com/moesif/moesif-aws-lambda-nodejs)

<div class="notice--info">
    <h4>
        Express apps
    </h4>
    <br>
    <p>
        Alternatively, if you're running the Express Framework on AWS Lambda and prefer to use Express middleware, Moesif has
        <a href="https://www.moesif.com/docs/server-integration/express/">Express Middleware</a> also available. The Express Middleware isn't
        specific to AWS lambda but won't capture AWS specific stuff like Trace Id.
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

### 2. Enter Moesif Application Id
Your Moesif Application Id can be found in the [_Moesif Portal_](https://www.moesif.com/).
After signing up for a Moesif account, your Moesif Application Id will be displayed during the onboarding steps. 

You can always find your Moesif Application Id at any time by logging 
into the [_Moesif Portal_](https://www.moesif.com/), click on the top right menu,
 and then clicking _Installation_.

## Repo file structure

- `lib/index.js` the middleware lib
- `index.js` sample AWS Lambda function using the middleware


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
Set to true to print debug logs if you're having integegration issues. 

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


### updateUser method

A method is attached to the Moesif middleware object to update the user's profile or metadata.


```javascript
const moesifOptions = {
    applicationId: 'Your Moesif Application Id',
};

var moesifMiddleware = moesif(options);
var user = {
  userId: 'your user id',  // required.
  metadata: {
    email: 'user@email.com',
    name: 'George'
  }
}

moesifMiddleware.updateUser(user, callback);

```

### updateCompany method

A method is attached to the Moesif middleware object to update the company's profile or metadata.


```javascript
const moesifOptions = {
    applicationId: 'Your Moesif Application Id',
};

var moesifMiddleware = moesif(options);
var company = {
  companyId: 'your company id',  // required.
  companyDomain: 'acmeinc.com',
  metadata: {
    numEmployees: 9001
  }
}

moesifMiddleware.updateCompany(user, callback);

```

The metadata field can be any custom data you want to set on the user.
The userId field is required.

## Examples

- [A complete example is available on GitHub](https://github.com/Moesif/moesif-aws-lambda-node-js-example).

## Other integrations

To view more more documentation on integration options, please visit __[the Integration Options Documentation](https://www.moesif.com/docs/getting-started/integration-options/).__

[ico-built-for]: https://img.shields.io/badge/built%20for-aws%20lambda-blue.svg
[ico-license]: https://img.shields.io/badge/License-Apache%202.0-green.svg
[ico-source]: https://img.shields.io/github/last-commit/moesif/moesif-aws-lambda-nodejs.svg?style=social

[link-built-for]: https://aws.amazon.com/lambda/
[link-license]: https://raw.githubusercontent.com/Moesif/moesif-aws-lambda-nodejs/master/LICENSE
[link-source]: https://github.com/moesif/moesif-aws-lambda-nodejs
