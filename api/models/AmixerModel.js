'use strict';

// Global Vars
var exec = require("child_process").exec;
var execSync = require("child_process").execSync;
var cards = {};


/**
 * AUXILIARY FUNCTIONS
 */


// A common way of creating a failure JSON reply from an object.
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

// (Refactoring) parsing amixer output
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

// (Refactoring) parsing amixer output
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

/**
 * Parse an amixer 'content'. Amixer 'contents' are full depth info versions
 * of 'controls'.
 * This function will be used iterativelly or individually as needed.
 */
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

/**
 * Parse amixer generic, simple 'controls' argument.
 */
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

/**
 * A function to validate valid amixer BOOLEAN type values
 */
var parseBooleans = function (values, count) {
  for (var i = 0 ; i < count ; i++){
    if (values[i] != "on" && values[i] != "off"){
      return false;
    }
  }
  return true;
}

/**
 * A function to validate valid amixer INTEGER type values for a given control.
 */
var parseIntegers = function (values, count, min, max) {
  for (var i = 0 ; i < count ; i++){
    if (isNaN(values[i]) || parseInt(values[i], 10) < min || parseInt (values[i], 10) > max){
      return false;
    }
  }
  return true;
}

/**
 * A function to validate valid amixer ENUMERATED type values for a given control.
 */
var parseEnumerated = function (values, count, map) {
  for (var i = 0; i < count; i++){
    if (!(values[i] in map)){
      return false;
    }
  }
  return true;
}





/**
 * Initialize data by scanning detected sound cards.
 * I want to store a full amixer cget scan of all controls of all cards
 * So, further cset operation validations will be possible without needing to
 * call a cget prior to every cset, reducing responsiveness.
 */

var card_index = 0;
// Guess how many cards can we reach...
while(true){
  try {
    cards[card_index] = parseControls(execSync("amixer -c " + card_index + " controls"));
    card_index++;
  }
  catch (e) {
    break;
  }
}
// Scan and store a snapshot of all controls on every card...
for (var i = 0; i < card_index; i++){
  for (var j = 1; j <= Object.keys(cards[i]).length; j++){
    cards[i][j] = parseContent(execSync("amixer -c " + i + " cget numid=" + j) ,{});
  }
}

/**
 * Print a list the object structure of found controls upon server up.
 * This was helpful for debugging amixer cget output parsing. *
 */
//console.log("\n\nAvailable cards and controls scan result:\n")
//console.log(JSON.stringify(cards, null, 2));






/**
 * Here finally comes coding of the API Endpoints
 * We got Just R and U of CRUD, since card controls are what they are.
 * Reading is done through 'cget' amixer argument.
 * Updating a control current value/s is done through 'cset' amixer argument.
 */


/**
 * controls shoud return a JSON with all controls for a given card.
 * Or return a JSON failure reply.
 */
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

/**
 * cget actually handles a READ of a given control of a given card.
 * Or return a JSON failure reply.
 */
module.exports.cget = function (cardId, controlId, callback) {
  // I need to just check if card and controls do exist
  if ( cardId in cards && controlId in cards[cardId] ){
    exec("amixer -c " + cardId + " cget numid=" + controlId, function (err, stdout, stderr) {
      if (err) {
        callback(renderError(err), null)
      } else {
        if (stderr) {
          callback(renderError(stderr), null);
        } else {
          // amixer executed successfully return result to controller.
          var result = { success: true };
          callback(null, parseContent(stdout, result));
        }
      }
    });
  //No such card or control...
  }else{
    callback(renderError("No such control."), null);
  }
}

/**
 * cset handles An UPDATE on a given card's control.
 * It is far more dense ... depending on what type of ALSA sound card control
 * is being updated, the amixer command expects some syntax changes.
 * Value ranges and states differ from control to control, control type, and
 * Sound Card model.
 * Fortunatelly, cget gives provides control capabilities information.
 */
module.exports.cset = function (cardId, controlId, body, callback) {
  // check card and control exists
  if ( cardId in cards && controlId in cards[cardId] ){
    // check the control is not a read-only control
    if (cards[cardId][controlId].info.access.includes('w')){
      // check we receive values to update
      if (body.values){

        var newValuesArr = body.values.split(',');
        var newValuesCount = newValuesArr.length;
        var valuesCount = cards[cardId][controlId].info.values;

        // check we receive as much values as the control has
        if (newValuesCount == valuesCount){

          // Logic splits here basing on ALSA control controlType.
          // Only BOOLEAN, INTEGER and ENUMERATE controls are handled.
          // TODO add support for IEC958/AES controls
          var controlType = cards[cardId][controlId].info.type;
          switch (controlType) {
            case "BOOLEAN":

              // check correctness of new boolean values
              if ( parseBooleans(newValuesArr, newValuesCount)){
                exec("amixer -c " + cardId + " cset numid=" + controlId + " " + body.values.toString(),
                function (err, stdout, stderr) {
                  if (err) {
                    callback(renderError(err), null)
                  } else {
                    if (stderr) {
                      callback(renderError(stderr), null);
                    } else {
                      // amixer executed successfully return result to controller.
                      var result = { success: true };
                      callback(null, parseContent(stdout, result));
                    }
                  }
                });
              } else {
                // Handle wrong BOOLEAN values
                callback(renderError("Unsupported BOOLEAN value/s.\n"
                + "BOOLEAN expect a list of values, being each value either on or off).\n"
                + "Received values were: " + newValuesArr), null);
              }
              break;

            case "INTEGER":

              // check correctness of new integer values
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
                        // amixer executed successfully return result to controller.
                        var result = { success: true };
                        callback(null, parseContent(stdout, result));
                      }
                    }
                  });
              } else {
                // Handle wrong INTEGER values
                callback(renderError("Unexpected INTEGER value/s.\n"
                + "INTEGER type expects integer values.\n"
                + "Also, values must be within max/min values span of control.\n"
                + "Max allowed value for this control is " + cards[cardId][controlId].info.max + ".\n"
                + "Min allowed value for this control is " + cards[cardId][controlId].info.min + ".\n"
                + "Received values were: " + newValuesArr), null);
              }
              break;

            case "ENUMERATED":

              // check correctness of new values
              if (parseEnumerated(newValuesArr, newValuesCount, cards[cardId][controlId].item_value_map )){
                exec("amixer -c " + cardId + " cset numid=" + controlId + " " + body.values.toString(),
                function (err, stdout, stderr) {
                  if (err) {
                    callback(renderError(err), null)
                  } else {
                    if (stderr) {
                      callback(renderError(stderr), null);
                    } else {
                      // amixer executed successfully return result to controller.
                      var result = { success: true };
                      callback(null, parseContent(stdout, result));
                    }
                  }
                });
              } else {
                // Handle wrong ENUMERATED values.
                callback(renderError("Unexpected ENUMERATED value/s.\n"
                + "ENUMERATED type values expect an integer list of Item indices.\n"
                + "Allowed values must be within control's item_value_map property.\n"
                + JSON.stringify(cards[cardId][controlId].item_value_map, null, 2) + "\n"
                + "Received values were: " + newValuesArr), null);
              }
              break;

            // Now to the end handle all common possible problem causes.
            default:
              callback(renderError("Unsupported type control.\n"
              + "Only INTEGER, BOOLEAN or ENUMERATED controls are handled."
              + "Control type was but of " + controlType + " type."),
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
