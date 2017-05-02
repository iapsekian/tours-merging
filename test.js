/*jshint esversion: 6 */
var fs = require('fs');
var debug = require('debug');

var TXMapping = require('./lib/getTXTermsMap.js');
options = {
	'txVocName': ['City','Tour Destination'],
	// 'txVocName': [],
	'targetEnv': '',
	'dbOPSwitch': ''
};
TXMapping(options, (a,b)=>{
	//console.log('a = ' + JSON.stringify(a));
	//console.log('b = ' + JSON.stringify(b));
	console.log('FINISHED!');
});

var typeId = {}
var getContentTypesId = require('./lib/getContentTypeId.js');
options1 = {
	'ctnTypeName': ['City','City Details'],
	// 'ctnTypeName': [],
	'targetEnv': '',
	'dbOPSwitch': ''
};
getContentTypesId(options1, (a)=>{
	var typeId = a;

	var getContents = require('./lib/getContents.js');
	options2 = {
		ctnTypeId: typeId,
		projection: {'_id':1, 'text': 1, 'workspace':1, 'live':1},
		// projection: {'_id':1, 'text': 1},
		targetEnv: '',
		dbOPSwitch: ''
	};
	getContents(options2, (a)=>{
		console.log('bye');
	});
});

