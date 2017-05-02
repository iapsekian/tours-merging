/*jshint esversion: 6 */

var fs = require('fs');
var debug = require('debug');
const util = require('util');
var MongoClient = require('mongodb').MongoClient;
var ObjectID = require('mongodb').ObjectID;

var productionEnv = false;
var testEnv = false;
var operateDB = false;

var targetEnv = process.argv.slice(2)[0];
var dbOPSwitch = process.argv.slice(3)[0];

if('PRODUCTION' === targetEnv){
	console.log('*** CAUTION!!! NOW this program will operate the PRODUCTION ENV.!!! ***');
	productionEnv = true;
	if('OPDB' === dbOPSwitch){
		console.log('*** & Database will be CHANGED!!! ***');
		operateDB = true;
	} else {
		console.log('*** BUT Database will remain unchanged.  ***');
	}
} else if('TEST' === targetEnv){
	console.log('*** Operate TEST ENV. ***');
	testEnv = true;
	if('OPDB' === dbOPSwitch){
		console.log('*** & Database will be CHANGED!!! ***');
		operateDB = true;
	} else {
		console.log('*** BUT Database will remain unchanged.  ***');
	}
} else if('OPDB' === targetEnv){
	console.log('*** Operate TEST ENV. ***');
	console.log('*** & Database will be CHANGED!!! ***');
	targetEnv = 'TEST';
	testEnv = true;
	operateDB = true;
} else {
	console.log('*** Operate TEST ENV. ***');
	console.log('*** BUT Database will remain unchanged.  ***');
	targetEnv = 'TEST';
	testEnv = true;	

	console.log('Arguments Example - ');
	console.log('	node xxx.js PRODUCTION');
	console.log('	node xxx.js PRODUCTION OPDB');
	console.log('	node xxx.js TEST === node xxx.js');
	console.log('	node xxx.js TEST OPDB === node xxx.js OPDB');
}

//DB definition/value

if(productionEnv){
	var mdbUrl = 'mongodb://52.39.111.227:27017/tourbooks';
} else if (testEnv){
	var mdbUrl = 'mongodb://tst.tourbooks.cc:27017/tourbooks';
}

var txVocName = ['Tour Type','Tour Category','Tour Destination'];
var txVocNameCount = txVocName.length;
var txVocId = {}, txTermsId = {};
	// txTermsId = {
	// 		"TourDestination": {
	// 			"Paris": "xxxxxxxxxxx",
	// 			"London": "xxxxxxxxxxx"
	// 		},
	// 		"TourCategory": {}
	// }

//base configuration

var debugDev = debug('dev');


MongoClient.connect(mdbUrl, (err, db) => {
	if(null === err) console.log("Connected successfully to server - " + mdbUrl);

	var cltTX = db.collection('Taxonomy');
	var cltTXTerms = db.collection('TaxonomyTerms');

	var txnmyInserted = false;

	var preparingData = () => {

		// get taxonomy vovaculary and id mapping
		var getTXVocId = ()=>{
			var count = txVocNameCount;
			var wait4txVocIdEnd = ()=>{
				count--;
				if(!count){
					debugDev('txVocId = ' + JSON.stringify(txVocId));
					fs.writeFileSync('./logs/txVocId.json', JSON.stringify(txVocId));
					getTXTerms();
				}
			};

			txVocName.forEach((vocName)=>{
				var qry = {'name': vocName};
				var prj = {'_id':1, 'name': 1};
				cltTX.find(qry).project(prj).toArray()
					.then( (d)=>{
						d.forEach( (item)=>{
							debugDev('key = ' + item.name.replace(/\s+/g,'') + ', value = ' + item._id.toString());
							txVocId[item.name.replace(/\s+/g,'')] = item._id.toString();
						});
						wait4txVocIdEnd();
					})
					.catch( (e)=>{
						console.log('Finding taxonomy vocabulary ID error! - ' + e);
					});
			});
		}

		// get taxonomy terms based on txVocId
		// called at the end of getTXVocId
		var getTXTerms = ()=>{
			var count = txVocNameCount;
			var wait4AllVocEnd = ()=>{
				count--;
				if(!count){
					//debugDev('txTermsId = ' + JSON.stringify(txTermsId));
					fs.writeFileSync('./logs/txTermsId.json', JSON.stringify(txTermsId));
					endProgram();
				}
			};

			txVocName.forEach((vocName)=>{
				var key = vocName.replace(/\s+/g,'');
				var qry = {'vocabularyId': txVocId[key]};
				var prj = {'_id':1, 'text': 1};

				// var addTerms2txTermsId = (terms)=>{
				// 	txTermsId[key] = JSON.parse(terms);
				// 	wait4AllVocEnd();
				// }

				cltTXTerms.find(qry).project(prj).toArray()
					.then( (d)=>{
						var terms = {};
						d.forEach( (term)=>{
							terms[term.text] = term._id.toString();
						});
						debugDev('key - ' + key);
						txTermsId[key] = terms;
						wait4AllVocEnd();
					})
					.catch( (e)=>{
						console.log('Finding taxonomy terms ID error! - ' + e);
					});
			});
		}

		// preparingData starting point
		getTXVocId();
	};

	var endProgram = ()=>{
		db.close();
		console.log('*** Finished!! ***');
	}

	// Starting point
	preparingData();
});