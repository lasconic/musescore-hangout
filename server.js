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

var hostname = 'musescore.no.de';
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
  hostname = 'localhost'; 
});

app.configure('production', function(){
  app.use(express.errorHandler()); 
  hostname = 'musescore.no.de';
});

// Routes

app.get('/', routes.index);
app.post('/create', function(req, res) {
	var msurl = req.param('msurl', 'default');
 
	 // GET.   
	 resolveScore(msurl, function(resp) {
	      		if(resp.statusCode == 200) {
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
	      		}
	      	});   
});
	
var resolveScore = function(msurl, endfunction) {
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
	      	http.get(options, endfunction); 
	      }  
	 }).on('error', function(e) {  
	      console.log("Got error: " + e.message);   
	 }); 
}
	
app.get('/session/:sessionid', function(req, res, next){
	var sessionId = req.params.sessionid;
	console.log("sessionId " + sessionId);
	scorePage(sessionId, 'session.jade', res);
});

app.get('/session/:sessionid/sessioncontrol', function(req, res, next){
	var sessionId = req.params.sessionid;
	console.log("sessionId " + sessionId);
	scorePage(sessionId, 'sessioncontrol.jade', res);
});

var scorePage = function(sessionId, template, res) {
    redisClient.get('session:'+sessionId, function(err, data){
		if(!data) {
			res.writeHead(404);
			res.write('No session found.');
			res.end();
			return;
		}
		var score = JSON.parse(data);
		
		var options = {  
	           host: 'api.musescore.com',   
	           port: 80,   
	           path: '/services/rest/score/'+score.id+'.json?&oauth_consumer_key=musichackday'  
	    };
      	http.get(options, function(resp) {
      		if(resp.statusCode == 200) {
      		    var data = '';
      			resp.on('data', function(chunk) {   
      				data += chunk;
     				}).on('error', function(e) {  
      			  console.log("Got error: " + e.message);   
 				});
   				resp.on('end', function() {
   				    var scoreData = JSON.parse(data); 
        			console.log(scoreData.id + ' - ' + scoreData.secret + ' - ' + scoreData.metadata.pages);
        			res.render(template, {title:scoreData.title, 
						id:scoreData.id, 
						secret:scoreData.secret, 
						pageCount: scoreData.metadata.pages,
						sessionId: sessionId, 
						layout:false,
						hostname:hostname,
						scoreChanged: scoreData.dates.lastupdate
					}); // res.render			
   				}); //resp.on
      		}//if 200
      	}); //http.get 
	}); //redisClient.get
}

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

app.get('/session/:sessionid/gotourl', function(req, res, next){
  var sessionId = req.params.sessionid;
  var params = require('url').parse(req.url, true);
  var url = params['query']['url'];

  bayeux.getClient().publish('/' + sessionId + '/gotourl', {
    url:url
  });
  
  res.writeHead(200, {'Content-Type': 'text/plain'});
  res.end('Broadcasted go to url '+url+' in session ' + sessionId + '\n');	
});

app.get('/session/:sessionid/loadscore', function(req, res, next){
  var sessionId = req.params.sessionid;
  var params = require('url').parse(req.url, true);
  var url = params['query']['url'];
  
  resolveScore(url, function(resp) {
	      		if(resp.statusCode == 200) {
	      		    var data = '';
	      			resp.on('data', function(chunk) {   
	      				data += chunk;
      				}).on('error', function(e) {  
	      			  console.log("Got error: " + e.message);   
	 				});
      				resp.on('end', function() {
      				    var score = JSON.parse(data); 
           				console.log(score.id + ' - ' + score.secret + ' - ' + score.metadata.pages);
           				
           				//publish new score to connected client
  						bayeux.getClient().publish('/' + sessionId + '/loadscore', {
    					  id:score.id
  						});
           				
           				var scoreSave = {id:score.id, secret : score.secret, pageCount:score.metadata.pages};
						redisClient.set('session:'+sessionId, JSON.stringify(scoreSave), function() {
							var msg = 'Session ' + sessionId + ' now displays score "' + score.title + '"';
							console.log(msg);
							res.send('Broadcasted load score <a href="'+url+'">'+score.title+'</a> in session '+
							  '<a href="/session/' + sessionId + '">'+sessionId+'</a>\n');
						});	
      				});
	      		}
	      	});   	
});

app.listen(80);
console.log("Express server listening on port %d in %s mode", app.address().port, app.settings.env);
