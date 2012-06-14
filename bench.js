var urlUtils = require('url')
  , http = require('http')
  , faye = require('faye')
  , tools = require('./tools');
  
//var client = new faye.Client('http://localhost/faye');
//var sessionId = "oI7m91"

var client = new faye.Client('http://sessions.musescore.com/faye');
var sessionId = "classicalnext"


var loop = 5000;

for (var i = 0; i < loop; i++) {
    
    client.subscribe('/' + sessionId + '/action', function(message) {
        console.log(message);
    });
}