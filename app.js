require.paths.unshift('./node_modules');
// Requires
var express = require('express');
var mongoose = require('mongoose');

/**
 * Module dependencies.
 */

// Cloudfoundry config
var port = (process.env.VMC_APP_PORT || 3000);
var host = (process.env.VCAP_APP_HOST || 'localhost');

var mongocnf = {"hostname":"localhost","port":27017,"username":"",
  "password":"","name":"", "db":"db"}
if(process.env.VCAP_SERVICES){
  var env = JSON.parse(process.env.VCAP_SERVICES);
  mongocnf = env['mongodb-1.8'][0]['credentials'];
}

var generate_mongo_url = function(obj){
  obj.hostname = (obj.hostname || 'localhost');
  obj.port = (obj.port || 27017);
  obj.db = (obj.db || 'test');

  if(obj.username && obj.password){
    return "mongodb://" + obj.username + ":" + obj.password + "@" + obj.hostname + ":" + obj.port + "/" + obj.db;
  }
  else{
    return "mongodb://" + obj.hostname + ":" + obj.port + "/" + obj.db;
  }
}


// Initialization
var app = express.createServer();
mongoose.connect(generate_mongo_url(mongocnf));

// Data Models
var Schema = mongoose.Schema
  , ObjectId = Schema.ObjectId;

var KollajeSchema = new Schema({
    owner    		: ObjectId
  , title     	: String
  , description : String
  , date      	: Date
});

var Kollaje = mongoose.model('Kollaje', KollajeSchema);

app.configure(function(){
  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(express.compiler({ src: __dirname + '/public', enable: ['sass'] }));
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
app.get('/', function(req, res){
	res.render('index.jade', {locals: {
		title: "Kollaje"
	}
	});
});

app.get('/new', function(req, res){
	res.render('new.jade', {locals: {
		title: "Kollaje"
	}
	});
});

app.post('/create', function(req, res){
	var kollaje = new Kollaje();
	kollaje.author = req.param('author');
	kollaje.title = req.param('title');
	kollaje.description = req.param('description');
	kollaje.save();
	res.send(req.body);
})

app.listen(port);
//console.log("Express server listening on port %d in %s mode", app.address().port, app.settings.env);




