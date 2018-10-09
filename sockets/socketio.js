'use strict';

var socketIO = require('socket.io');
var clients = {};
var io;
var someone = false;
var inc = true;

// This variable should be initialized as an structured object of Meter
// Controls with their initial values.
var vuMetersData = {
  0: 0,
  1: 0
};

// This is just a fake/demo/test value generator for Faders to use
// in Front end.
// Further implementation of AmixerModel knowing which controls are
// actually Meters/vuMeters/etc is needed.
// Ideally a call to an AmixerModel method would get an object with updated
// values on each Meter on teh card, to broadcast them out of the websocket.
var feeder = setInterval(function(){
  if (someone) {
    if (io){
      if(inc){
        if (vuMetersData[0] < 100){
          vuMetersData[0]++;
          vuMetersData[1]++;
        }else{
          inc = false;
        }
      }else{
        if (vuMetersData[0] > 0){
          vuMetersData[0]--;
          vuMetersData[1]--;
        }else{
          inc = true;
        }
      }
      io.emit('vuMetersData', vuMetersData);
    }
  }
}, 200)


module.exports.listen = function(server) {
  io = socketIO.listen(server);

  io.on('connection', function(client) {
    if (Object.keys(clients).length == 0) {
      someone = true;
    }
    clients[client.id] = client;
    console.log('new connection', client.id);

    client.on('disconnect', function() {
      delete clients[client.id];
      console.log('Client: ' + client.id + ' Disconnect');
      if (Object.keys(clients).length == 0) {
        someone = false;
      }
    });
  });

  return io;
}
