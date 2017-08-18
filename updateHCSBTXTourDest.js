/*jshint esversion: 6 */

//This program will include a external json file - hscb.json as the updateing source for taxonomy Tour Destination
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

//base configuration

var txVocName = ['Tour Destination'];
var ctnTypeName = ['HSCB Link'];

var txVocNameCount = txVocName.length;
var ctnTypeNameCount = ctnTypeName.length;
var ctnProjection = {'_id':1, 'text': 1, 'workspace':1};
var txVocId = {}, txTermsId = {}, ctnTypeId = {}, contents = {};
var hcsbLinks = require('./mapping/hscb.json');

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
		//'txTermsFlag': true,
		//'reversedListing': false,
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
	var txTDValidationLog = '', hscbValidationLog = '';
	var destJson = [];
	var txShouldBeInserted = false;

	hcsbLinks.forEach( (hcsb) => {
		debugDev('hcsb.Title = ' + hcsb.Title);

		var tourDestinations = [];
		if(hcsb['Tour Destination'].trim().length)	tourDestinations = hcsb['Tour Destination'].trim().split(',');

		txVocName.forEach( (vocName) => {
			var vocKey = vocName.replace(/\s+/g,'');
			if(vocName === 'Tour Destination'){
				if(tourDestinations.length){
					tourDestinations.forEach( (tourDestination) => {
						var tmpTourDestination = tourDestination.trim();
						if(tmpTourDestination.length){
							if(!txTermsId[vocKey][tmpTourDestination]){
								txShouldBeInserted = true;
								txTDValidationLog += tmpTourDestination + '\n';
								var tourDestinationAddFlag = true;
								destJson.forEach( (t) => {
									if(t.Title === tmpTourDestination)
										tourDestinationAddFlag = false;
								});
								if(tourDestinationAddFlag)
									destJson.push({"Title":tmpTourDestination});
							}																		
						}
					});
				}
			}
		});

		ctnTypeName.forEach( (typeName) => {
			var ctns = [];
			var key = typeName.replace(/\s+/g,'');
			ctns = contents[key];
			var notExisted = true;
			ctns.forEach( (ctn) => {
				if(ctn.text=== hcsb.Title)	notExisted = false;
			});
			if(notExisted){
				hscbValidationLog += hcsb.Title + '\n';
			}
		});	
	});

	fs.writeFileSync('./logs/notExistedInTaxonomyTourDest-' + targetEnv + '.log', txTDValidationLog);
	fs.writeFileSync('./logs/notExistedInContentHSCBLink-' + targetEnv + '.log', hscbValidationLog);
	fs.writeFileSync('./mapping/dest.json', JSON.stringify(destJson));

	if(txShouldBeInserted){
		console.log('****** There still are taxonomy data which should be dealed with! Please excute "updateTXThemesCityTourTypeCatDest.js"!! ******');
		endProgram();
	} else {
		dataProcessing();
	}
}

var dataProcessing = () => {
	var allContents = Object.keys(contents);
	// var allContentsCount = allContents.length;
	var txVocs = Object.keys(txVocId);
	var txVocsCount = txVocs.length;
	var ctnsHCSBLinkUpdLog = '';

	var start = () => {
		var dbConnection = MongoClient.connect(mdbUrl);

		dbConnection.then( (db) => {
			var cltContents = db.collection('Contents');

			var hcsbLinksCount = hcsbLinks.length;
			var wait4HCSBLinkEnd = () => {
				hcsbLinksCount--;
				if(!hcsbLinksCount){
					db.close();
					// fs.writeFileSync('./logs/contentsAfterDataProcessing-' + 'Tours' + '-' + targetEnv + '.json', JSON.stringify(contents)); //for debuging
					fs.writeFileSync('./logs/ContentsHSCBLinkUpdatingLog-'+targetEnv+'.log', ctnsHCSBLinkUpdLog);
					endProgram();
				}
			}

			hcsbLinks.forEach( (hcsb) => {

				var allContentsCount = allContents.length;
				var wait4AllContentsEnd = () => {
					allContentsCount--;
					if(!allContentsCount){
						wait4HCSBLinkEnd();
					}
				}

				allContents.forEach( (key) => {
					var ctns = contents[key];

					var ctnsCount = ctns.length;
					var wait4ctnsEnd = () => {
						ctnsCount--;
						if(!ctnsCount){
							wait4AllContentsEnd();
						}
					}

					ctns.forEach( (ctn) => {
						var text = ctn.text;
						var updFlag = false;
						if(hcsb.Title === text){
							var txTourDestinations = [];
							if(hcsb['Tour Destination'].trim().length)	txTourDestinations = hcsb['Tour Destination'].trim().split(',');

							txVocs.forEach( (txVoc) => {
								var vocId = txVocId[txVoc];
								var termId = '', tmpTermsArray = [];

								//remove null from txTerms
								if(ctn.workspace.taxonomy[vocId]){
									if(Array.isArray(ctn.workspace.taxonomy[vocId])){
										cleanArray(ctn.workspace.taxonomy[vocId], (uf, na) => {
											if(uf){
												updFlag = true;
												ctn.workspace.taxonomy[vocId] = na.slice();
											}
										});
									} else{
										if(util.isNullOrUndefined(ctn.workspace.taxonomy[vocId])){
											ctn.workspace.taxonomy[vocId] = '';
											updFlag = true;
										}
									}
								}

								if(txVoc === 'TourDestination'){
									if(txTourDestinations.length){
										txTourDestinations.forEach( (dest) => {
											var tmpDest = dest.trim();
											if(tmpDest.length){
												termId = txTermsId[txVoc][tmpDest];

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
											}
										});
									}
								}
							});
						}

						if(updFlag){
							//var objID = ObjectID.createFromHexString(ctn._id);
							var objID = ctn._id;
							var filter = { _id: objID};
							var updateField = {};
							updateField.workspace = ctn.workspace;
							updateField.live = ctn.workspace;
							var update = { $set: updateField };

							cltContents.updateOne(filter, update)
								.then((r) => {
									debugDev('Content - ' + key + ': ' + text + ' has been updated successfully!');
									ctnsHCSBLinkUpdLog += 'Content - ' + key + ': ' + text + ' has been updated successfully!\n';
									wait4ctnsEnd();
								})
								.catch((e) => {
									debugDev('Content - ' + key + ': ' + text + ' failed to be updated!' + e);
									ctnsHCSBLinkUpdLog += 'Content - ' + key + ': ' + text + ' failed to be updated! '+e+'\n';
									wait4ctnsEnd();
								});
							
						} else {
							wait4ctnsEnd();
						}

						//wait4ctnsEnd(); //for debuging
					});
				});
			});
		}).catch( (e) => {
			console.log('dataProcessing Error happened!! - %s',e);
		});
	}

	// dataProcessing() starting point
	if(allContents.length){
		if(operateDB){
			start();
		} else {
			console.log('operateDB=False, so escape.....');
			endProgram();
		}
	} else {
		console.log('Nothing to do, ESCAPE.....');
		endProgram();
	}
}

var endProgram = () => {
	console.log('*** updatHCSBTXTourDest.js Finished!! ***');	
}

//Starting point
dataPreparation();

