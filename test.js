var port = 8080;
console.log(process.argv);
if (process.argv[2]){
    port = +process.argv[2];
}

require("./index.js")(newActor).listen(port);

function newActor(id, client){
	return {
        lat: 0,
        lon: 0,
		foo: function(data, cb){
			cb(null, {hello: "from actor " + id + " running on port " + port});
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
            console.log("getting ready");
            cb();
        },
        deactivate: function(){
            console.log("bye bye");    
        }
	}
}

/*

GET http://localhost:8080/invoke/getposition/1/-29.4758688777316/-100.416252089629/

GET http://localhost:8080/invoke/setposition/1/
{"lat":"-29.4758688777316","lon":"-100.416252089629"} 

*/