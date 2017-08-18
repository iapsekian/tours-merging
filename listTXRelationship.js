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
	var mdbUrl = 'mongodb://tst2.tourbooks.cc:27017/tourbooks';
}

//base configuration

var txVocName = [];
var ctnTypeName = [];
var txVocNameCount = txVocName.length;
var ctnTypeNameCount = ctnTypeName.length;
var ctnProjection = {'_id':1, 'text': 1, 'workspace':1};
var ctnTypeProjection = {'_id':1, 'type': 1, 'vocabularies': 1};
var txVocId = {}, txVocIdReversed = {}, ctnTypeId = {}, ctnTypeIdReversed = {}, contents = {}, contentTypes = {}, taxonomies = {};
var tableDef = {
	"x": "ContentType",
	"y": "Taxonomy"
};

var dataPreparation = () => {
	debugDev('Enter dataPreparation!');

	var dataReadyCount = 3;
	var wait4DataReady = () => {
		dataReadyCount--;
		if(!dataReadyCount){
			debugDev('Exit dataPreparation!');
			dataProcessing();
		}
	}

	// get taxonomies data
	var getTaxonomies = require('./lib/getTaxonomies.js');
	optionsT = {
		txVocName: [],
		targetEnv: '',
		dbOPSwitch: ''
	}
	getTaxonomies(optionsT, (txnm) => {
		taxonomies = txnm;
		wait4DataReady();
	});	

	//get taxonomy vocabular & terms mapping
	var getTXMap = require('./lib/getTXTermsMap.js');
	var options = {
		'txVocName': txVocName,
		'txTermsFlag': false, //don't get txTermsId
		'reversedListing': false, // undefined --> default: false
		'targetEnv': targetEnv,
		'dbOPSwitch': dbOPSwitch
	};

	getTXMap(options, (vocs,terms)=>{
		txVocId = vocs;
		options.reversedListing = true;
		getTXMap(options, (vocs,terms)=>{
			txVocIdReversed = vocs;
			wait4DataReady();
		});
	});

	//get contentType & contents mapping
	var getContentTypesId = require('./lib/getContentTypeId.js');
	var options1 = {
		'ctnTypeName': ctnTypeName,
		'reversedListing': false, // undefined --> default: false
		'targetEnv': targetEnv,
		'dbOPSwitch': dbOPSwitch
	};

	getContentTypesId(options1, (types)=>{
		ctnTypeId = types;

		var count = 3;
		var wait4DetailsEnd = () => {
			count--;
			if(!count){
				wait4DataReady();
			}
		}


		var getContents = require('./lib/getContents.js');
		var options2 = {
			ctnTypeId: ctnTypeId,
			projection: ctnProjection,
			targetEnv: targetEnv,
			dbOPSwitch: dbOPSwitch
		};
		getContents(options2, (ctns)=>{
			contents = ctns;
			wait4DetailsEnd();
		});


		//get contentTypes and their definitions
		var getContentTypes = require('./lib/getContentTypes.js');
		var options3 = {
				ctnTypeId: ctnTypeId,
				projection: ctnTypeProjection,
				targetEnv: targetEnv,
				dbOPSwitch: dbOPSwitch
		};
		getContentTypes(options3, (ctnTypes) => {
			contentTypes = ctnTypes;
			wait4DetailsEnd();
		});

		//get reversed contentType ID map
		options1.reversedListing = true;
		getContentTypesId(options1, (types)=>{
			ctnTypeIdReversed = types;
			wait4DetailsEnd();
		});
	});
}

