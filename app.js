var restify = require('restify');
var builder = require('botbuilder');


var akamaiHelper = require('./akamai-helper.js');
// Setup Restify Server
var server = restify.createServer();


server.listen(process.env.port || process.env.PORT || 3978, function () {
    console.log('%s listening to %s', server.name, server.url);
});

// Create chat connector for communicating with the Bot Framework Service
var connector = new builder.ChatConnector({
    appId: process.env.MicrosoftAppId,
    appPassword: process.env.MicrosoftAppPassword
});

// Listen for messages from users 
server.post('/api/messages', connector.listen());

function defaultHandler() {

    this.init = function (bot) {

    }

    this.test = function (msg) {
        return msg.match("^debug-bot$");
    }

    this.handle = function (session) {
        session.send(JSON.stringify(session.userData.cacheQueue, null, 2));

    }
}


var handlers = [akamaiHelper, new defaultHandler()];

var inMemoryStorage = new builder.MemoryBotStorage();

var bot = new builder.UniversalBot(connector, [function (session) {

    handlers.filter(h => h.test(session.message.text)).map(h => h.handle(session));

}]).set('storage', inMemoryStorage);

handlers.forEach(h => h.init(bot));

