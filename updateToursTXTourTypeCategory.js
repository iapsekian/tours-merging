/*jshint esversion: 6 */

//
//

var fs = require('fs');
var debug = require('debug');
var debugDev = debug('dev');
const util = require('util');
var MongoClient = require('mongodb').MongoClient;
var ObjectID = require('mongodb').ObjectID;
var mapping = require('./lib/mapping-util.js');

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

var txVocName = ['Tour Type','Tour Category'];
var ctnTypeName = ['Tours'];

var txVocNameCount = txVocName.length;
var ctnTypeNameCount = ctnTypeName.length;
var ctnProjection = {'_id':1, 'text': 1, 'workspace':1};
var txVocId = {}, txTermsId = {}, ctnTypeId = {}, contents = {};
var rtoursTypeId = {}, rtoursContents = [];

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
	var txTourTypeValidationLog = '', txTourCatValidationLog = '';
	var typeJson = [], categoryJson = [];

	//Prepare RTours data for tour category
	//
	var getRTours = () => {
		var dataReadyCount = 1;
		var wait4DataReady = () => {
			dataReadyCount--;
			if(!dataReadyCount){
				validation();
			}
		}

		var getRToursTypesId = require('./lib/getContentTypeId.js');
		var options1 = {
			'ctnTypeName': ['RTours'],
			'targetEnv': targetEnv,
			'dbOPSwitch': dbOPSwitch
		};

		getRToursTypesId(options1, (types)=>{
			rtoursTypeId = types;

			var getRToursContents = require('./lib/getContents.js');
			options2 = {
				ctnTypeId: rtoursTypeId,
				projection: ctnProjection,
				targetEnv: targetEnv,
				dbOPSwitch: dbOPSwitch
			};
			getRToursContents(options2, (ctns)=>{
				rtoursContents = ctns;
				wait4DataReady();
			});
		});
	}

	var validation = () => {
		var txShouldBeInserted = false;
		ctnTypeName.forEach( (typeName) => {
			var key = typeName.replace(/\s+/g,'');
			var ctns = contents[key];
			ctns.forEach( (ctn) => {
				txShouldBeInserted = false;
				txVocName.forEach( (vocName) => {
					var vocKey = vocName.replace(/\s+/g,'');
					var source = '', termKey = '';
					if(vocName === 'Tour Type'){
						if(ctn.workspace.fields.productType){
							source = ctn.workspace.fields.productType;
							if(!util.isNullOrUndefined(source))
								termKey = mapping.getTargetTourType(source);
						}
					} else if(vocName === 'Tour Category'){
						rtoursContents.RTours.forEach( (rtour) => {
							if(rtour.workspace.fields.productCode === ctn.workspace.fields.productCode){
								source = rtour.workspace.fields.tourCategory;
								if(!util.isNullOrUndefined(source))
									termKey = mapping.getTargetTourCategory(source);
							}
						});
					}
					if(!txTermsId[vocKey][termKey]){
						txShouldBeInserted = true;
						if(!util.isNullOrUndefined(source)){
							if(vocKey === 'TourType'){
								txTourTypeValidationLog += termKey + '\n';
								var addFlag = true;
								typeJson.forEach( (type) => {
									if(type.SourceType === source)
										addFlag = false;
								});
								if(addFlag){
									typeJson.push({"SourceType":source,"TargetType":termKey});
								}
							} else if(vocKey === 'TourCategory'){
								txTourCatValidationLog += termKey + '\n';
								var tcAddFlag = true;
								categoryJson.forEach( (cat) => {
									if(cat.SourceCategory === source)
										tcAddFlag = false;
								});
								if(tcAddFlag){
									categoryJson.push({"SourceCategory":source,"TargetCategory":termKey});
								}
							}
						}
					}
				});
			});
		});	

		fs.writeFileSync('./logs/notExistedInTaxonomyTourType-' + targetEnv + '.log', txTourTypeValidationLog);
		fs.writeFileSync('./logs/notExistedInTaxonomyTourCategory-' + targetEnv + '.log', txTourCatValidationLog);
		fs.writeFileSync('./mapping/type-new.json', JSON.stringify(typeJson));
		fs.writeFileSync('./mapping/category-new.json', JSON.stringify(categoryJson));

		if(txShouldBeInserted){
			console.log('****** There still are taxonomy data which should be dealed with! Please excute "updateTXThemesCityTourTypeCatDest.js"!! ******');
			endProgram();
		} else {
			dataProcessing();
		}
	}

	// starting point
	getRTours();
}

var dataProcessing = () => {
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
						fs.writeFileSync('./logs/ContentsUpdatingLog-'+key+'-'+targetEnv+'.log', ctnsUpdLog);
						wait4AllContentsEnd();
					}
				}

				ctns.forEach( (ctn) => {
					var text = ctn.text;
					var updFlag = false;
					txVocs.forEach( (txVoc) => {
						var vocId = txVocId[txVoc];
						var tmpTermsArray = [];
						var termId = '', termKey = '', source = '';

						//clean Array
						if(ctn.workspace.taxonomy[vocId]){
							if(Array.isArray(ctn.workspace.taxonomy[vocId])){
								cleanArray(ctn.workspace.taxonomy[vocId], (uf, newArr) => {
									updFlag = uf;
									ctn.workspace.taxonomy[vocId] = newArr;
								});
							} else {
								if(util.isNullOrUndefined(ctn.workspace.taxonomy[vocId]))
									ctn.workspace.taxonomy[vocId] = '';
							}
						}						

						if(txVoc === 'TourType'){
							if(ctn.workspace.fields.productType){
								source = ctn.workspace.fields.productType;
								if(!util.isNullOrUndefined(source))
									termKey = mapping.getTargetTourType(source);
							}
						} else if(txVoc === 'TourCategory'){
							rtoursContents.RTours.forEach( (rtour) => {
								if(rtour.workspace.fields.productCode === ctn.workspace.fields.productCode){
									source = rtour.workspace.fields.tourCategory;
									if(!util.isNullOrUndefined(source))
										termKey = mapping.getTargetTourCategory(source);
								}
							});
						}
						if(termKey)
							termId = txTermsId[txVoc][termKey];


						if(ctn.workspace.taxonomy[vocId]){
							if(txVoc === 'TourCategory'){
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
							} else if(txVoc === 'TourType'){
								ctn.workspace.taxonomy[vocId] = termId;
								updFlag = true;
							}
						} else {
							if(txVoc === 'TourCategory'){
								updFlag = true;
								tmpTermsArray.push(termId);
								ctn.workspace.taxonomy[vocId] = tmpTermsArray;
							} else if(txVoc === 'TourType'){
								updFlag = true;
								ctn.workspace.taxonomy[vocId] = termId;
							}
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
		if(operateDB){
			start();
		} else {
			console.log('operateDB=false so escape....');
			endProgram();
		}
	} else {
		console.log('Nothing to be dealed with .......');
		endProgram();
	}
}

var endProgram = () => {
	console.log('*** updateToursTXTourTypeCategory.js Finished!! ***');	
}

//Starting point
dataPreparation();

