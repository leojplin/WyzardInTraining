var EdgeGrid = require('edgegrid');
var builder = require('botbuilder');

var clientToken = "",
    clientSecret = "",
    accessToken = "",
    baseUri = "";

var eg = new EdgeGrid(clientToken, clientSecret, accessToken, baseUri);

var envMapping = {
    dev3: 577696,
    dev4: 577697,
    devx: 470209,
    dev5: 470209,
    fqa: 577698,
    fqax: 470208,
    rqa: 577699,

}

function akamaiHelper() {
    this.regex = new RegExp('^clear-akamai (\\w+(,\\w+)*)$');
};

function checkIsCleared(session, body, envs) {

    session.send("Checking status...");
    eg.auth({
        path: body.progressUri,
        method: "GET"
    }).send(function (error, response, body) {
        body = JSON.parse(body);
        if (!error && body.purgeStatus === "Done") {
            session.send(`Purge request ${body.purgeId} is finished.`);
            envs.forEach(e => delete session.userData.cacheQueue[e]);
        } else if (!error && body.purgeStatus === "In-Progress") {
            session.send(`Purge request ${body.purgeId} is still in progress, will check again in ${body.pingAfterSeconds} seconds.`);
            setTimeout(() => checkIsCleared(session, body,envs), body.pingAfterSeconds * 1000 * 1.5);
        } else {
            session.send("Something weird happened. Maybe try again later.");
        }
    });

}


akamaiHelper.prototype.init = function (bot) {
    bot.dialog('clearAkamaiDialog', [
        function (session, args) {
            
            eg.auth({
                path: '/ccu/v2/queues/default',
                method: 'POST',
                body: {
                    "objects": args.map(e => envMapping[e]),
                    "action": "remove",
                    "type": "cpcode"
                },
                headers: {
                    'Content-Type': "application/json"
                }
            }).send(function (error, response, body) {
                body = JSON.parse(body);
                if (response.statusCode == 201) {
                    session.send(`Purge request ${body.purgeId} is accepted. Will check its status in ${body.pingAfterSeconds} seconds.`);
                    setTimeout(() => checkIsCleared(session, body, args), body.pingAfterSeconds * 1000 * 1.5);
                } else {
                    session.send("Your request to clear Akamai is not accepted. " + error);
                }
                session.endDialog();
            });
        }
    ]);

}

akamaiHelper.prototype.test = function (test) {
    return this.match = test.match(this.regex);
}

akamaiHelper.prototype.handle = function (session) {
    var envs = this.match[1];
    envs = envs.split(",")
        .map(e => e === "rqarqa" ? "rqa" : e) //secret way to clear rqa that only I know.
        .filter(e => envMapping[e]);

    if(!session.userData.cacheQueue){
        session.userData.cacheQueue = {};
    }

    envs = envs.filter(e => {
        if(session.userData.cacheQueue[e]){
            session.send(`${e} is already on the cache queue, please wait until it is finished to clear it again.`);
            return false;
        }else{
            session.userData.cacheQueue[e] = "initiated";
            return true;
        }
    });

    if (envs && envs.length > 0) {
        
        session.send('Initiating an Akamai Cache Clear for ' + envs);
        session.beginDialog("clearAkamaiDialog", envs);

    } else {
        session.send("Environments cannot be understood or you are not allowed to clear these environments or they are already in progress.");
    }
}



module.exports = new akamaiHelper();