var dataProcessing = () => {
	debugDev('Enter dataProcessing!');
	var xOrder = [];
	var yOrder = [];
	var typeDefCSV = 'Types or Vocabularies'; contentCSV = 'Contents or Vocabularies', mergedCSV = 'Types/Contents/Vocabularies'+','+'Source';
	var typeDefTable = {}, contentTable = {};
	// typeDefTable = {
	// 	City's id: {
	// 		voc1's id: 1,
	// 		voc2's id: 0,
	// 		.
	// 		.
	// 		.
	// 	},
	// 	City Details' id: {},
	// };
	
	var getContentTypeNameById = (id) => {
		return contentTypes[ctnTypeIdReversed[id]].type;
	}

	var getTaxonomyNameById = (id) => {
		return taxonomies[txVocIdReversed[id]].name;
	}

	// dataProcessing() starting point
	
	// arrange x & y data and order
	debugDev('...... arrange x & y data and order');
	var xData = {}, yData = {};
	if(tableDef.x === 'ContentType'){
		xData = ctnTypeIdReversed;
		yData = txVocIdReversed;
	} else if(tableDef.x === 'Taxonomy'){
		xData = txVocIdReversed;
		yData = ctnTypeIdReversed;
	}
	Object.keys(xData).forEach( (id) => {
		xOrder.push(id);
	});
	Object.keys(yData).forEach( (id) => {
		yOrder.push(id);
	});

	// investigate data
	debugDev('...... investigate data');
	var existed = 0, xOrderIndex = 0;
	var xLength = xOrder.length;
	var xId = '';
	yOrder.forEach( (yId) => {
		debugDev('............ yId = ' + yId);

		if(yId === '55a4b47c86c747af768b4567'){
			console.log('BP1.....');
		}

		typeDefTable[yId] = {};
		contentTable[yId] = {};
		xOrderIndex = 0
		do{
			existed = 0;
			xId = xOrder[xOrderIndex];
			debugDev('............------ xId = ' + xId);

			if(xId === '51a60be8c1c3dadc08000013'){
				console.log('BP2.....');
			}

			//for typeDefTable
			if(tableDef.x === 'ContentType'){
				if(!util.isNullOrUndefined(contentTypes[xData[xId]])){
					if(contentTypes[xData[xId]].vocabularies.length){
						if(contentTypes[xData[xId]].vocabularies.indexOf(yId) !== -1){
							existed = 1;
						}
					}
				}
			} else if(tableDef.x === 'Taxonomy'){
				if(!util.isNullOrUndefined(contentTypes[yData[yId]])){
					if(contentTypes[yData[yId]].vocabularies.length){
						if(contentTypes[yData[yId]].vocabularies.indexOf(xId) !== -1){
							existed = 1;
						}
					}
				}				
			}
			typeDefTable[yId][xId] = existed;

			//for contentTable
			existed = 0;
			if(tableDef.x === 'ContentType'){
				var ctns = contents[xData[xId]];//array
				var ctnsCount = ctns.length;
				ctns.forEach( (ctn) => {
					if(ctn.text === 'RT-Supplier'){
						console.log('BP3.....');
					}
					if(ctn.workspace.taxonomy[yId]){
						if(ctn.workspace.taxonomy[yId].length){
							existed++;
						}
					}					
				});
			} else if(tableDef.x === 'Taxonomy'){
				var ctns = contents[yData[yId]];//array
				var ctnsCount = ctns.length;
				ctns.forEach( (ctn) => {
					if(ctn.workspace.taxonomy[xId]){
						if(ctn.workspace.taxonomy[xId].length){
							existed++;
						}
					}					
				});
			}
			contentTable[yId][xId] = existed;

			xOrderIndex++;
		} while(xOrderIndex < xLength);		
	});
	fs.writeFileSync('./logs/typeDefTable-'+targetEnv+'.json', JSON.stringify(typeDefTable));

	//format csv header
	debugDev('...... format csv header');
	xOrder.forEach( (id) => {
		if(tableDef.x === 'ContentType'){
			typeDefCSV += ',' + getContentTypeNameById(id);
			contentCSV += ',' + getContentTypeNameById(id);
			mergedCSV += ',' + getContentTypeNameById(id);
		} else if(tableDef.x === 'Taxonomy'){
			typeDefCSV += ',' + getTaxonomyNameById(id);
			contentCSV += ',' + getTaxonomyNameById(id);
			mergedCSV += ',' + getTaxonomyNameById(id);
		}
	});
	typeDefCSV += '\n';
	contentCSV += '\n';
	mergedCSV += '\n';

	//format csv row
	debugDev('...... format csv row');
	yOrder.forEach( (yId) => {
		if(tableDef.x === 'ContentType'){
			typeDefCSV += getTaxonomyNameById(yId);
			contentCSV += getTaxonomyNameById(yId);
		} else if(tableDef.x === 'Taxonomy'){
			typeDefCSV += getContentTypeNameById(yId);
			contentCSV += getContentTypeNameById(yId);
		}
		xOrder.forEach( (xId) => {
			typeDefCSV += ',' + typeDefTable[yId][xId];
			contentCSV += ',' + contentTable[yId][xId];
		});
		typeDefCSV += '\n';
		contentCSV += '\n';
	});

	yOrder.forEach( (yId) => {
		if(tableDef.x === 'ContentType'){
			mergedCSV += getTaxonomyNameById(yId) + ',' + 'TypeDef';
		} else if(tableDef.x === 'Taxonomy'){
			mergedCSV += getContentTypeNameById(yId) + ',' + 'TypeDef';
		}
		xOrder.forEach( (xId) => {
			mergedCSV += ',' + typeDefTable[yId][xId];
		});
		mergedCSV += '\n';

		mergedCSV += '' + ',' + 'Content';
		xOrder.forEach( (xId) => {
			mergedCSV += ',' + contentTable[yId][xId];
		});
		mergedCSV += '\n';
	});

	fs.writeFileSync('./docs/txRelationship-ContentTypes-'+targetEnv+'.csv', typeDefCSV);
	fs.writeFileSync('./docs/txRelationship-Contents-'+targetEnv+'.csv', contentCSV);
	fs.writeFileSync('./docs/txRelationship-TypesContentsMerged-'+targetEnv+'.csv', mergedCSV);
	console.log('*** listTXRelationship.js Finished!! ***');	
}

//Starting point
dataPreparation();

