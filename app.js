/**
 * This file is an example AWS Lambda function.
 * The Moesif AWS Lambda SDK is in the ./lib directory
 */

const moesif = require('./lib');
console.log('Loading function');

const moesifOptions = {

    applicationId: process.env.MOESIF_APPLICATION_ID,

    identifyUser: function (event, context) {
        return event.requestContext && event.requestContext.identity && event.requestContext.identity.cognitoIdentityId
    }
};

exports.handler = function (event, context, callback) {
    callback(null, {
        statusCode: '200',
        body: JSON.stringify({key: 'hello world'}),
        headers: {
            'Content-Type': 'application/json'
        }
    });
};

exports.handler = moesif(moesifOptions, exports.handler);
