require.paths.unshift('./node_modules');
// Requires
var express = 	require('express')
	, mongoose = 	require('mongoose')
	, mongodb = 	require('mongodb')
	, form = 			require('connect-form')
	, knox = 			require('knox')
	, fs = 				require('fs')
	, _ = 				require('underscore')
	, im = 				require('imagemagick')

/**
 * Module dependencies.
 */

// Cloudfoundry config
var port = (process.env.PORT || 3000);

var mongo_url = process.env.MONGOLAB_URI || "mongodb://localhost:27017/db"

// Amazon S3
var amazon = null;
var S3_KEY = process.env.S3_KEY || "";
var S3_SECRET = process.env.S3_SECRET || "";
if( S3_KEY == "" ){
	fs.readFile('amazon.txt', 'UTF-8', function (err, data) {
	  if (err) throw err;
		var cred = JSON.parse(data);
		amazon = knox.createClient({
		    key: cred.access_key
		  , secret: cred.secret_key
		  , bucket: 'kollaje_dev'
		});
	});
}



// Initialization
var app = express.createServer(
	form({ keepExtensions: true})
);
mongoose.connect(mongo_url);

// Data Models
var Schema = mongoose.Schema
  , ObjectId = Schema.ObjectId;

var PicSchema = new Schema({
		filename		: String
	, filepath		: String
	, filetype		: String
	, extension		: String
	, kollaje_id	: ObjectId
	, created_at	: Date
})

var KollajeSchema = new Schema({
    owner    		: String
  , title     	: String
  , description : String
  , date      	: Date
});

var Pic = mongoose.model('Pic', PicSchema);

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

app.get('/k/:title', function(req, res){
	Kollaje.findOne({title: req.param('title')}, function(err, kollaje){
		var tmpdate = new Date();
		query = Pic.find({kollaje_id: kollaje._id})
		query.sort('created_at', -1)
		query.exec( function(err, pics){
			kollaje.pics = pics || []
			res.render('show.jade', {locals:kollaje});
		})
		
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


app.get('/k/:title/:pic', function(req, res){
	res.contentType(req.param("pic"));
	Kollaje.findOne({title: req.param('title')}, function(err, kollaje){
		var filename = kollaje._id.toString() + "/" + req.param("pic")
		var image = new Buffer(0);
		amazon.get(filename).on('response', function(resp){
	  	resp.on('data', function(chunk){
				res.write(chunk);
		  });
			resp.on('end', function(){
				res.end()
			})
		}).end();
		
	});
});


function uploadToAmazon(pic, filepath, filename){
	fs.readFile(filepath, function(err, buf){
	  var put = amazon.put( filename, {
		 				      'Content-Length': buf.length
		 				    , 'Content-Type': pic.filetype
		 				  });
	  // put.on('response', function(resp){
	  // 		    if (200 == resp.statusCode) {
	  // 		      console.log('saved to %s', req.url);
	  // 		    }
	  // 		  });
	  put.end(buf);
	});
}

// PICTURES
app.post('/k/:name/new', function(req, res, next){
	console.log(req.form);
  // connect-form adds the req.form object
  // we can (optionally) define onComplete, passing
  // the exception (if any) fields parsed, and files parsed
  req.form.complete(function(err, fields, files){
    if (err) {
      next(err);
    } else {
			Kollaje.findOne({title: req.param('name')}, function(err, kollaje){
				var pic = new Pic({
						filename: files.image.filename
					, filepath: files.image.path
					, filetype: files.image.type
					, extension: _.last(files.image.filename.split("."))
					, created_at: new Date()
					, kollaje_id: kollaje._id
				})
				pic.save()
				
				var filename = kollaje._id.toString() + "/" + pic._id.toString() + "." + pic.extension;
				uploadToAmazon(pic, pic.filepath, filename);
				
				im.identify(pic.filepath, function(err, features){
				  if (err) throw err
					var thumb_width = 100;
					var thumb_height = thumb_width * features.height /features.width;
					var large_width = 600;
					var large_height = large_width * features.height /features.width;
					var thumb_path = req.form.uploadDir + "/" + pic._id.toString() + "_thumb." + pic.extension;
					var thumb_filename = kollaje._id.toString() + "/" + pic._id.toString() + "_thumb." + pic.extension;
					var large_path = req.form.uploadDir + "/" + pic._id.toString() + "_large." + pic.extension;
					var large_filename = kollaje._id.toString() + "/" + pic._id.toString() + "_large." + pic.extension;
					// thumbnail
					im.convert([pic.filepath, '-resize', thumb_width.toString()+"x"+thumb_height, thumb_path], 
						function(err, metadata){
						  if (err) throw err
							uploadToAmazon(pic, thumb_path, thumb_filename);
						})	
					// large
					im.convert([pic.filepath, '-resize', large_width.toString()+"x"+large_height, large_path], 
						function(err, metadata){
						  if (err) throw err
							uploadToAmazon(pic, large_path, large_filename);
						})
					})
			res.redirect('back');
			});
    }
  });
	req.form.on('complete', function(){
		console.log("upload complete");
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



