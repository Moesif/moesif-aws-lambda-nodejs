/**
 * Created by derric on 8/22/17.
 */
'use strict'
var _ = require('lodash');
var url = require('url');
var moesifapi = require('moesifapi');
var EventModel = moesifapi.EventModel;
var requestIp = require('request-ip');
var logData = {};
logData.request = {};
logData.response = {};
logData.request.time = Date.now();

//
// ### function moesifExpress(options)
// #### @options {Object} options to initialize the middleware.
//

var logMessage = function(debug, functionName, message) {
  if (debug) {
    console.log('MOESIF: [' + functionName + '] ' + message);
  }
};

module.exports = function (options, handler) {

  logMessage(options.debug, 'moesifInitiator', 'start');

  options.applicationId = options.applicationId || process.env.MOESIF_APPLICATION_ID;

  options.identifyUser = options.identifyUser || function (event, context) {
      return (event.requestContext && event.requestContext.authorizer && event.requestContext.authorizer.principalId) ||
          event.principalId ||

          (event.requestContext && event.requestContext.identity && event.requestContext.identity.cognitoIdentityId) ||
          (context.identity && context.identity.cognitoIdentityId) ||

          (event.requestContext && event.requestContext.identity && event.requestContext.identity.user) ||
          event.user;
    };

  options.identifyCompany = options.identifyCompany || function() {};

  options.getSessionToken = options.getSessionToken || function (event, context) {
      return (event.requestContext && event.requestContext.identity && event.requestContext.identity.apiKey) ;
    };
  options.getTags = options.getTags || function () {
      return undefined;
    };
  options.getApiVersion = options.getApiVersion || function (event, context) {
      return context.functionVersion;
    };
  options.maskContent = options.maskContent || function (eventData) {
      return eventData;
    };
  options.ignoreRoute = options.ignoreRoute || function () {
      return false;
    };
  options.skip = options.skip || function () {
      return false;
    };

  ensureValidOptions(options);

  // config moesifapi
  var config = moesifapi.configuration;
  config.ApplicationId = options.applicationId || process.env.MOESIF_APPLICATION_ID;
  var moesifController = moesifapi.ApiController;

  var moesifMiddleware = function (event, context, callback) {
    logMessage(options.debug, 'moesifMiddleware', 'start');

    var next = function (err, result) {
      logEvent(event, context, err, result, options, moesifController);
      callback(err, result)
    };

    handler(event, context, next);
  };

  moesifMiddleware.updateUser = function (userModel, cb) {
    logMessage(options.debug, 'updateUser', 'userModel=' + JSON.stringify(userModel));
    ensureValidUserModel(userModel);
    logMessage(options.debug, 'updateUser', 'userModel valid');
    moesifController.updateUser(userModel, cb);
  };

  moesifMiddleware.updateCompany = function (companyModel, cb) {
    logMessage(options.debug, 'updateCompany', 'companyModel=' + JSON.stringify(companyModel));
    ensureValidCompanyModel(companyModel);
    logMessage(options.debug, 'updateCompany', 'companyModel valid');
    moesifController.updateCompany(companyModel, cb);
  };

  logMessage(options.debug, 'moesifInitiator', 'returning moesifMiddleware Function');
  return moesifMiddleware;
};

function mapResponseHeaders(event, context, result) {
    const headers = result.headers || {}; // NOTE: Mutating event.headers; prefer deep clone of event.headers

    headers['x-amzn-trace-id'] = context.awsRequestId;
    headers['x-amzn-function-name'] = context.functionName;
    headers['x-apigateway-trace-id'] = (event && event.requestContext && event.requestContext.requestId) || (context && context.requestContext && context.requestContext.requestId);
    return headers;
}

