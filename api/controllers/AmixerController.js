'use strict';

var amixer = require('../models/AmixerModel');
var connections = {};
var intervalID;

exports.controls = function(req, res) {
  amixer.controls(req.params.cardId, function(err, controls) {
    if (err)
      res.send(err);
    res.json(controls);
  });
};

exports.cget = function(req, res) {
  amixer.cget(req.params.cardId, req.params.controlId, function(err, control) {
    if (err) {
      res.json(err);
    } else {
      res.json(control);
    }
  });
};

exports.cset = function(req, res) {
  amixer.cset(req.params.cardId, req.params.controlId, req.body, function(err, control) {
    if (err) {
      res.json(err);
    } else {
    res.json(control);
    }
  });
};
