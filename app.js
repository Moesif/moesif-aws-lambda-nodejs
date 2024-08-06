/**
 * This file is an example AWS Lambda function.
 * The Moesif AWS Lambda SDK is in the ./lib directory
 */

const moesif = require('./lib');
var http = require('http');
var https = require('https');
console.log('Loading function');

const moesifOptions = {

    applicationId: process.env.MOESIF_APPLICATION_ID,

    identifyUser: function (event, context) {
        return event.requestContext && event.requestContext.identity && event.requestContext.identity.cognitoIdentityId
    }
};

var moesifMiddleware = moesif(moesifOptions);
moesifMiddleware.startCaptureOutgoing();

var handler = function (event, context, callback) {
    // Outgoing API call to third party
    https.get(
        {
          host: 'jsonplaceholder.typicode.com',
          path: '/posts/1'
        },
        function(res) {
          var body = '';
          res.on('data', function(d) {
            body += d;
          });

          res.on('end', function() {
            var parsed = JSON.parse(body);
            console.log(parsed);
          });
        }
      );

    callback(null, {
        statusCode: '200',
        body: JSON.stringify({key: 'hello world'}),
        headers: {
            'Content-Type': 'application/json'
        }
    });
};

// Async Functions
// For more details, please refer to - https://docs.aws.amazon.com/lambda/latest/dg/nodejs-handler.html.

// exports.handler = async (event, context) => {
//   const response = {
//     statusCode: 200,
//     body: JSON.stringify({ message: 'hello world' })
//   }
//   return response
// }

exports.handler = moesif(moesifOptions, handler);
