var express = require('express');
var fs = require('fs');

var app = express.createServer(express.logger());

app.get('/', function(request, response) {
	var buf = fs.readFileSync('index.html');
	response.send(buf.toString());
});

app.get('/images/:image_file', function(request, response) {
	var buf = fs.readFileSync('images/' + request.params.image_file);
	response.writeHead(200, {'Content-Type': 'image/jpeg'});
	response.end(buf,'binary');
});

var port = process.env.PORT || 8080;
app.listen(port, function() {
  console.log("Listening on " + port);
});
