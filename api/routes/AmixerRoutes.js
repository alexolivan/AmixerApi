'use strict';
module.exports = function(app) {
  var amixer = require('../controllers/AmixerController');

  // todoList Routes
  app.route('/cards/:cardId/controls')
    .get(amixer.controls)

  app.route('/cards/:cardId/controls/:controlId')
    .get(amixer.cget)
    .post(amixer.cset)
};
