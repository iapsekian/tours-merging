/*jshint esversion: 6 */

//
//

const fs = require('fs');
const debug = require('debug');
const debugDev = debug('dev');
const util = require('util');
const MongoClient = require('mongodb').MongoClient;
const ObjectID = require('mongodb').ObjectID;
const buUtil = require('./lib/bookurUtil.js')

let targetEnv = process.argv.slice(2)[0];
let dbOPSwitch = process.argv.slice(3)[0];

let productionEnv = false;
let testEnv = false;
let operateDB = false;
let mdbUrl

let dbParam = buUtil.getMDBParam(targetEnv, dbOPSwitch)
targetEnv = dbParam.targetEnv
operateDB = dbParam.operateDB
mdbUrl = dbParam.mdbUrl

//base configuration

var txVocName = ['Attraction'];
var ctnTypeName = ['Attraction Details'];

var txVocNameCount = txVocName.length;
var ctnTypeNameCount = ctnTypeName.length;
var ctnProjection = {'_id':1, 'text': 1, 'workspace':1};
var txVocId = {}, txTermsId = {}, ctnTypeId = {}, contents = {};
let missingLog = ''

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

	console.log('Entering dataPreparation().....')
	var dataReadyCount = 2;
	var wait4DataReady = () => {
		dataReadyCount--;
		if(!dataReadyCount){
			dataProcessing();
		}
	}

	let options = {
		'txVocName': txVocName,
		'targetEnv': targetEnv,
		'dbOPSwitch': dbOPSwitch
	};

	buUtil.getTxTermsMap(options, (vocs,terms)=>{
		txVocId = vocs;
		txTermsId = terms;
		wait4DataReady();
	});

	let options1 = {
		'ctnTypeName': ctnTypeName,
		'targetEnv': targetEnv,
		'dbOPSwitch': dbOPSwitch
	};

	buUtil.getContentTypesId(options1, (types)=>{
		ctnTypeId = types;

		let options2 = {
			ctnTypeId: ctnTypeId,
			projection: ctnProjection,
			targetEnv: targetEnv,
			dbOPSwitch: dbOPSwitch
		};
		buUtil.getContents(options2, (ctns)=>{
			contents = ctns;
			wait4DataReady();
		});
	});
}

var dataProcessing = async () => {
	console.log('Entering dataProcessing().....')
	let ctns = contents['AttractionDetails']
	let vocId = txVocId.Attraction
	let termsId = txTermsId.Attraction

	let count = ctns.length
	let i = 0
	while(i < count){
	// ctns.forEach( attDetails => {
		let attDetails = ctns[i]
		let text = attDetails.text
		if(termsId[text]){
			attDetails.workspace.taxonomy[vocId] = []
			attDetails.workspace.taxonomy[vocId].push(termsId[text])

			attDetails.live = attDetails.workspace

			let res
			let filter = {_id: attDetails._id}
			let options = {}
			try{
				res = await buUtil.updateSingleContent(mdbUrl, filter, attDetails, options)
			} catch(err){
				console.log('Update content - %s - Error! err = %s', attDetails.text, err)
			}
			console.log('Update content - %s succeeded!', attDetails.text)

		} else{
			missingLog += 'Att Details name = ' + text +', now taxonomy terms mapping!\n'
		}
	// })
		
		i++
	}

	fs.writeFileSync('./logs/updateAttDetailsTXAttraction-TXMissing.log', missingLog);
	console.log('****** DONE ******')
}

//Starting point
dataPreparation();

