# Moesif AWS Lambda Middleware

Middleware (NodeJS) to automatically log _incoming_ API requests/responses from AWS Lambda functions 
and send to Moesif for error analysis. Designed for APIs that are hosted on AWS Lambda and using 
Amazon API Gateway as a trigger.


This middleware expects the 
[Lambda proxy integration type.](https://docs.aws.amazon.com/apigateway/latest/developerguide/api-gateway-set-up-simple-proxy.html#api-gateway-set-up-lambda-proxy-integration-on-proxy-resource)
If you're using AWS Lambda with API Gateway, you are most likely using the proxy integration type.


[Source Code on GitHub](https://github.com/moesif/moesif-aws-lambda-nodejs)

[Package on NPMJS](https://www.npmjs.com/package/moesif-aws-lambda)

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
    applicationId: 'Your Moesif application_id',

    identifyUser: function (event, context) {
        return event.requestContext.identity.cognitoIdentityId
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

### 2. Enter Moesif Application Id.
You can find your Application Id from [_Moesif Dashboard_](https://www.moesif.com/) -> _Top Right Menu_ -> _App Setup_

## Repo file structure

- `lib/index.js` the middleware lib
- `index.js` sample AWS Lambda function using the middleware


## Configuration options


#### __`identifyUser`__

Type: `(event, context) => String`
identifyUser is a function that takes AWS lambda `event` and `context` objects as arguments
and returns a userId. This helps us attribute requests to unique users. Even though Moesif can
automatically retrieve the userId without this, this is highly recommended to ensure accurate attribution.


```
options.identifyUser = function (event, context) {
  // your code here, must return a string
  return event.requestContext.identity.cognitoIdentityId
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

#### __`getTags`__

Type: `(event, context) => String`
getTags is a function that takes AWS lambda `event` and `context` objects as arguments and returns a comma-separated string containing a list of tags.
See Moesif documentation for full list of tags.


```javascript
options.getTags = function (event, context) {
  // your code here. must return a comma-separated string.
  if (event.path.startsWith('/users') && event.httpMethod == 'GET'){
    return 'user'
  }
  return 'random_tag_1, random_tag2'
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
    "time": "2016-09-09T04:45:42.914",
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
    "time": "2016-09-09T04:45:42.914",
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
  "user_id": "mndug437f43",
  "session_token":"end_user_session_token",
  "tags": "tag1, tag2"
}

```

For more documentation regarding what fields and meaning,
see below or the [Moesif Node API Documentation](https://www.moesif.com/docs/api?javascript).

Fields | Required | Description
--------- | -------- | -----------
request.time | Required | Timestamp for the request in ISO 8601 format
request.uri | Required | Full uri such as https://api.com/?query=string including host, query string, etc
request.verb | Required | HTTP method used, i.e. `GET`, `POST`
request.api_version | Optional | API Version you want to tag this request with
request.ip_address | Optional | IP address of the end user
request.headers | Required | Headers of the  request
request.body | Optional | Body of the request in JSON format
||
response.time | Required | Timestamp for the response in ISO 8601 format
response.status | Required | HTTP status code such as 200 or 500
request.ip_address | Optional | IP address of the responding server
response.headers | Required | Headers of the response
response.body | Required | Body of the response in JSON format


### updateUser method

A method is attached to the moesif middleware object to update the users profile or metadata.


```javascript
'use strict'
const moesif = require('moesif-aws-lambda');

const moesifOptions = {
    applicationId: 'Your Moesif application_id',

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

The metadata field can be any custom data you want to set on the user.
The userId field is required.


## Other integrations

To view more more documentation on integration options, please visit __[the Integration Options Documentation](https://www.moesif.com/docs/getting-started/integration-options/).__
