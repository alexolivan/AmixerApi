var express = require('express'),
  app = express(),
  port = process.env.PORT || 3000;

bodyParser = require('body-parser');
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

var routes = require('./api/routes/AmixerRoutes');
routes(app);

app.listen(port);

console.log('Amixer RESTful API server started on: ' + port);
