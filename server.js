'use strict';

const Hapi = require('@hapi/hapi');
const HapiPino= require('hapi-pino')

const Inert = require('@hapi/inert');

const Vision = require('@hapi/vision');

const HapiSwagger = require('hapi-swagger');

const packageJson = require('./package.json');

// Routes definitions array, local module
const routes = require('./lib/routes.js');

// Load server configuration data
const serverConfig = require('./configs/server.json');

var fs = require('fs')
const logFile = "./project.log";
if (fs.existsSync(logFile)) {
    fs.unlinkSync(logFile);
}
const log = require('simple-node-logger').createSimpleLogger('project.log');
console.log = log.info;

/*var pinoms = require('pino-multi-stream')
var streams = [
    {stream: fs.createWriteStream('/tmp/info.stream.out')},
    {level: 'info', stream: fs.createWriteStream('/tmp/info.stream.out')}
    ]
var log = pinoms({streams: streams})

log.info('this will be written to /tmp/info.stream.out')
*/
//log.fatal('this will be written to /tmp/fatal.stream.out')

// Create a Hapi server instance
// If you plan to deploy your hapi application to a PaaS provider, 
// you must listen on host 0.0.0.0 rather than localhost or 127.0.0.1
const server = new Hapi.Server({
    host: serverConfig.host, 
    port: serverConfig.port,
    router: {
        isCaseSensitive: false,
        stripTrailingSlash: true // removes trailing slashes on incoming paths
    }
});
//server.log(['test', 'error'], 'Test event');
//server.events.on('log', (event, tags) => {

  //  if (tags.error) {
   //     console.log(`Server error: ${event.error ? event.error.message : 'unknown'}`);
  //  }
//});
// Serevr Start Event
server.events.on('start', () => {

    //console.log('Server started');
    console.log(server.info.started);       
});
server.events.on('log', (event) => {

    console.log(`Server Event: ${event.timestamp ,event.data}`);
    
});
// Request Event
server.events.on('response', function (request) {
    console.log(request.info.remoteAddress + ': ' + request.method.toUpperCase() + ' ' + request.path + ' --> ' + request.response.statusCode);
});

server.events.on('response', (request) => {

    console.log(`Response sent for request: ${request.info.id}`);
});
//Server Stop Event
server.events.on('stop', () => {

    console.log('Server stopped');
});
// Serve all routes defined in the routes array
// server.route() takes an array of route objects
server.route(routes);

// Register plugins and start the server
const init = async function() {
    // Register invert plugin to serve CSS and JS static files
    await server.register(Inert);

    // Register vision plugin to render view templates
    await server.register(Vision);

    // HapiSwagger settings for API documentation
    const swaggerOptions = {
        info: {
                title: 'DeepPhe-Viz API Documentation',
                version: packageJson.version, // Use Viz version as API version, can be different though
            },
        };

    // Register HapiSwagger
    await server.register(
        {
            plugin: HapiSwagger,
            options: swaggerOptions
        });

    // View templates rendering
    server.views({
        // Using handlebars as template engine responsible for
        // rendering templates with an extension of .html
        engines: {
            html: require('handlebars')
        },
        isCached: false, // Tell Hapi not to cache the view files, no need to restart app
        // Tell the server that our templates are located in the templates directory within the current path
        relativeTo: __dirname,
        path: './client/templates',
        layoutPath: './client/templates/layout',
        helpersPath: './client/templates/helpers'
    });


    function resSerializer(res) {
        return {
            body:res.raw.body
        };
      }

      await server.register({
        plugin: HapiPino,
        options:
        {
            logPayload: true,
            prettyPrint:process.env.NODE_ENV !== 'production',
            redact: ['req.headers.authorization'],
            serializers:
            {
            res: resSerializer
            },
        }
    })
server.logger.info('another way')
const child=server.logger.child({a:'property'})

server.log(['subsystem'], 'third way ')

child.info('foo')
    // Start the server
    await server.start();
    console.log(`DeepPhe-Viz HTTP Server is running at: ${server.info.uri}`);
    console.log('Server started successfully')
    
};

process.on('unhandledRejection', (err) => {
    console.log(err);
    process.exit(1);
});

init();
