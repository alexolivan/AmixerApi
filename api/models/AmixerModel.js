'use strict';

var exec = require("child_process").exec;
var execSync = require("child_process").execSync;
var cards = {};



var renderError = function(error) {
  var result = {
    success: false
  };
  if (error){
    var lines = error.toString().split('\n');
    if (lines) {
      result.trace = {};
      for (var i = 0; i < lines.length ; i++){
        if (lines[i]){
          result.trace[i] = lines[i].toString();
        }
      }
    }
  }
  return result;
}

var appendPairs = function(result, items, name) {
  items.forEach(function (item) {
    var parts = item.split('=');
    if (parts){
      if (!result[name]){
        result[name] = {};
      }
      if (parts[0] == "name"){
        result[name][parts[0]] = parts[1].replace(/'/g,'');
      }else{
        result[name][parts[0]] = parts[1];
      }
    }
  });
};

var appendValues = function(result, values_str, name) {
  var values = values_str.split(',');
  if (values){
    if (!result[name]){
      result[name] = {};
    }
  }
  for (var i = 0; i < values.length; i++){
    result[name][i] = values[i];
  }
};

var parseContent = function(stdout, result){
  var lines = stdout.toString().split('\n');
  appendPairs(result, lines[0].split(','), "info");
  appendPairs(result, lines[1].substring(4).split(','), "info");
  for (var i = 2; i < lines.length; i++){
    var line = lines[i].substring(2);
    if (line.charAt(0) == ';'){
      var parts = line.split('#');
      if (parts) {
        var subparts = parts[1].split(' ');
        if (subparts) {
          if (!result.item_value_map){
            result.item_value_map = {};
          }
          result.item_value_map[subparts[0]] = parts[1].match(/'([^']+)'/)[1];
        }
      }
    } else if (line.charAt(0) == ':') {
      appendValues(result, line.split('=')[1], "current_values");
    } else if (line.charAt(0) == '|' || line.charAt(4 == '|')) {
      if (line.substring(2) == "container"){
        result.container = {};
        continue;
      }
      if (result.container){
        appendValues(result.container, line.substring(4).split('=')[1], line.substring(4).split('=')[0]);
      } else {
        appendPairs(result, line.substring(2).split(','), "scale");
      }
    }
  }

  return result;
}

var parseControls = function(stdout) {
  var result = {};

  var lines = stdout.toString().split('\n');
  lines.forEach(function(line){
    if (line) {
      var controlName = line.split(',')[0].split('=')[1];
      result[controlName] = {};
      appendPairs(result, line.split(','), controlName);
    }
  });

  return result;
}


var parseBooleans = function (values, count) {
  for (var i = 0 ; i < count ; i++){
    if (values[i] != "on" && values[i] != "off"){
      return false;
    }
  }
  return true;
}

var parseIntegers = function (values, count, min, max) {
  for (var i = 0 ; i < count ; i++){
    if (isNaN(values[i]) || parseInt(values[i], 10) < min || parseInt (values[i], 10) > max){
      return false;
    }
  }
  return true;
}

/**
 * Initialize data by scanning detected sound cards
 */
var card_index = 0;
while(true){
  try {
    cards[card_index] = parseControls(execSync("amixer -c " + card_index + " controls"));
    card_index++;
  }
  catch (e) {
    break;
  }
}
for (var i = 0; i < card_index; i++){
  for (var j = 1; j <= Object.keys(cards[i]).length; j++){
    cards[i][j] = parseContent(execSync("amixer -c " + i + " cget numid=" + j) ,{});

  }
}
console.log("Available cards and controls scan result:")
console.log(JSON.stringify(cards, null, 2));



//
// API Endpoint functions
//

module.exports.controls = function (cardId, callback) {
  if ( cardId && cardId in cards){
    var response = cards[cardId];
    response.success = true;
    callback(null, response);
  } else {
    var response = renderError("No such card.")
    callback(renderError(stderr), null);
  }
}

module.exports.cget = function (cardId, controlId, callback) {
  if ( cardId in cards && controlId in cards[cardId] ){
    exec("amixer -c " + cardId + " cget numid=" + controlId, function (err, stdout, stderr) {
      if (err) {
        callback(renderError(err), null)
      } else {
        if (stderr) {
          callback(renderError(stderr), null);
        } else {
          var result = { success: true };
          callback(null, parseContent(stdout, result));
        }
      }
    });
  }else{
    callback(renderError("No such control."), null);
  }
}

module.exports.cset = function (cardId, controlId, body, callback) {
  if ( cardId in cards && controlId in cards[cardId] ){
    if (cards[cardId][controlId].info.access.includes('w')){
      if (body.values){

        var newValuesArr = body.values.split(',');
        var newValuesCount = newValuesArr.length;
        var valuesCount = cards[cardId][controlId].info.values;

        if (newValuesCount == valuesCount){

          var controlType = cards[cardId][controlId].info.type;
          switch (controlType) {
            case "BOOLEAN":
              if ( parseBooleans(newValuesArr, newValuesCount)){

                exec("amixer -c " + cardId + " cset numid=" + controlId + " " + body.values.toString(),
                function (err, stdout, stderr) {
                  if (err) {
                    callback(renderError(err), null)
                  } else {
                    if (stderr) {
                      callback(renderError(stderr), null);
                    } else {
                      var result = { success: true };
                      callback(null, parseContent(stdout, result));
                    }
                  }
                });

              }else{
                callback(renderError("Unsupported BOOLEAN value/s.\n"
                + "BOOLEAN values must be use on/off strings.\n"
                + "Received values are: " + newValuesArr), null);
              }
              break;

            case "INTEGER":
              if (parseIntegers(newValuesArr, newValuesCount,
                cards[cardId][controlId].info.min,
                cards[cardId][controlId].info.max)){

                  exec("amixer -c " + cardId + " cset numid=" + controlId + " -- " + body.values.toString(),
                  function (err, stdout, stderr) {
                    if (err) {
                      callback(renderError(err), null)
                    } else {
                      if (stderr) {
                        callback(renderError(stderr), null);
                      } else {
                        var result = { success: true };
                        callback(null, parseContent(stdout, result));
                      }
                    }
                  });

              }else{
                callback(renderError("Unexpected INTEGER value/s.\n"
                + "INTEGER type expects integer values.\n"
                + "Values must be within control max/min values span.\n"
                + "Max allowed value for this control is " + cards[cardId][controlId].info.max + ".\n"
                + "Min allowed value for this control is " + cards[cardId][controlId].info.min + ".\n"
                + "Received values are: " + newValuesArr), null);
              }
              break;

            case "ENUMERATED":
              console.log("ENUMERATED type values: " + body.values.toString());
              callback(null, response);
              break;
            default:
              callback(renderError("Unsupported type control.\n"
              + "Only INTEGER, BOOLEAN or ENUMERATED controls are handled."
              + "Control type is but of " + controlType + " type."),
              null);
          }
        }else{
          callback(renderError("Not enough values received.\n"
          + "Expecting " + valuesCount + " values.\n"
          + "But " + newValuesCount + " values received."), null);
        }
      } else {
        callback(renderError("No values received."), null);
      }
    } else {
      callback(renderError("Read-only type control."), null);
    }
  } else {
    callback(renderError("No such control."), null);
  }
}
