/*jshint esversion: 6 */

//This program will include a external json file - rezdytours.json as the updateing source for taxonomy Tour Destination, Themes and Price 
//if you want to update taxonomy Tour Type and Tour Category, you should use another one - updateToursTXTourTypeCategory.js
//
//csvtojson --delimiter=';' data/csv/20170704RTours.csv > mapping/rezdytours.json

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

var txVocName = ['Tour Destination','Themes','Price'];
var ctnTypeName = ['Tours'];

var txVocNameCount = txVocName.length;
var ctnTypeNameCount = ctnTypeName.length;
var ctnProjection = {'_id':1, 'text': 1, 'workspace':1};
var txVocId = {}, txTermsId = {}, ctnTypeId = {}, contents = {}, toursNotExisted = [];
var rezdyTours = require('./mapping/rezdytours.json');

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
	var txPriceValidationLog = '', txTDValidationLog = '', txThemesValidationLog = '', rezdyToursValidationLog = '';
	var priceJson = [], destJson = [], themesJson = [];
	var txShouldBeInserted = false;

	rezdyTours.forEach( (tour) => {
		debugDev('tour["Tour Code"] = ' + tour["Tour Code"]);

		var themes = [];
		if(tour.Themes.trim().length)	themes = tour.Themes.trim().split(',');
		var tourDestinations = [];
		if(tour['Tour Destination'].trim().length)	tourDestinations = tour['Tour Destination'].trim().split(',');

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
			} else if (vocName === 'Price'){
				if(!txTermsId[vocKey][tour.Price]){
					txShouldBeInserted = true;
					txPriceValidationLog += tour.Price + '\n';
					var addFlag = true;
					priceJson.forEach( (price) => {
						if(price.Title === tour.Price)
							addFlag = false;
					});
					if(addFlag)
						priceJson.push({"Title":tour.Price});
				}
			} else if(vocName === 'Themes') {
				if(themes.length){
					themes.forEach( (theme) => {
						var tmpTheme = theme.trim();
						if(tmpTheme.length){
							if(!txTermsId[vocKey][tmpTheme]){
								txShouldBeInserted = true;
								txThemesValidationLog += tmpTheme + '\n';
								var themeAddFlag = true;
								themesJson.forEach( (t) => {
									if(t.Title === tmpTheme)
										themeAddFlag = false;
								});
								if(themeAddFlag)
									themesJson.push({"Title":tmpTheme});
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
				if(ctn.workspace.fields.productCode === tour["Tour Code"])	notExisted = false;
			});
			if(notExisted){
				rezdyToursValidationLog += tour["Tour Code"] + '\n';
				toursNotExisted.push(tour["Tour Code"]);
			}
		});	
	});

	fs.writeFileSync('./logs/notExistedInTaxonomyPrice-' + targetEnv + '.log', txPriceValidationLog);
	fs.writeFileSync('./logs/notExistedInTaxonomyTourDest-' + targetEnv + '.log', txTDValidationLog);
	fs.writeFileSync('./logs/notExistedInTaxonomyThemes-' + targetEnv + '.log', txThemesValidationLog);
	fs.writeFileSync('./logs/notExistedInContentTours-' + targetEnv + '.log', rezdyToursValidationLog);
	fs.writeFileSync('./mapping/price.json', JSON.stringify(priceJson));
	fs.writeFileSync('./mapping/dest.json', JSON.stringify(destJson));
	fs.writeFileSync('./mapping/themes.json', JSON.stringify(themesJson));

	if(txShouldBeInserted){
		console.log('****** There still are taxonomy data which should be dealed with! Please excute "updateTXTerms.js"!! ******');
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
	var ctnsToursUpdLog = '';

	var start = () => {
		var dbConnection = MongoClient.connect(mdbUrl);

		dbConnection.then( (db) => {
			var cltContents = db.collection('Contents');

			var rezdyToursCount = rezdyTours.length;
			var wait4RezdyToursEnd = () => {
				rezdyToursCount--;
				if(!rezdyToursCount){
					db.close();
					// fs.writeFileSync('./logs/contentsAfterDataProcessing-' + 'Tours' + '-' + targetEnv + '.json', JSON.stringify(contents)); //for debuging
					fs.writeFileSync('./logs/ContentsRezdyToursUpdatingLog-'+targetEnv+'.log', ctnsToursUpdLog);
					endProgram();
				}
			}

			rezdyTours.forEach( (tour) => {

				var allContentsCount = allContents.length;
				var wait4AllContentsEnd = () => {
					allContentsCount--;
					if(!allContentsCount){
						wait4RezdyToursEnd();
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
						var productCode = ctn.workspace.fields.productCode;
						var updFlag = false;
						if(tour['Tour Code'] === productCode){
							var tourProductCode = tour['Tour Code'];
							var txPrice = tour.Price;
							var txThemes = [];
							if(tour.Themes.trim().length)	txThemes = tour.Themes.trim().split(',');
							var txTourDestinations = [];
							if(tour['Tour Destination'].trim().length)	txTourDestinations = tour['Tour Destination'].trim().split(',');

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

								if(txVoc === 'Price'){
									termId = txTermsId[txVoc][txPrice];
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
								} else if(txVoc === 'TourDestination'){
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
								} else if(txVoc === 'Themes'){
									if(txThemes.length){
										txThemes.forEach( (theme) => {
											var tmpTheme = theme.trim();
											if(tmpTheme.length){
												termId = txTermsId[txVoc][tmpTheme];

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
									debugDev('Content - ' + key + ': ' + productCode + ' has been updated successfully!');
									ctnsToursUpdLog += 'Content - ' + key + ': ' + productCode + ' has been updated successfully!\n';
									wait4ctnsEnd();
								})
								.catch((e) => {
									debugDev('Content - ' + key + ': ' + productCode + ' failed to be updated! - ' + e);
									ctnsToursUpdLog += 'Content - ' + key + ': ' + productCode + ' failed to be updated! - '+e+'\n';
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
	console.log('*** updateRezdyToursTXThemesTourDestPrice.js Finished!! ***');	
}

//Starting point
dataPreparation();

