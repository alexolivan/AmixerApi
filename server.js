var express = require('express'),
  http = require('http'),
  cors = require('cors'),
  app = express(),
  //socketIO = require('socket.io'),
  port = process.env.PORT || 3000;

app.use(cors());

bodyParser = require('body-parser');
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

var routes = require('./api/routes/AmixerRoutes');
routes(app);

var server = app.listen(port);
console.log('Amixer RESTful API server started on: ' + port);


var io = require('./sockets/socketio.js').listen(server);
console.log('Amixer Web socket server started on: ' + port);
