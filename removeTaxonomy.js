/*jshint esversion: 6 */

//
//

var fs = require('fs');
var debug = require('debug');
var debugDev = debug('dev');
const util = require('util');
var MongoClient = require('mongodb').MongoClient;
var ObjectID = require('mongodb').ObjectID;

var targetEnv = process.argv.slice(2)[0];
var dbOPSwitch = process.argv.slice(3)[0];

var productionEnv = false;
var testEnv = false;
var operateDB = false;

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

//base configuration

var removalMapping = {
	"City Details": ['Tour Destination'],
	"Attraction Details": ['City','Themes','Tour Destination']
};

var txVocName = [];
var ctnTypeName = Object.keys(removalMapping);
ctnTypeName.forEach( (typeName) => {
	removalMapping[typeName].forEach( (vocName) => {
		txVocName.push(vocName);
	});
});

var txVocNameCount = txVocName.length;
var ctnTypeNameCount = ctnTypeName.length;
var ctnProjection = {'_id':1, 'text': 1, 'workspace':1, 'live':1};
var txVocId = {}, txTermsId = {}, cntTypeId = {}, contents = {};

Array.prototype.clean = (deleteValue) => {
	for(var i = 0 ; i <this.length; i++) { 
		if(this[i] == deleteValue){ 
			this.splice(i, 1 ); 
			i--; 
		} 
	} 
	return this;
};

var dataPreparation = () => {

	var dataReadyCount = 2;
	var wait4DataReady = () => {
		dataReadyCount--;
		if(!dataReadyCount){
			dataProcessing();
		}
	}

	var getTXMap = require('./lib/getTXTermsMap.js');
	var options = {
		'txVocName': txVocName,
		'txTermsFlag': false, //don't get txTermsId
		'targetEnv': targetEnv,
		'dbOPSwitch': dbOPSwitch
	};

	getTXMap(options, (vocs,terms)=>{
		txVocId = vocs;
		txTermsId = terms;
		wait4DataReady();
	});

	var getContentTypesId = require('./lib/getContentTypeId.js');
	var options1 = {
		'ctnTypeName': ctnTypeName,
		'targetEnv': targetEnv,
		'dbOPSwitch': dbOPSwitch
	};

	getContentTypesId(options1, (types)=>{
		cntTypeId = types;

		var getContents = require('./lib/getContents.js');
		options2 = {
			ctnTypeId: cntTypeId,
			projection: ctnProjection,
			targetEnv: targetEnv,
			dbOPSwitch: dbOPSwitch
		};
		getContents(options2, (ctns)=>{
			contents = ctns;
			wait4DataReady();
		});
	});
}

var dataProcessing = () => {
	var removalCtnType = Object.keys(removalMapping);
	var removalCtnTypeCount = removalCtnType.length;
	// var allContents = Object.keys(contents);
	// var allContentsCount = allContents.length;
	// var txVocs = Object.keys(txVocId);
	// var txVocsCount = txVocs.length;

	var start = () => {
		var dbConnection = MongoClient.connect(mdbUrl);
		dbConnection.then( (db) => {
			var cltContents = db.collection('Contents');

			var wait4AllRemovalCtnTypeEnd = () =>{
				removalCtnTypeCount--;
				if(!removalCtnTypeCount){
					db.close();
					endProgram();
				}
			}

			removalCtnType.forEach( (ctnType) => {
				var removalTXVocName = removalMapping[ctnType];
				var key = ctnType.replace(/\s+/g,'');
				var ctns = contents[key];
				var ctnsUpdLog = '';

				var ctnsCount = ctns.length;
				var wait4ctnsEnd = () => {
					ctnsCount--;
					if(!ctnsCount){
						fs.writeFileSync('./logs/TaxonomyRemovalLog-'+key+'-'+targetEnv+'.log', ctnsUpdLog);
						wait4AllRemovalCtnTypeEnd();
					}
				}

				ctns.forEach( (ctn) => {
					var text = ctn.text;
					var updFlag = false;

					removalTXVocName.forEach( (vocName) => {
						var txKey = vocName.replace(/\s+/g,'');
						var vocId = txVocId[txKey];

						if(ctn.workspace.taxonomy[vocId]){
							delete ctn.workspace.taxonomy[vocId];
							updFlag = true;
						}
					});

					if(updFlag){
						var objID = ctn._id;
						var filter = { _id: objID};
						var updateField = {};
						updateField.workspace = ctn.workspace;
						updateField.live = ctn.workspace;
						var update = { $set: updateField };

						cltContents.updateOne(filter, update)
							.then((r) => {
								debugDev('Content - ' + key + ': ' + text + ' has been updated successfully!');
								ctnsUpdLog += 'Content - ' + key + ': ' + text + ' has been updated successfully!\n';
								wait4ctnsEnd();
							})
							.catch((e) => {
								console.log('Update - '+ key + ': ' + text +' - error happened!! - %s',e);
								ctnsUpdLog += 'Content - ' + key + ': ' + text + ' - error happened during updating!! - ' + e + '\n';
								wait4ctnsEnd();
							});
							wait4ctnsEnd();
					} else {
						wait4ctnsEnd();
					}
				});				
			});			
		}).catch( (e) => {
			console.log('dataProcessing Error happened!! - %s',e);
		});
	}

	// dataProcessing() starting point
	if(removalCtnTypeCount){
		if(operateDB){
			start();
		} else {
			endProgram();
		}
	} else {
		endProgram();
	}
}

var endProgram = () => {
	console.log('*** updateCityTXTourDestCity.js Finished!! ***');	
}

//Starting point
dataPreparation();

