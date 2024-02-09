'use strict'
const _ = require('lodash');
const moesifapi = require('moesifapi');
const moesifConfigManager = require('./moesifConfigManager');
const governanceRulesManager = require('./governanceRulesManager');
const EventModel = moesifapi.EventModel;
const UserModel = moesifapi.UserModel;
const CompanyModel = moesifapi.CompanyModel;
var startTime = Date.now();
var createRecorder = require('./outgoingRecorder');
var patch = require('./outgoing');
var createBatcher = require('./batcher');
const extractDataFromEventAndContext = require('./extractDataFromEventAndContext');
const dataUtils = require('./dataUtils');
var constructBaseLogData = extractDataFromEventAndContext.constructBaseLogData;
var prepareRequestDataForGovernance = extractDataFromEventAndContext.prepareRequestDataForGovernance;
var logMessage = dataUtils.logMessage;


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
      return (event.requestContext && event.requestContext.identity && event.requestContext.identity.apiKey);
    };
  options.getMetadata = options.getMetadata || function (event, context) {
    const metadata = {};
    metadata.trace_id = context.awsRequestId;
    metadata.function_name = context.functionName;
    metadata.request_context = event && event.requestContext;
    return metadata;
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

  var logBody = true;
  if (typeof options.logBody !== 'undefined' && options.logBody !== null) {
      logBody = Boolean(options.logBody);
   }
  options.logBody = logBody;

  ensureValidOptions(options);

  // config moesifapi
  var config = moesifapi.configuration;
  config.ApplicationId = options.applicationId || options.ApplicationId || process.env.MOESIF_APPLICATION_ID;
  config.UserAgent = 'moesif-aws-lambda-nodejs/' + '1.5.2';
  config.BaseUri = options.baseUri || options.BaseUri || config.BaseUri;
  var moesifController = moesifapi.ApiController;

  var batcher = null;

  options.batchSize = options.batchSize || 25;
  options.batchMaxTime = options.batchMaxTime || 2000;

  if (options.disableBatching) {
    batcher = null;
  } else {
    batcher = createBatcher(
      function(eventArray) {
        moesifController.createEventsBatch(
          eventArray.map(function(logData) {
            return new EventModel(logData);
          }),
          function(err, response) {
            if (err) {
              logMessage(
                options.debug,
                'saveEventsBatch',
                'moesif API failed with error: ' + JSON.stringify(err)
              );
              if (options.callback) {
                options.callback(err, eventArray);
              }
            } else {
              moesifConfigManager.tryUpdateHash(response);

              logMessage(
                options.debug,
                'saveEventsBatch',
                'moesif API succeeded with batchSize ' + eventArray.length
              );
              if (options.callback) {
                options.callback(null, eventArray);
              }
            }
          }
        );
      },
      options.batchSize,
      options.batchMaxTime
    );
  }

  var logGovernance = function(message, details) {
    logMessage(options.debug,
      'governance',
      message,
      details);
  };
  governanceRulesManager.setLogger(logGovernance);
  governanceRulesManager.tryGetRules();

  var trySaveEventLocal = function(eventData) {
    moesifConfigManager.tryGetConfig();
    governanceRulesManager.tryGetRules();

    if (moesifConfigManager.shouldSend(eventData && eventData.userId, eventData && eventData.companyId)) {
      let sampleRate = moesifConfigManager._getSampleRate(eventData && eventData.userId, eventData && eventData.companyId);
      eventData.weight = sampleRate === 0 ? 1 : Math.floor(100 / sampleRate);
      if (batcher) {
        batcher.add(eventData);
      } else {
        moesifController.createEvent(new EventModel(eventData), function(err) {
          logMessage(options.debug, 'saveEvent', 'moesif API callback err=' + err);
          if (err) {
            logMessage(options.debug, 'saveEvent', 'moesif API failed with error.');
            if (options.callback) {
              options.callback(err, eventData);
            }
          } else {
            logMessage(options.debug, 'saveEvent', 'moesif API succeeded');
            if (options.callback) {
              options.callback(null, eventData);
            }
          }
        });
      }
    }
  };

  var moesifMiddleware = function (event, context, callback) {
    moesifConfigManager.tryGetConfig();

    logMessage(options.debug, 'moesifMiddleware', 'start');
    var next = function (err, result) {
      logEvent(event, context, err, result, options, moesifController);
      callback(err, result)
    };

    let returnPromise;
    let extraHeaders = {};
    if (governanceRulesManager.hasRules()) {
      var requestDataForGovernance = prepareRequestDataForGovernance(event, context, isV1);

      var governedResponseHolder = governanceRulesManager.governRequest(
        moesifConfigManager._config,
        // this may cause identifyUser and identifyCompany to be called twice,
        // but this should be ok, but in order to block for governance rule
        // we have to trigger this earlier in the stream before response might be ready
        ensureToString(options.identifyUser(event, context)),
        ensureToString(options.identifyCompany(event, context)),
        requestDataForGovernance.requestFields,
        requestDataForGovernance.requestHeaders,
        requestDataForGovernance.requestBody
      );

      if (governedResponseHolder.headers) {
        extraHeaders = governedResponseHolder.headers;
      }

      if (governedResponseHolder.blocked_by) {
        returnPromise = Promise.resolve({
          isBase64Encoded: false,
          statusCode: governedResponseHolder.status,
          headers: {
            ...governedResponseHolder.headers,
            'X-Moesif-Blocked-By': governedResponseHolder.blocked_by
          },
          body: JSON.stringify(governedResponseHolder.body)
        });
      }
    }
    if (!returnPromise) {
      returnPromise = handler(event, context, next);
    }

    if (returnPromise instanceof Promise) {
      return returnPromise.then((result) => {
        result.headers = {
          ...result.headers,
          ...extraHeaders,
        };
        return logEvent(event, context, null, result, options, moesifController).then(() => {
          return result;
        });
      }).catch((err) => {
        logEvent(event, context, err, {}, options, moesifController);
        throw err;
      });
    }
    return returnPromise;
  };

  moesifMiddleware.updateUser = function(userModel, cb) {
    const user = new UserModel(userModel);
    logMessage(options.debug, 'updateUser', 'userModel=' + JSON.stringify(userModel));
    ensureValidUserModel(user);
    logMessage(options.debug, 'updateUser', 'userModel valid');
    moesifController.updateUser(user, cb);
  };

  moesifMiddleware.updateUsersBatch = function(usersBatchModel, cb) {
    usersBatch = [];
    for (let userModel of usersBatchModel) {
      usersBatch.push(new UserModel(userModel));
    }
    logMessage(options.debug, 'updateUsersBatch', 'usersBatchModel=' + JSON.stringify(usersBatchModel));
    ensureValidUsersBatchModel(usersBatch);
    logMessage(options.debug, 'updateUsersBatch', 'usersBatchModel valid');
    moesifController.updateUsersBatch(usersBatch, cb);
  };

  moesifMiddleware.updateCompany = function(companyModel, cb) {
    const company = new CompanyModel(companyModel);
    logMessage(options.debug, 'updateCompany', 'companyModel=' + JSON.stringify(companyModel));
    ensureValidCompanyModel(company);
    logMessage(options.debug, 'updateCompany', 'companyModel valid');
    moesifController.updateCompany(company, cb);
  }

  moesifMiddleware.updateCompaniesBatch = function(companiesBatchModel, cb) {
    companiesBatch = [];
    for (let companyModel of companiesBatchModel) {
      companiesBatch.push(new CompanyModel(companyModel));
    }
    logMessage(options.debug, 'updateCompaniesBatch', 'companiesBatchModel=' + JSON.stringify(companiesBatchModel));
    ensureValidCompaniesBatchModel(companiesBatch);
    logMessage(options.debug, 'updateCompaniesBatch', 'companiesBatchModel valid');
    moesifController.updateCompaniesBatch(companiesBatch, cb);
  };

  moesifMiddleware.startCaptureOutgoing = function() {
    logMessage(options.debug, 'startCaptureOutgoing', 'initiating outgoing');
    if (moesifMiddleware._mo_patch) {
      logMessage(
        options.debug,
        'startCaptureOutgoing',
        'already started capturing outgoing requests.'
      );
    } else {
      function patchLogger(text) {
        logMessage(options.debug, 'outgoing capture', text);
      }
      var recorder = createRecorder(trySaveEventLocal, options, patchLogger);
      moesifMiddleware._mo_patch = patch(recorder, patchLogger);
    }
  };

  logMessage(options.debug, 'moesifInitiator', 'returning moesifMiddleware Function');
  return moesifMiddleware;
};

