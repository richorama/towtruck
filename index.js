var url = require('url');
var http = require('http');

module.exports = function(actorFunc, settingsOverride){
    if (!actorFunc || typeof(actorFunc) !== "function") throw Error("you must define a function to create actor objects");

    // default settings
    var settings = {
        maxActors: 1000,
        maxInactivityPeriod: 60 * 1000,
        gcFrequency: 10000,
        ring: {}
    }

    // override default settings
    settingsOverride = settingsOverride || {};
    for (var x in settings){
        settings[x] = settingsOverride[x] || settings[x];
    }
    
    // object to hold all actor instances
    var actors = {};

    var invokeRemoteActor = function(server, req, cb){
        get(server, req.url, cb);    
    }

    var createLocalActor = function(actorId, cb){
        if (actors[actorId]) cb(null, actors(actors[actorId]));

        var actor = actorFunc(actorId);
        actor.__lastCalled = actor.__created = getTime();
        actor.__callCount = 0;

        // if the actor provides an activation function, we must call this 
        // and queue all subsequent requests to actor until it is active
        if (actor.activate){
            actor.__state = "activating";
            try{
                actor.__activationqueue = [];
                actor.activate(function(){
                    actor.__state = "active";
                    actor.__activationqueue.forEach(function(x){
                        actions.invoke.apply(this, x);
                    });
                });                   
                cb(null, actor);
            } catch (e){
                cb(e);
                console.log(e);
            }
        } else {
            actor.__state = "active";    
            cb(null, actor);
        }
        actors[actorId] = actor;
    };

    var queryRemoteActor = function(actorId, cb){
        if (settings.ring.length === 0){
            cb("no servers in the ring");
        }
        var counter = 0;
        var found = false;
        var servers = Object.keys(settings.ring);
        if (servers.length === 0){
            cb();
            return;
        }
        servers.forEach(function(server){
            counter += 1;
            get(server, "/query/" + actorId, function(err, data){
                counter -= 1;
                if (data.exists){
                    found = true;
                    cb(null, server);                        
                } else if (counter === 0){
                    cb("not found");    
                }
            });
        });
    }

    var getData = function(req, args, cb){
        if (req.method === "POST" || req.method === "PUT"){
		    var data = "";
		    req.on('data', function(chunk) { data += chunk });
		    req.on('end', function(){
                cb(null, JSON.parse(data));
		    });
        } else {
            cb(null, args.slice(3));
        }
    }

    var invokeLocalActor = function(actor, func, req, args, cb){
	    if (actor[func]){
            actor.__lastCalled = getTime();
            actor.__callCount += 1;
            getData(req, args, function(err, data){
                try {
				    actor[func](data, cb);
                } catch (e){
                    cb(e);
                }
            });
	    } else {
            cb("function not found on actor (" + func + ")");        
        }
    }


    // functions that can be invoked over http
    var actions = {
	    ping: function(req, args, cb){
		    cb(null, args);
	    },
        query: function(req, args, cb){
            var actorId = args[1];
            var exists = actors[actorId] ? true : false;
            if (exists){
                // touch the date on the actor, so it doesn't get GC'd
                actors[actorId].__lastCalled = getTime(); 
            }
            cb(null,{exists: exists});
        },
        addserver: function(req, args, cb){
            settings.ring[args[1]] = true;
            cb();
        },
        removeserver: function(req, args, cb){
            delete settings.ring[args[1]];
            cb();
        },
        getservers: function(req, args, cb){
            cb(null, Object.keys(settings.ring));
        },
	    invoke: function(req, args, cb){
		    var actorId = args[1];
            var actor = actors[actorId];
            var func = args[2];

            var actor = actors[actorId];
            if (!actor){
                queryRemoteActor(actorId, function(err, server){
                    if (!server){
                        createLocalActor(actorId, function(err, actor){
                            invokeLocalActor(actor, func, req, args, cb);
                        });    
                    } else {
                        invokeRemoteActor(server, req, cb);    
                    }

                });
                return;
            }
            
            if (actor.__state === "activating"){
                actor.__activationqueue.push([req, args, cb]);
                return;
            }

            invokeLocalActor(actor, func, req, args, cb);
	    },
        rungc: function(req, args, cb){

            //console.log("running gc");
            var counter = 0;
            var gcTime = getTime() - settings.maxInactivityPeriod;
            for (var actorId in actors) {
                var actor = actors[actorId];
                if (actor.__lastCalled < gcTime){
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

function get(server, path, cb){
    console.log("GET http://" + server + path);
    http.get("http://" + server + path, function(resp){
        var data = "";
        resp.on("data", function(chunk){
            data += chunk;
        });
        resp.on("end", function(){
            cb(null, JSON.parse(data));
        });
    });    
}


