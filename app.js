require.paths.unshift('./node_modules');
// Requires
var express = 	require('express')
	, mongoose = 	require('mongoose')
	, mongodb = 	require('mongodb')
	, form = 			require('connect-form')
	, knox = 			require('knox')
	, fs = 				require('fs')
	, _ = 				require('underscore');

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

// Amazon S3
var client = null;
fs.readFile('amazon.txt', 'UTF-8', function (err, data) {
  if (err) throw err;
	var cred = JSON.parse(data);
	client = knox.createClient({
	    key: cred.access_key
	  , secret: cred.secret_key
	  , bucket: 'kollaje'
	});
});


// Initialization
var app = express.createServer(
	form({ keepExtensions: true })
);
mongoose.connect(generate_mongo_url(mongocnf));

// Data Models
var Schema = mongoose.Schema
  , ObjectId = Schema.ObjectId;

var Pic = new Schema({
		filename		: String
	, filepath		: String
	, filetype		: String
	, extension		: String
	, created_at	: Date
})

var KollajeSchema = new Schema({
    owner    		: String
  , title     	: String
  , description : String
  , date      	: Date
	, pics      	: [Pic]
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
	Kollaje.find(function(err, docs){
		res.render('index.jade', {locals: {
			title: "Kollaje"
			, kollajes: docs
		}
		});
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
	kollaje.owner = req.param('owner');
	kollaje.title = req.param('title');
	kollaje.description = req.param('description');
	kollaje.date = new Date();
	kollaje.save();
	res.send(req.body);
})

app.get('/k/:id', function(req, res){
	Kollaje.findOne({title: req.param('id')}, function(err, doc){
		res.render('show.jade', {locals:doc});
	});
});

app.get('/k/:name/new', function(req, res){
	Kollaje.findOne({title: req.param('name')}, function(err, doc){
		res.render('new_pic.jade', {locals: {
			title: doc.title
			, kollaje: doc
		}
		});
	});
});


// PICTURES
app.post('/k/:name/new', function(req, res, next){

  // connect-form adds the req.form object
  // we can (optionally) define onComplete, passing
  // the exception (if any) fields parsed, and files parsed
  req.form.complete(function(err, fields, files){
    if (err) {
      next(err);
    } else {
			Kollaje.findOne({title: req.param('name')}, function(err, kollaje){
      	kollaje.pics.push({
						filename: files.image.filename
					, filepath: files.image.path
					, filetype: files.image.type
					, extension: _.last(files.image.filename.split("."))
				});
				kollaje.save();
				pic = _.last(kollaje.pics);
				fs.readFile(pic.filepath, function(err, buf){
					var filename = kollaje._id.toString() + "/" + pic._id.toString() + "." + pic.extension;
				  var put = client.put( filename, {
					 				      'Content-Length': buf.length
					 				    , 'Content-Type': pic.filetype
					 				  });
				  put.on('response', function(resp){
	 				    if (200 == resp.statusCode) {
	 				      console.log('saved to %s', req.url);
	 				    }
	 				  });
				  put.end(buf);
				});
				res.redirect('back');
			});
    }
  });

  // We can add listeners for several form
  // events such as "progress"
  req.form.on('progress', function(bytesReceived, bytesExpected){
    var percent = (bytesReceived / bytesExpected * 100) | 0;
    process.stdout.write('Uploading: %' + percent + '\r');
  });
});



app.listen(port);
//console.log("Express server listening on port %d in %s mode", app.address().port, app.settings.env);

// imgur key: b797a3ffcf23beaaf06175912324fbd8


