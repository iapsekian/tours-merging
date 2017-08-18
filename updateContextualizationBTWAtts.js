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
	var mdbUrl = 'mongodb://52.25.67.91:27017/bookurdb';
} else if (testEnv){
	var mdbUrl = 'mongodb://tst.tourbooks.cc:27017/tourbooks';
}

if(!operateDB){
	var result = []
}

//base configuration

var txVocName = ['Attraction'];
var ctnTypeName = ['Attraction', 'Attraction Details'];

var txVocNameCount = txVocName.length;
var ctnTypeNameCount = ctnTypeName.length;
var ctnProjection = {'_id':1, 'text': 1, 'workspace':1, 'live':1};
var txVocId = {}, txTermsId = {}, ctnTypeId = {}, contents = {};

Array.prototype.clean = (deleteValue) => {
	for(var i = 0 ; i <this.length; i++) { 
		if(this[i] == deleteValue){ 
			this.splice(i, 1 ); 
			i--; 
		} 
	} 
	return this;
};

var cleanArray = (orig, callback) => {
	var newArray = new Array();
	var updFlag = false;
	for (var i = 0; i < orig.length; i++) {
		if(orig[i]){
			newArray.push(orig[i]);
		} else {
			updFlag = true;
		}
	}
	callback(updFlag ,newArray);
}


var dataPreparation = () => {
	console.log('Enter dataPreparation() ......');

	var dataReadyCount = 2;
	var wait4DataReady = () => {
		dataReadyCount--;
		if(!dataReadyCount){
			dataValidation();
		}
	}

	var getTXMap = require('./lib/getTXTermsMap.js');
	var options = {
		'txVocName': txVocName,
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
		ctnTypeId = types;

		var getContents = require('./lib/getContents.js');
		options2 = {
			ctnTypeId: ctnTypeId,
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

var dataValidation = () => {
	console.log('Enter dataValidation() .....');
	var txAttractionValidationLog = '';
	var attsJson = [];
	var txShouldBeInserted = false;
	ctnTypeName.forEach( (typeName) => {
		var key = typeName.replace(/\s+/g,'');
		var ctns = contents[key];
		ctns.forEach( (ctn) => {
			txVocName.forEach( (vocName) => {
				var vocKey = vocName.replace(/\s+/g,'');
				if(!txTermsId[vocKey][ctn.text]){
					txShouldBeInserted = true;
					txAttractionValidationLog += ctn.text + '\n';
					var addFlag = true;
					attsJson.forEach( (city) => {
						if(city.Title === ctn.text)
							addFlag = false;
					});
					if(addFlag)
						attsJson.push({"Title":ctn.text});
				}
			});
		});
	});	

	fs.writeFileSync('./logs/notExistedInTaxonomyAttraction-' + targetEnv + '.log', txAttractionValidationLog);
	fs.writeFileSync('./mapping/txAtts.json', JSON.stringify(attsJson));

	if(txShouldBeInserted){
		console.log('****** There still are taxonomy data which should be dealed with! Please excute "updateTXThemesCityAttTourTypeCatDest.js"!! ******');
		endProgram();
	} else {
		dataProcessing();
	}
}

var dataProcessing = () => {
	console.log('Enter dataProcessing() .....');
	var allContents = Object.keys(contents);
	var allContentsCount = allContents.length;
	var txVocs = Object.keys(txVocId);
	var txVocsCount = txVocs.length;

	var start = () => {
		var dbConnection = MongoClient.connect(mdbUrl);
		dbConnection.then( (db) => {
			var cltContents = db.collection('Contents');

			var wait4AllContentsEnd = () => {
				allContentsCount--;
				if(!allContentsCount){
					db.close();
					endProgram();
				}
			}

			allContents.forEach( (key) => {
				var ctns = contents[key];
				var ctnsUpdLog = '';

				var ctnsCount = ctns.length;
				var wait4ctnsEnd = () => {
					ctnsCount--;
					if(!ctnsCount){
						fs.writeFileSync('./logs/updateContextualizationBTWAtts-'+key+'-'+targetEnv+'.log', ctnsUpdLog);
						fs.writeFileSync('./logs/updateContextualizationBTWAtts-'+key+'-'+targetEnv+'.json', JSON.stringify(result));
						wait4AllContentsEnd();
					}
				}

				ctns.forEach( (ctn) => {
					console.log('Key = %s - Text = %s', key, ctn.text);
					var text = ctn.text;
					var updFlag = false;
					txVocs.forEach( (txVoc) => {
						var vocId = txVocId[txVoc];
						var termId = txTermsId[txVoc][text];
						var tmpTermsArray = [];

						//clean Array
						if(ctn.workspace.taxonomy[vocId]){
							if(Array.isArray(ctn.workspace.taxonomy[vocId])){
								ctn.workspace.taxonomy[vocId].clean(undefined);
								ctn.workspace.taxonomy[vocId].clean(null);
								ctn.workspace.taxonomy[vocId].clean('');
							}
						}						

						if(ctn.workspace.taxonomy[vocId]){
							if(Array.isArray(ctn.workspace.taxonomy[vocId])){
								tmpTermsArray = ctn.workspace.taxonomy[vocId];
								if(tmpTermsArray.indexOf(termId) === -1){
									tmpTermsArray.push(termId);
									updFlag = true;
								}
								ctn.workspace.taxonomy[vocId] = tmpTermsArray;
							} else{
								tmpTermsArray.push(ctn.workspace.taxonomy[vocId]);
								if(tmpTermsArray.indexOf(termId) === -1){
									tmpTermsArray.push(termId);
									updFlag = true;
								}
								ctn.workspace.taxonomy[vocId] = tmpTermsArray;
							}
						} else {
							updFlag = true;
							tmpTermsArray.push(termId);
							ctn.workspace.taxonomy[vocId] = tmpTermsArray;
						}
					});

					if(updFlag){
						//var objID = ObjectID.createFromHexString(ctn._id);
						var objID = ctn._id;
						var filter = { _id: objID};
						var updateField = {};
						updateField.workspace = ctn.workspace;
						updateField.live = ctn.workspace;
						var update = { $set: updateField };

						if(operateDB){
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
						} else{
							result.push(ctn.text);
							wait4ctnsEnd();
						}
					} else {
						wait4ctnsEnd();
					}
				});

				// fs.writeFileSync('./logs/contentsAfterDataProcessing-' + key + '-' + targetEnv + '.json', JSON.stringify(ctns));
				// wait4AllContentsEnd();								
			});
		}).catch( (e) => {
			console.log('dataProcessing Error happened!! - %s',e);
		});
	}

	// dataProcessing() starting point
	if(allContentsCount){
		start();
		// if(operateDB){
		// 	start();
		// } else {
		// 	endProgram();
		// }
	} else {
		endProgram();
	}
}

var endProgram = () => {
	console.log('*** updateContextualizationBTWAtts.js Finished!! ***');	
}

//Starting point
dataPreparation();

