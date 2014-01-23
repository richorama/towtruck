require("./index.js")(newActor).listen(8080);

function newActor(id){
	return {
        lat: 0,
        lon: 0,
		foo: function(data, cb){
			cb(null, {hello: "from actor " + id});
		},
        setposition: function(data, cb){
            lat = data[0];    
            lon = data[1];
            cb();
        },
        getposition: function(data, cb){
            cb(null, {lat:lat,lon:lon});    
        }
	}
}

/*

GET http://localhost:8080/invoke/getposition/1/-29.4758688777316/-100.416252089629/

GET http://localhost:8080/invoke/setposition/1/
{"lat":"-29.4758688777316","lon":"-100.416252089629"} 

*/