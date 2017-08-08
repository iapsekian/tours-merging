/*jshint esversion: 6 */
var fs = require('fs');
var debug = require('debug');


var TXMapping = require('./lib/getTXTermsMap.js');
options = {
	'txVocName': ['Tour Category','Tour Type','iso world region','City','Neighborhood','Country','State / Province'],
	// txVocName: [],
	txTermsFlag: false,
	//reversedListing: true,
	targetEnv: 'PRODUCTION',
	dbOPSwitch: ''
};
TXMapping(options, (txVocId,txTermsId)=>{
	fs.writeFileSync('./logs/txType-'+options.targetEnv+'.json', JSON.stringify(txVocId));
	fs.writeFileSync('./logs/txTerms-'+options.targetEnv+'.json', JSON.stringify(txTermsId));
	console.log('FINISHED!');
});


/*
var typeId = {}
var getContentTypesId = require('./lib/getContentTypeId.js');
options1 = {
	'ctnTypeName': ['Tours'],
	// 'ctnTypeName': [],
	'targetEnv': '',
	'dbOPSwitch': ''
};
getContentTypesId(options1, (a)=>{
	var typeId = a;
	console.log(JSON.stringify(typeId));

	// var getContents = require('./lib/getContents.js');
	// options2 = {
	// 	ctnTypeId: typeId,
	// 	projection: {'_id':1, 'text': 1, 'workspace':1},
	// 	// projection: {'_id':1, 'text': 1},
	// 	targetEnv: '',
	// 	dbOPSwitch: ''
	// };
	// getContents(options2, (a)=>{
	// 	fs.writeFileSync('./logs/contents-TEST.json', JSON.stringify(a));
	// });
});
*/
/*
var getTargetTourCategory = require('./lib/getTargetTourCategory.js');
console.log('Target Tour Category = ' + getTargetTourCategory("4-Day Tours"));
console.log('Target Tour Category = ' + getTargetTourCategory("Cooking Classes"));
console.log('Target Tour Category = ' + getTargetTourCategory("Luxury Tours"));

var getTargetTourType = require('./lib/getTargetTourType.js');
console.log('Target Tour Type = ' + getTargetTourType("Outdoor Activities"));
console.log('Target Tour Type = ' + getTargetTourType("Air, Helicopter & Balloon Tours"));
console.log('Target Tour Type = ' + getTargetTourType("Viator VIP & Exclusive Tours"));

var mapping = require('./lib/mapping-util.js');
console.log('Target Tour Category = ' + mapping.getTargetTourCategory("4-Day Tours"));
console.log('Target Tour Category = ' + mapping.getTargetTourCategory("Cooking Classes"));
console.log('Target Tour Category = ' + mapping.getTargetTourCategory("Luxury Tours"));
console.log('Target Tour Type = ' + mapping.getTargetTourType("Outdoor Activities"));
console.log('Target Tour Type = ' + mapping.getTargetTourType("Air, Helicopter & Balloon Tours"));
console.log('Target Tour Type = ' + mapping.getTargetTourType("Viator VIP & Exclusive Tours"));

var typeId = {}
var getContentTypesId = require('./lib/getContentTypeId.js');
options1 = {
	// 'ctnTypeName': ['Article','City','City Details'],
	'ctnTypeName': [],
	'targetEnv': '',
	'dbOPSwitch': ''
};
getContentTypesId(options1, (a)=>{
	var typeId = a;

	var getContentTypes = require('./lib/getContentTypes.js');
	options2 = {
		ctnTypeId: typeId,
		projection: {'_id':1, 'type': 1, 'vocabularies':1},
		// projection: {'_id':1, 'text': 1},
		targetEnv: '',
		dbOPSwitch: ''
	};
	getContentTypes(options2, (a)=>{
		fs.writeFileSync('./logs/contentTypeId-TEST.json', JSON.stringify(typeId));
		fs.writeFileSync('./logs/contentTypes-TEST.json', JSON.stringify(a));
		console.log('bye');
	});
});

typeId = {}
options1 = {
	// 'ctnTypeName': ['Article','City','City Details'],
	'ctnTypeName': [],
	'reversedListing': true, // undefined --> default: false
	'targetEnv': '',
	'dbOPSwitch': ''
};
getContentTypesId(options1, (a)=>{
	var typeId = a;
	fs.writeFileSync('./logs/contentTypeIdReversed-TEST.json', JSON.stringify(typeId));
	console.log('bye');
});


var getTaxonomies = require('./lib/getTaxonomies.js');
options = {
	txVocName: [],
	targetEnv: '',
	dbOPSwitch: ''
}
getTaxonomies(options, (txnm) => {
	fs.writeFileSync('./logs/txnm-TEST.json', JSON.stringify(txnm));
	console.log('BYE!');
});
*/

