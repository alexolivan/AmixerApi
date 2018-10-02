var express = require('express'),
  cors = require('cors'),
  app = express(),
  port = process.env.PORT || 3000;

app.use(cors());

bodyParser = require('body-parser');
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

var routes = require('./api/routes/AmixerRoutes');
routes(app);

app.listen(port);

console.log('Amixer RESTful API server started on: ' + port);
