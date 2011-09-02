
/**
 * Module dependencies.
 */

var express = require('express');
var app = module.exports = express.createServer();
require('mongodb');

// Cloudfoundry config
if(process.env.VCAP_SERVICES){
  var env = JSON.parse(process.env.VCAP_SERVICES);
  var mongocnf = env['mongodb-1.8'][0]['credentials'];
}
else{
  var mongocnf = {"hostname":"localhost","port":27017,"username":"",
    "password":"","name":"","db":"db"}
}

// Data Source
var KolajeDB = require('./models/kollaje').KollajeDB;
var Kollaje = new KolajeDB(mongocnf);
// Configuration

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

app.listen(3000);
console.log("Express server listening on port %d in %s mode", app.address().port, app.settings.env);
