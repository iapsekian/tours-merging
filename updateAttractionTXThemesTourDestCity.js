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

var txVocName = ['City','Tour Destination','Themes'];
var ctnTypeName = ['Attraction'];

var txVocNameCount = txVocName.length;
var ctnTypeNameCount = ctnTypeName.length;
var ctnProjection = {'_id':1, 'text': 1, 'workspace':1, 'live':1};
var txVocId = {}, txTermsId = {}, ctnTypeId = {}, contents = {};
var atts = require('./mapping/att.json');

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
	var txCityValidationLog = '', txTDValidationLog = '', txThemesValidationLog = '', attValidationLog = '', attDetailsValidationLog = '';
	var citiesJson = [], destJson = [], themesJson = [];
	var txShouldBeInserted = false;

	atts.forEach( (att) => {
		debugDev('att.Attraction = '+att.Attraction);

		var themes = [];
		if(att.Themes.trim().length)	themes = att.Themes.trim().split(',');

		txVocName.forEach( (vocName) => {
			var vocKey = vocName.replace(/\s+/g,'');
			if(vocName === 'Tour Destination'){
				if(!txTermsId[vocKey][att['Tour Destination']]){
					txShouldBeInserted = true;
					txTDValidationLog += att['Tour Destination'] + '\n';
					var destAddFlag = true;
					destJson.forEach( (dest) => {
						if(dest.Title === att['Tour Destination'])
							destAddFlag = false;
					});
					if(destAddFlag)
						destJson.push({"Title":att['Tour Destination']});
				}
			} else if (vocName === 'City'){
				if(!txTermsId[vocKey][att.City]){
					txShouldBeInserted = true;
					txCityValidationLog += att.City + '\n';
					var addFlag = true;
					citiesJson.forEach( (city) => {
						if(city.Title === att.City)
							addFlag = false;
					});
					if(addFlag)
						citiesJson.push({"Title":att.City});
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
				if(ctn.text === att.Attraction)	notExisted = false;
			});
			if(notExisted){
				if(key === 'Attraction'){
					attValidationLog += att.Attraction + '\n';
				} else {
					attDetailsValidationLog += att.Attraction + '\n';
				}
			}
		});	
	});

	fs.writeFileSync('./logs/notExistedInTaxonomyCity-' + targetEnv + '.log', txCityValidationLog);
	fs.writeFileSync('./logs/notExistedInTaxonomyTourDest-' + targetEnv + '.log', txTDValidationLog);
	fs.writeFileSync('./logs/notExistedInTaxonomyThemes-' + targetEnv + '.log', txThemesValidationLog);
	fs.writeFileSync('./logs/notExistedInContentAttraction-' + targetEnv + '.log', attValidationLog);
	fs.writeFileSync('./logs/notExistedInContentAttractionDetails-' + targetEnv + '.log', attDetailsValidationLog);
	fs.writeFileSync('./mapping/cities.json', JSON.stringify(citiesJson));
	fs.writeFileSync('./mapping/dest.json', JSON.stringify(destJson));
	fs.writeFileSync('./mapping/themes.json', JSON.stringify(themesJson));

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
	var ctnsAttUpdLog = '', ctnsAttDetailsUpdLog = '';

	var start = () => {
		var dbConnection = MongoClient.connect(mdbUrl);

		dbConnection.then( (db) => {
			var cltContents = db.collection('Contents');

			var attsCount = atts.length;
			var wait4AttsEnd = () => {
				attsCount--;
				if(!attsCount){
					db.close();
					fs.writeFileSync('./logs/ContentsAttUpdatingLog-'+targetEnv+'.log', ctnsAttUpdLog);
					fs.writeFileSync('./logs/ContentsAttDetailsUpdatingLog-'+targetEnv+'.log', ctnsAttDetailsUpdLog);
					endProgram();
				}
			}

			atts.forEach( (att) => {

				var allContentsCount = allContents.length;
				var wait4AllContentsEnd = () => {
					allContentsCount--;
					if(!allContentsCount){
						wait4AttsEnd();
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
						if(att.Attraction === text){
							var attText = att.Attraction;
							var txTourDest = att['Tour Destination'];
							var txCity = att.City;
							var txThemes = [];
							if(att.Themes.trim().length)	txThemes = att.Themes.trim().split(',');

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

								if(txVoc === 'City'|| txVoc === 'TourDestination'){

									if(txVoc === 'City'){
										termId = txTermsId[txVoc][txCity];
									} else {
										termId = txTermsId[txVoc][txTourDest];
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
									if(key === 'Attraction'){
										debugDev('Content - ' + key + ': ' + text + ' has been updated successfully!');
										ctnsAttUpdLog += 'Content - ' + key + ': ' + text + ' has been updated successfully!\n';
									} else {
										debugDev('Content - ' + key + ': ' + text + ' has been updated successfully!');
										ctnsAttDetailsUpdLog += 'Content - ' + key + ': ' + text + ' has been updated successfully!\n';
									}
									wait4ctnsEnd();
								})
								.catch((e) => {
									if(key === 'Attraction'){
										debugDev('Content - ' + key + ': ' + text + ' has been updated successfully!');
										ctnsAttUpdLog += 'Content - ' + key + ': ' + text + ' has been updated successfully!\n';
									} else {
										debugDev('Content - ' + key + ': ' + text + ' has been updated successfully!');
										ctnsAttDetailsUpdLog += 'Content - ' + key + ': ' + text + ' has been updated successfully!\n';
									}
									wait4ctnsEnd();
								});
							
						} else {
							wait4ctnsEnd();
						}
					});

					// fs.writeFileSync('./logs/contentsAfterDataProcessing-' + key + '-' + targetEnv + '.json', JSON.stringify(ctns));
					// wait4AllContentsEnd();								
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
			endProgram();
		}
	} else {
		endProgram();
	}
}

var endProgram = () => {
	console.log('*** updateAttractionTXThemesTourDestCity.js Finished!! ***');	
}

//Starting point
dataPreparation();

