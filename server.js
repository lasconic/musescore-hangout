/**
 * Module dependencies.
 */

var express = require('express')
  , routes = require('./routes')
  , urlUtils = require('url')
  , http = require('http')
  , redis = require('redis')
  , faye = require('faye')
  , tools = require('./tools');


var bayeux = new faye.NodeAdapter({mount: '/faye', timeout: 45});

// Web Server, Express ------------------------------------------
var app = module.exports = express.createServer();

var redisClient = redis.createClient();
redisClient.on('error', function(err) {
  console.log("Redis error: " + e.message);   
});

bayeux.attach(app);

// Configuration
app.configure(function(){
  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(app.router);
  app.use(express.static(__dirname + '/public'));
});

app.configure('development', function(){
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true })); 
});

app.configure('production', function(){
  app.use(express.errorHandler()); 
});

// Routes

app.get('/', routes.index);
app.post('/create', function(req, res) {
	var msurl = req.param('msurl', 'default');
 
	 // GET.   
	 var options = {  
	           host: 'api.musescore.com',   
	           port: 80,   
	           path: '/services/rest/resolve.json?url=' + encodeURIComponent(msurl) + '&oauth_consumer_key=musichackday'  
	      };
	 var req = http.get(options, function(response302) {  
	      if (response302.statusCode == 302) {
	      	var scoreURL = urlUtils.parse(response302.headers.location);
	      	options = {host: scoreURL.hostname,
	      				port:80,
	      				path:scoreURL.pathname + scoreURL.search
	      				};
	      	http.get(options, function(resp) {
	      		if(resp.statusCode == 200) 
	      		    var data = '';
	      			resp.on('data', function(chunk) {   
	      				data += chunk;
      				}).on('error', function(e) {  
	      			  console.log("Got error: " + e.message);   
	 				});
      				resp.on('end', function() {
      				    var score = JSON.parse(data); 
           				console.log(score.id + ' - ' + score.secret + ' - ' + score.metadata.pages);
           				
           				var scoreSave = {id:score.id, secret : score.secret, pageCount:score.metadata.pages};
           				redisClient.incr( 'next.session.id' , function (err, id) {
           					var sessionId = tools.randomString(5) + id;
           					redisClient.set('session:'+sessionId, JSON.stringify(scoreSave), function() {
           						var msg = 'You can go to your <a href="/session/' + sessionId + '">sheet music session</a>';
           						res.send(msg);
           					});	
           				});	
      				});
	      		}); 
	      }  
	 }).on('error', function(e) {  
	      console.log("Got error: " + e.message);   
	 });  
	});
	
app.get('/session/:sessionid', function(req, res, next){
	var sessionId = req.params.sessionid;
	console.log("sessionId " + sessionId);
	redisClient.get('session:'+sessionId, function(err, data){
		if(!data) {
			res.writeHead(404);
			res.write('No session found.');
			res.end();
			return;
		}
		var score = JSON.parse(data);
		res.render('session.jade', {title:"Sheet music session", 
			id:score.id, 
			secret:score.secret, 
			pageCount: score.pageCount,
			sessionId: sessionId, 
			layout:false});	
	});
	
});

app.get('/session/:sessionid/gotomeasure', function(req, res, next){
  var sessionId = req.params.sessionid;
  var params = require('url').parse(req.url, true);
  var m = params['query']['measure'];

  bayeux.getClient().publish('/' + sessionId + '/gotomeasure', {
    mn:m
  });
  
  res.writeHead(200, {'Content-Type': 'text/plain'});
  res.end('Broadcasted go to measure '+m+' in session ' + sessionId + '\n');	
});


app.listen(8080);
console.log("Express server listening on port %d in %s mode", app.address().port, app.settings.env);
