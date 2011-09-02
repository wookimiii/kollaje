var mongo = require('mongodb');

KollajeDB = function(config){
	var client = new mongo.Db(config.db, new mongo.Server(config.hostname, config.port, {})), 
		test = function (err, collection){};

	client.open(function(err, p_client) {});
};

exports.KollajeDB = KollajeDB;

