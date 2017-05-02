/*jshint esversion: 6 */

var fs = require('fs');
var debug = require('debug');
var debugDev = debug('dev');	
const util = require('util');
var MongoClient = require('mongodb').MongoClient;
var ObjectID = require('mongodb').ObjectID;


// var targetEnv = process.argv.slice(2)[0];
// var dbOPSwitch = process.argv.slice(3)[0];
// 
// options = {
// 	txVocName: [],
// 	txTermsFlag: boolean, //undefined --> default: true
// 	reversedListing: boolean, // undefined --> default: false
// 	targetEnv: '',
// 	dbOPSwitch: ''
// }

module.exports = (options, callback) => {

	var txVocName = options.txVocName;
	if(util.isUndefined(options.txTermsFlag))	options.txTermsFlag = true;
	var txTermsFlag = options.txTermsFlag;
	if(util.isUndefined(options.reversedListing))	options.reversedListing = false;
	var reversedListing = options.reversedListing;
	var targetEnv = options.targetEnv;
	var dbOPSwitch = options.dbOPSwitch;

	var productionEnv = false;
	var testEnv = false;
	var operateDB = false;


	if('PRODUCTION' === targetEnv){
		// debugDev('*** CAUTION!!! NOW this program will operate the PRODUCTION ENV.!!! ***');
		productionEnv = true;
		if('OPDB' === dbOPSwitch){
//			debugDev('*** & Database will be CHANGED!!! ***');
			operateDB = true;
		} else {
			// debugDev('*** BUT Database will remain unchanged.  ***');
		}
	} else if('TEST' === targetEnv){
		// debugDev('*** Operate TEST ENV. ***');
		testEnv = true;
		if('OPDB' === dbOPSwitch){
			// debugDev('*** & Database will be CHANGED!!! ***');
			operateDB = true;
		} else {
			// debugDev('*** BUT Database will remain unchanged.  ***');
		}
	} else if('OPDB' === targetEnv){
		// debugDev('*** Operate TEST ENV. ***');
		// debugDev('*** & Database will be CHANGED!!! ***');
		targetEnv = 'TEST';
		testEnv = true;
		operateDB = true;
	} else {
		// debugDev('*** Operate TEST ENV. ***');
		// debugDev('*** BUT Database will remain unchanged.  ***');
		targetEnv = 'TEST';
		testEnv = true;	

		// debugDev('Arguments Example - ');
		// debugDev('	node xxx.js PRODUCTION');
		// debugDev('	node xxx.js PRODUCTION OPDB');
		// debugDev('	node xxx.js TEST === node xxx.js');
		// debugDev('	node xxx.js TEST OPDB === node xxx.js OPDB');
	}


	//DB definition/value

	if(productionEnv){
		var mdbUrl = 'mongodb://52.39.111.227:27017/tourbooks';
	} else if (testEnv){
		var mdbUrl = 'mongodb://tst.tourbooks.cc:27017/tourbooks';
	}

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

	MongoClient.connect(mdbUrl, (err, db) => {
//		if(null === err) debugDev("Connected successfully to server - " + mdbUrl);

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
						// debugDev('txVocId = ' + JSON.stringify(txVocId));
						fs.writeFileSync('./logs/txVocId-' + targetEnv + '.json', JSON.stringify(txVocId));
						if(txTermsFlag){
							getTXTerms();
						} else {
							endProgram();
						}
					}
				};

				if(txVocNameCount !== 0){ //assign specific vocabularies
					txVocName.forEach((vocName)=>{
						var qry = {'name': vocName};
						var prj = {'_id':1, 'name': 1};
						cltTX.find(qry).project(prj).toArray()
							.then( (d)=>{
								d.forEach( (item)=>{
									if(reversedListing){
										txVocId[item._id.toString()] = item.name.replace(/\s+/g,'');
									} else {
										txVocId[item.name.replace(/\s+/g,'')] = item._id.toString();
									}
								});
								wait4txVocIdEnd();
							})
							.catch( (e)=>{
								console.log('Finding taxonomy vocabulary ID error! - ' + e);
							});
					});
				} else if(txVocNameCount === 0){ //list all vocabularies
					var qry = {};
					var prj = {'_id':1, 'name': 1};
					cltTX.find(qry).project(prj).toArray()
						.then( (d)=>{
							d.forEach( (item)=>{
								var key = item.name.replace(/\s+/g,'');
								var value = item._id.toString();
								// debugDev('key = ' + key + ', value = ' + value);
								if(reversedListing){
									txVocId[value] = key;
								} else {
									txVocId[key] = value;
								}
								txVocName.push(key);
							});
							
							txVocNameCount = txVocName.length;
							count = 1;
							wait4txVocIdEnd();
						})
						.catch( (e)=>{
							console.log('Finding taxonomy vocabulary ID error! - ' + e);
						});					
				}
			}

			// get taxonomy terms based on txVocId
			// called at the end of getTXVocId
			var getTXTerms = ()=>{
				var count = txVocNameCount;
				var wait4AllVocEnd = ()=>{
					count--;
					if(!count){
						//debugDev('txTermsId = ' + JSON.stringify(txTermsId));
						fs.writeFileSync('./logs/txTermsId-' + targetEnv + '.json', JSON.stringify(txTermsId));
						endProgram();
					}
				};

				txVocName.forEach((vocName)=>{
					var key = vocName.replace(/\s+/g,'');
					var qry = {};
					if(reversedListing){
						tmpTxVocId = Object.keys(txVocId);
						tmpTxVocId.forEach( (tmpKey) => {
							if(key === txVocId[tmpKey])	key = tmpKey;
							qry = {'vocabularyId': tmpKey};
						});
					} else {
						qry = {'vocabularyId': txVocId[key]};
					}
					var prj = {'_id':1, 'text': 1};

					// var addTerms2txTermsId = (terms)=>{
					// 	txTermsId[key] = JSON.parse(terms);
					// 	wait4AllVocEnd();
					// }

					cltTXTerms.find(qry).project(prj).toArray()
						.then( (d)=>{
							var terms = {};
							d.forEach( (term)=>{
								if(reversedListing){
									terms[term._id.toString()] = term.text;
								} else {
									terms[term.text] = term._id.toString();
								}
							});
//							debugDev('key - ' + key);
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
			// debugDev('*** Finished!! ***');
			callback(txVocId,txTermsId);
		}

		// Starting point
		preparingData();
	});
};	