function logEvent(event, context, err, result, options, moesifController) {

  if (!event.httpMethod || !event.headers) {
      logMessage(options.debug, 'logEvent', 'Expecting input format to be the API Gateway proxy integration type. ' +
          'See https://docs.aws.amazon.com/apigateway/latest/developerguide/api-gateway-set-up-simple-proxy.html#api-gateway-set-up-lambda-proxy-integration-on-proxy-resource');
      return;
  }

  logData.request.uri = getPathWithQueryStringParams(event);
  logData.request.verb = event.httpMethod;
  logData.request.apiVerion = options.getApiVersion(event, context);
  logData.request.ipAddress = requestIp.getClientIp(event) || (event.requestContext && event.requestContext.identity && event.requestContext.identity.sourceIp);
  logData.request.headers = event.headers || {};

  if (event.body) {
      if (event.isBase64Encoded) {
          logData.request.transferEncoding = 'base64';
          logData.request.body = bodyToBase64(event.body);
      } else {
          try {
              logData.request.body = JSON.parse(event.body);
          } catch (err) {
              logData.request.body = event.body;
          }
      }
  }

  logMessage(options.debug, 'logEvent', 'created request: \n' + JSON.stringify(logData.request));
  var safeRes = result || {};
  logData.response.time = Date.now();
  logData.response.status = safeRes.statusCode ? parseInt(safeRes.statusCode) : 599;
  logData.response.headers = mapResponseHeaders(event, context, safeRes);

  if (safeRes.body) {
      if (safeRes.isBase64Encoded) {
          // does this flag exists from AWS?
          logData.response.transferEncoding = 'base64';
          logData.response.body = bodyToBase64(safeRes.body);
      } else {
          try {
              logData.response.body = JSON.parse(safeRes.body);
          } catch (err) {
              // if JSON decode fails, we'll try to base64 encode the body.
              logData.response.transferEncoding = 'base64';
              logData.response.body = bodyToBase64(safeRes.body);
          }
      }
  }

  logMessage(options.debug, 'logEvent', 'created data: \n' + JSON.stringify(logData));

  logData = options.maskContent(logData);

  logData.userId = options.identifyUser(event, context);
  logData.companyId = options.identifyCompany(event, context);
  logData.sessionToken = options.getSessionToken(event, context);
  logData.tags = options.getTags(event, context);

  logMessage(options.debug, 'logEvent', 'applied options to data: \n' + JSON.stringify(logData));

  ensureValidLogData(logData);

  // This is fire and forget, we don't want logging to hold up the request so don't wait for the callback
  if (!options.skip(event, context)) {
    logMessage(options.debug, 'logEvent', 'sending data invoking moesifAPI');

    moesifController.createEvent(new EventModel(logData), function(err) {
      if (err) {
        logMessage(options.debug, 'logEvent', 'Moesif API failed with err=' + JSON.stringify(err));
        if (options.callback) {
          options.callback(err, logData);
        }
      } else {
        logMessage(options.debug, 'logEvent', 'Moesif API succeeded');
        if(options.callback) {
          options.callback(null, logData);
        }
      }
    });
  }
}

function bodyToBase64(body) {
  if(!body) {
    return body;
  }
  if (Buffer.isBuffer(body)) {
    return body.toString('base64');
  } else if (typeof body === 'string') {
    return Buffer.from(body).toString('base64');
  } else if (typeof body.toString === 'function') {
    return Buffer.from(body.toString()).toString('base64');
  } else {
    return '';
  }
}

function getPathWithQueryStringParams(event) {
    return url.format({ pathname: event.path, query: event.queryStringParameters })
}

function ensureValidOptions(options) {
  if (!options) throw new Error('options are required by moesif-express middleware');
  if (!options.applicationId) throw new Error('A Moesif application id is required. Please obtain it through your settings at www.moesif.com');
  if (options.identifyUser && !_.isFunction(options.identifyUser)) {
    throw new Error('identifyUser should be a function');
  }
  if (options.getSessionToken && !_.isFunction(options.getSessionToken)) {
    throw new Error('getSessionToken should be a function');
  }
  if (options.getTags && !_.isFunction(options.getTags)) {
    throw new Error('getTags should be a function');
  }
  if (options.getApiVersion && !_.isFunction(options.getApiVersion)) {
    throw new Error('identifyUser should be a function');
  }
  if (options.maskContent && !_.isFunction(options.maskContent)) {
    throw new Error('maskContent should be a function');
  }
  if (options.skip && !_.isFunction(options.skip)) {
    throw new Error('skip should be a function');
  }
}

function ensureValidLogData(logData) {
  if (!logData.request) {
    throw new Error('For Moesif events, request and response objects are required. Please check your maskContent function do not remove this');
  }
  else {
    if (!logData.request.time) {
      throw new Error('For Moesif events, request time is required. Please check your maskContent function do not remove this');
    }
    if (!logData.request.verb) {
      throw new Error('For Moesif events, request verb is required. Please check your maskContent function do not remove this');
    }
    if (!logData.request.uri) {
      throw new Error('For Moesif events, request uri is required. Please check your maskContent function do not remove this');
    }
  }
  if (!logData.response) {
    throw new Error('For Moesif events, request and response objects are required. Please check your maskContent function do not remove this');
  }
  else {
    // if (!logData.response.body) {
    //   throw new Error('for log events, response body objects is required but can be empty object');
    // }
    if (!logData.request.time) {
      throw new Error('For Moesif events, response time is required. The middleware should populate it automatically. Please check your maskContent function do not remove this');
    }
  }
}

function ensureValidUserModel(userModel) {
  if (!userModel || !userModel.userId) {
    throw new Error('To update user, a userId field is required');
  }
}

function ensureValidCompanyModel(companyModel) {
  if (!companyModel || !companyModel.companyId) {
    throw new Error('To update company, a companyId field is required');
  }
}
