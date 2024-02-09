var requestIp = require('request-ip');
var dataUtils = require('./dataUtils');
var url = require('url');

var safeJsonParse = dataUtils.safeJsonParse;

function getIpAddress(event, context, isV1) {
  if (isV1) {
    return (
      requestIp.getClientIp(event) ||
      (event.requestContext &&
        event.requestContext.identity &&
        event.requestContext.identity.sourceIp)
    );
  } else {
    return (
      event.requestContext &&
      event.requestContext.http &&
      event.requestContext.http.sourceIp
    );
  }
}

function getRequestBody(event, context, isV1) {
  const bodyWrapper = safeJsonParse(event.body);
  return bodyWrapper;
}

function getURLWithQueryStringParams(event) {
  try {
    console.log(JSON.stringify(event));
    var protocol = (event.headers && event.headers['X-Forwarded-Proto'] || event.headers['x-forwarded-proto']) ? (event.headers['X-Forwarded-Proto'] || event.headers['x-forwarded-proto']) : 'http';
    var host = event.headers.Host || event.headers.host;
    return url.format({ protocol: protocol, host: host, pathname: event.path, query: event.queryStringParameters });
  } catch (err) {
    console.error(err);
    return '/';
  }
}

function getRequestUri(event, context, isV1) {
  if (isV1) {
    return getURLWithQueryStringParams(event);
  } else {
    console.log('isV2');
    console.log(JSON.stringify(event));
    const result = event.rawPath + (event.rawQueryString ? "?" + event.rawQueryString : "");
    console.log(result);
    return result;
  }
}

function getRequestVerb(event, context, isV1) {
  if (isV1) {
    return event.httpMethod;
  } else {
    return  event.requestContext &&
      event.requestContext.http &&
      event.requestContext.http.method;
  }
}

function prepareRequestDataForGovernance(event, context, isV1) {
  const requestBody = getRequestBody(event, context, isV1);
  return {
    requestFields: {
      'request.verb': getRequestVerb(event, context, isV1),
      'request.ip': getIpAddress(event, context, isV1),
      'request.route': getRequestUri(event, context, isV1),
      'request.body.operationName': requestBody && requestBody.operationName,
    },
    requestHeaders: Object.assign({}, event.headers || {}),
    requestBody
  };
}

// in V2
// https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-develop-integrations-lambda.html
// if there is no statusCode but valid JSON, API gateway will interpret
// the response.
function translateLambdaResultIfNeeded(result, isV1) {
  if (isV1) {
    return result || {};
  }

  if (result && result.statusCode) {
    return result;
  }

  if ((!result || !result.statusCode) && (typeof result === 'object' || typeof result === 'string' || typeof result === 'undefined')) {
    return {
      isBase64Encoded: false,
      statusCode: 200,
      body: typeof result === 'undefined' ? undefined : JSON.stringify(result),
      headers: {
        'content-type': 'application/json'
      }
    };
  }

  return result || {};
}

function mapResponseHeaders(event, context, result) {
  const headers = Object.assign({}, result.headers || {}); // NOTE: Mutating event.headers; prefer deep clone of event.headers
  return headers;
}

function constructBaseLogData(
  event,
  context,
  err,
  result,
  options,
  isV1
) {
  var logData = {};
  logData.request = {};
  logData.response = {};
  if (isV1) {
    logData.request.time =
      event && event.requestContext && event.requestContext.requestTimeEpoch
        ? new Date(event.requestContext.requestTimeEpoch)
        : Date.now();
  } else {
    logData.request.time =
      event && event.requestContext && event.requestContext.timeEpoch
        ? new Date(event.requestContext.timeEpoch)
        : Date.now();
  }

  logData.request.uri = getRequestUri(event, context, isV1);
  logData.request.verb = getRequestVerb(event, context, isV1);

  logData.request.apiVersion = options.getApiVersion(event, context);

  logData.request.ipAddress = getIpAddress(event, context, isV1);

  logData.request.headers = Object.assign({}, event.headers || {});
  logData.metadata = options.getMetadata(event, context);

  if (options.logBody && event.body) {
    if (event.isBase64Encoded) {
      logData.request.body = event.body;
      logData.request.transferEncoding = "base64";
    } else {
      const bodyWrapper = safeJsonParse(event.body);
      logData.request.body = bodyWrapper.body;
      logData.request.transferEncoding = bodyWrapper.transferEncoding;
    }
  }

  var safeRes = translateLambdaResultIfNeeded(result, isV1);

  logData.response.time = Math.max(
    new Date(logData.request.time).getTime(),
    Date.now()
  );
  logData.response.status = safeRes.statusCode
    ? parseInt(safeRes.statusCode)
    : 599;
  logData.response.headers = mapResponseHeaders(event, context, safeRes);
  if (logData.response.headers['X-Moesif-Blocked-By']) {
    logData.blocked_by = logData.response.headers['X-Moesif-Blocked-By'];
  }

  if (options.logBody && safeRes.body) {
    if (safeRes.isBase64Encoded) {
      logData.response.body = safeRes.body;
      logData.response.transferEncoding = "base64";
    } else {
      const bodyWrapper = safeJsonParse(safeRes.body);
      logData.response.body = bodyWrapper.body;
      logData.response.transferEncoding = bodyWrapper.transferEncoding;
    }
  }

  return logData;
}

module.exports = {
  constructBaseLogData,
  prepareRequestDataForGovernance,
}
