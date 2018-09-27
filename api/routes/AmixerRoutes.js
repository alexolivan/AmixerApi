'use strict';

module.exports = function(app) {
  var amixer = require('../controllers/AmixerController');

  // Get a list of all controls of a given card.
  app.route('/cards/:cardId/controls')
    .get(amixer.controls)

  // Get or Update the values/status of a given control on a given card.
  app.route('/cards/:cardId/controls/:controlId')
    .get(amixer.cget)
    .post(amixer.cset)
};
