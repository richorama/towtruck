var port = 8080;
if (process.argv[2]){
    port = +process.argv[2];
}

require("./index.js")(newActor).listen(port);

function newActor(id, client){
    var counter = 0;
	return {
        lat: 0,
        lon: 0,
		foo: function(data, cb){
            counter += 1;
            cb(null, {hello: "from actor " + id + " running on port " + port, counter:counter});

		},
        bar: function(data, cb){
            client.invoke("x", "foo", {}, function(err, data){
                data.message = "via bar";
                cb(null, data);
            });                
        },
        setposition: function(data, cb){
            lat = data[0];    
            lon = data[1];
            cb();
        },
        getposition: function(data, cb){
            cb(null, {lat:lat,lon:lon});    
        },
        activate: function(cb){
            console.log("actor %s getting ready", id);
            cb();
        },
        deactivate: function(){
            console.log("destroying actor %s", id);
        }
	}
}

/*

POST http://localhost:8080/invoke/setposition/1/-29.4758688777316/-100.416252089629/

POST http://localhost:8080/invoke/getposition/1/
{"lat":"-29.4758688777316","lon":"-100.416252089629"} 

*/