function determineIsEventVersionV1(event) {
  if (event.version === '1.0') {
    return true;
  }

  if (event.version === '2.0') {
    return false;
  }
  // per aws event spec https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-develop-integrations-lambda.html
  // events suppose to have version specified.
  // For some reason, the version is not specified in some cases.
  // so we use heuristic below.
  if (event.httpMethod) {
    return true;
  }

  return false;
}

function logEvent(event, context, err, result, options, moesifController) {
  // v1 has httpMethod, v2 has requestContext
  if ((!event.httpMethod && !event.requestContext) || !event.headers) {
    logMessage(
      options.debug,
      'logEvent',
      'AWS Lambda trigger must be a Load Balancer or API Gateway. ' +
        'See https://docs.aws.amazon.com/apigateway/latest/developerguide/api-gateway-set-up-simple-proxy.html#api-gateway-set-up-lambda-proxy-integration-on-proxy-resource'
    );
    return Promise.resolve();
  }

  if (options.skip(event, context)) {
    // exit early
    return Promise.resolve();
  }

  const isV1 = determineIsEventVersionV1(event);

  var logData = constructBaseLogData(
    event,
    context,
    err,
    result,
    options,
    isV1
  );

  logMessage(options.debug, 'logEvent', 'created data: \n' + JSON.stringify(logData));

  logData = options.maskContent(logData);

  return Promise.all([
    options.identifyUser(event, context),
    options.identifyCompany(event, context)
  ]).then(([userId, companyId]) => {
    logData.userId = userId;
    logData.companyId = companyId;
    logData.sessionToken = options.getSessionToken(event, context);

    // Set API direction
    logData.direction = 'Incoming';

    logMessage(options.debug, 'logEvent', 'applied options to data: \n' + JSON.stringify(logData));

    ensureValidLogData(logData);

    // This is fire and forget, we don't want logging to hold up the request so don't wait for the callback
    if (moesifConfigManager.shouldSend(logData && logData.userId, logData && logData.companyId)) {
      let sampleRate = moesifConfigManager._getSampleRate(
        logData && logData.userId,
        logData && logData.companyId
      );
      logData.weight = sampleRate === 0 ? 1 : Math.floor(100 / sampleRate);

      logMessage(options.debug, 'logEvent', 'sending data invoking moesifAPI');

      return new Promise((resolve) => {
        moesifController.createEvent(new EventModel(logData), function(err) {
          if (err) {
            logMessage(
              options.debug,
              'logEvent',
              'Moesif API failed with err=' + JSON.stringify(err)
            );
            if (options.callback) {
              options.callback(err, logData);
            }
          } else {
            logMessage(options.debug, 'logEvent', 'Moesif API succeeded');
            if (options.callback) {
              options.callback(null, logData);
            }
          }
          resolve();
        });
      });
    }
    return Promise.resolve();
  });
}

function ensureValidOptions(options) {
  if (!options) throw new Error('options are required by moesif-aws-lambda middleware');
  if (!options.applicationId) throw new Error('A Moesif application id is required. Please obtain it through your settings at www.moesif.com');
  if (options.identifyUser && !_.isFunction(options.identifyUser)) {
    throw new Error('identifyUser should be a function');
  }
  if (options.identifyCompany && !_.isFunction(options.identifyCompany)) {
    throw new Error('identifyCompany should be a function');
  }
  if (options.getSessionToken && !_.isFunction(options.getSessionToken)) {
    throw new Error('getSessionToken should be a function');
  }
  if (options.getMetadata && !_.isFunction(options.getMetadata)) {
    throw new Error('getMetadata should be a function');
  }
  if (options.getApiVersion && !_.isFunction(options.getApiVersion)) {
    throw new Error('getApiVersion should be a function');
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
