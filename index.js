var url = require('url');
var http = require('http');

module.exports = function(actorFunc, settingsOverride){
    if (!actorFunc || typeof(actorFunc) !== "function") throw Error("you must define a function to create actor objects");

    // default settings
    var settings = {
        maxActors: 1000,
        maxInactivityPeriod: 60 * 1000,
        gcFrequency: 10000
    }

    // override default settings
    settingsOverride = settingsOverride || {};
    for (var x in settings){
        settings[x] = settingsOverride[x] || settings[x];
    }
    
    // object to hold all actor instances
    var actors = {};

    // functions that can be invoked over http
    var actions = {
	    ping: function(req, args, cb){
		    cb(null, args);
	    },
	    invoke: function(req, args, cb){
		    var actorId = args[1];
            var actor = actors[actorId];
            var func = args[2];

            // todo, starting
		    if (!actor){
			    actor = actorFunc(actorId);
                actor.lastCalled = actor.created = getTime();
                actor.callCount = 0;
			    actors[actorId] = actor;
		    }
		    if (actor[func]){
                actor.lastCalled = getTime();
                actor.callCount += 1;
                if (req.method === "POST" || req.method === "PUT"){
			        var data = "";
			        req.on('data', function(chunk) { data += chunk });
			        req.on('end', function(){
                        try {
				            actor[func](JSON.parse(data), cb);
                        } catch (e){
                            cb(e);
                        }
			        });
                } else {
                    try {
				        actor[func](args.slice(3), cb);
                    } catch (e){
                        cb(e);
                    }
                }
		    } else {
                cb("function not found on actor (" + func + ")");        
            }
	    },
        rungc: function(req, args, cb){

            //console.log("running gc");
            var counter = 0;
            var gcTime = getTime() - settings.maxInactivityPeriod;
            for (var actorId in actors) {
                var actor = actors[actorId];
                if (actor.lastCalled < gcTime){
                    counter += 1;
                    if (actor.deactivate){
                        try {
                            actor.deactivate();
                        } catch (e) {
                            console.log(e);
                        }
                    }
                    delete actors[actorId]
                }
            }
            // TODO: implement a rule to remove actors if there are still too many
     
            //console.log("gc collected %s/%s actors", counter,Object.keys(actors).length);
            if (cb){
                cb(null, { garbageCollected: counter});
            }
        },
        health: function(req, args, cb){
            cb(null, {actors: Object.keys(actors).length, time: getTime() });    
        }
    };

    // create an http server
    var server = http.createServer(function(req, res){
	    var parsedUrl = url.parse(req.url);
	    //console.log(parsedUrl.pathname);
	    var parts = parsedUrl.pathname.split('/').filter(notEmpty);
	    var action = parts[0];
	    if (actions[action]){
		    actions[action](req, parts, function(err, data){
                if (err){
                    res.end(err, 500);
                } else {
                    if (data){
			            res.end(JSON.stringify(data), 200);
                    } else {
                        res.end("",200);
                    }
                }
		    });
	    } else {
		    res.end("action not found", 404);
	    }
    });

    // start the garbage collector
    setInterval(actions.rungc, settings.gcFrequency);

    // return the server, so the library consumer can choose the port
    return server;
}

function getTime(){
    return new Date().getTime();
}

function notEmpty(value){
	return value;
}




