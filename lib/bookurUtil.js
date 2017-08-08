/*jshint esversion: 6 */

// 

"use strict"

const fs = require('fs');
const debug = require('debug');
const debugDev = debug('dev');	
const util = require('util');
const MongoClient = require('mongodb').MongoClient;
const ObjectID = require('mongodb').ObjectID;
const childProcess = require('child_process')



const mongoDBUrl = {
	'PRODUCTION': 'mongodb://52.39.111.227:27017/tourbooks',
	'TEST': 'mongodb://tst.tourbooks.cc:27017/tourbooks',
	'TEST2': 'mongodb://tst2.tourbooks.cc:27017/tourbooks'
}

const masterDetailMapping = {
	'57ed26a06d0e810b357b23c7': '587dbe0c6d0e813d6c53b662', //City: City Details
	'57ea19736d0e81454c7b23d2': '587dbef16d0e81d36d53b660'	//Attraction: Attraction Details
}

let getMongoDBUrl = (targetEnv, dbOPSwitch, callback) => {

	let productionEnv = false;
	let testEnv = false;
	let test2Env = false;
	let operateDB = false;

	if('PRODUCTION' === targetEnv){
		productionEnv = true;
		if('OPDB' === dbOPSwitch){
			operateDB = true;
		}
	} else if('TEST' === targetEnv){
		testEnv = true;
		if('OPDB' === dbOPSwitch){
			operateDB = true;
		}
	} else if('TEST2' === targetEnv){
		test2Env = true;
		if('OPDB' === dbOPSwitch){
			operateDB = true;
		}
	} else if('OPDB' === targetEnv){
		targetEnv = 'TEST';
		testEnv = true;
		operateDB = true;
	} else {
		targetEnv = 'TEST';
		testEnv = true;	
	}

	callback(targetEnv, operateDB, mongoDBUrl[targetEnv]);
}

let getMongoDBUrlObj = (targetEnv, dbOPSwitch) => {	//equal to getMDBParam

	let productionEnv = false;
	let testEnv = false;
	let test2Env = false;
	let operateDB = false;

	if('PRODUCTION' === targetEnv){
		productionEnv = true;
		if('OPDB' === dbOPSwitch){
			operateDB = true;
		}
	} else if('TEST' === targetEnv){
		testEnv = true;
		if('OPDB' === dbOPSwitch){
			operateDB = true;
		}
	} else if('TEST2' === targetEnv){
		test2Env = true;
		if('OPDB' === dbOPSwitch){
			operateDB = true;
		}
	} else if('OPDB' === targetEnv){
		targetEnv = 'TEST';
		testEnv = true;
		operateDB = true;
	} else {
		targetEnv = 'TEST';
		testEnv = true;	
	}

	return {targetEnv: targetEnv, operateDB: operateDB, mUrl: mongoDBUrl[targetEnv]}
}

let cleanArray = (orig, callback) => {
	let newArray = new Array();
	let updFlag = false;
	for (let i = 0; i < orig.length; i++) {
		if(orig[i]){
			newArray.push(orig[i]);
		} else {
			updFlag = true;
		}
	}
	callback(updFlag ,newArray);
}

let getTxTermsMap = (options, callback) => {

	// options = {
	// 	txVocName: [],
	// 	txTermsFlag: boolean, //undefined --> default: true
	// 	reversedListing: boolean, // undefined --> default: false
	// 	targetEnv: '',
	// 	dbOPSwitch: ''
	// }


	let txVocName = options.txVocName.slice(); //clone array
	if(util.isNullOrUndefined(options.txTermsFlag))	options.txTermsFlag = true;
	let txTermsFlag = options.txTermsFlag;
	if(util.isNullOrUndefined(options.reversedListing))	options.reversedListing = false;
	let reversedListing = options.reversedListing;
	let targetEnv = options.targetEnv;
	let dbOPSwitch = options.dbOPSwitch;

	let operateDB = false;
	let mdbUrl = '';
	getMongoDBUrl(targetEnv, dbOPSwitch, (env, op, mUrl) => {
		targetEnv = env;
		operateDB = op;
		mdbUrl = mUrl;

		let txVocNameCount = txVocName.length;
		let txVocId = {}, txTermsId = {};
			// txVocId = {
			// 	"isoworldregion": "57b18d746d0e81e174c66324",
			// 	"City": "589c085b6d0e819e13623adc",
			// 	"Country": "58a416076d0e81a9466a306b",
			// 	"State/Province": "58a416516d0e81e1476a3066"			
			// }
			// txTermsId = {
			// 		"TourDestination": {
			// 			"Paris": "xxxxxxxxxxx",
			// 			"London": "xxxxxxxxxxx"
			// 		},
			// 		"TourCategory": {}
			// }


		MongoClient.connect(mdbUrl, (err, db) => {

			let cltTX = db.collection('Taxonomy');
			let cltTXTerms = db.collection('TaxonomyTerms');

			let preparingData = () => {

				// get taxonomy vovaculary and id mapping
				let getTXVocId = ()=>{
					let count = txVocNameCount;
					let wait4txVocIdEnd = ()=>{
						count--;
						if(!count){
							if(reversedListing){
								fs.writeFileSync('./log/txVocIdReversed-' + targetEnv + '.json', JSON.stringify(txVocId));
							} else {
								fs.writeFileSync('./log/txVocId-' + targetEnv + '.json', JSON.stringify(txVocId));							
							}
							if(txTermsFlag){
								getTXTerms();
							} else {
								endProgram();
							}
						}
					};

					if(txVocNameCount !== 0){ //assign specific vocabularies
						txVocName.forEach((vocName)=>{
							let qry = {'name': vocName};
							let prj = {'_id':1, 'name': 1};
							cltTX.find(qry).project(prj).toArray()
								.then( (d)=>{
									d.forEach( (item)=>{
										if(reversedListing){
											txVocId[item._id.toString()] = item.name.replace(/\s+/g,'');
										} else {
											txVocId[item.name.replace(/\s+/g,'')] = item._id.toString();
										}
									});
									wait4txVocIdEnd();
								})
								.catch( (e)=>{
									console.log('Finding taxonomy vocabulary ID error! - ' + e);
								});
						});
					} else if(txVocNameCount === 0){ //list all vocabularies
						let qry = {};
						let prj = {'_id':1, 'name': 1};
						cltTX.find(qry).project(prj).toArray()
							.then( (d)=>{
								d.forEach( (item)=>{
									let key = item.name.replace(/\s+/g,'');
									let value = item._id.toString();
									if(reversedListing){
										txVocId[value] = key;
									} else {
										txVocId[key] = value;
									}
									if(txTermsFlag)
										txVocName.push(key);
								});
								
								txVocNameCount = txVocName.length;
								count = 1;
								wait4txVocIdEnd();
							})
							.catch( (e)=>{
								console.log('Finding taxonomy vocabulary ID error! - ' + e);
							});					
					}
				}

				// get taxonomy terms based on txVocId
				// called at the end of getTXVocId
				let getTXTerms = ()=>{
					let count = txVocNameCount;
					let wait4AllVocEnd = ()=>{
						count--;
						if(!count){
							if(reversedListing){
								fs.writeFileSync('./log/txTermsIdReversed-' + targetEnv + '.json', JSON.stringify(txTermsId));
							} else {
								fs.writeFileSync('./log/txTermsId-' + targetEnv + '.json', JSON.stringify(txTermsId));							
							}
							endProgram();
						}
					};

					txVocName.forEach((vocName)=>{
						let key = vocName.replace(/\s+/g,'');
						let qry = {};
						if(reversedListing){
							let tmpTxVocId = Object.keys(txVocId);
							tmpTxVocId.forEach( (tmpKey) => {
								if(key === txVocId[tmpKey]){
									key = tmpKey;
									qry = {'vocabularyId': tmpKey};
								}
							});
						} else {
							qry = {'vocabularyId': txVocId[key]};
						}
						let prj = {'_id':1, 'text': 1};

						cltTXTerms.find(qry).project(prj).toArray()
							.then( (d)=>{
								let terms = {};
								d.forEach( (term)=>{
									if(reversedListing){
										terms[term._id.toString()] = term.text;
									} else {
										terms[term.text] = term._id.toString();
									}
								});
								txTermsId[key] = terms;
								wait4AllVocEnd();
							})
							.catch( (e)=>{
								console.log('Finding taxonomy terms ID error! - ' + e);
							});
					});
				}

				// preparingData starting point
				getTXVocId();
			};

			let endProgram = ()=>{
				db.close();
				// debugDev('*** Finished!! ***');
				callback(txVocId,txTermsId);
			}

			// Starting point
			preparingData();
		})
	})
}

let getContentTypesId = (options, callback) => {

	// options = {
	// 	ctnTypeName: [],
	// 	reversedListing: boolean, // undefined --> default: false
	// 	targetEnv: '',
	// 	dbOPSwitch: ''
	// }
	
	let ctnTypeName = options.ctnTypeName;
	if(util.isNullOrUndefined(options.reversedListing))	options.reversedListing = false;
	let reversedListing = options.reversedListing;
	let targetEnv = options.targetEnv;
	let dbOPSwitch = options.dbOPSwitch;

	let operateDB = false;
	let mdbUrl = '';
	getMongoDBUrl(targetEnv, dbOPSwitch, (env, op, mUrl) => {
		targetEnv = env;
		operateDB = op;
		mdbUrl = mUrl;
	})

	let ctnTypeNameCount = ctnTypeName.length;
	let ctnTypeId = {};
		// ctnTypeId = {
		// 	"Paris": "xxxxxxxxxxx",
		// 	"London": "xxxxxxxxxxx"
		// }

	MongoClient.connect(mdbUrl, (err, db) => {

		let cltCtnTypes = db.collection('ContentTypes');

		let preparingData = () => {

			// get taxonomy vovaculary and id mapping
			let getCtnTypeId = ()=>{
				let count = ctnTypeNameCount;
				let wait4CtnTypeIdEnd = ()=>{
					count--;
					if(!count){
						if(reversedListing){
							fs.writeFileSync('./log/ctnTypeIdReversed-' + targetEnv + '.json', JSON.stringify(ctnTypeId));
						} else {
							fs.writeFileSync('./log/ctnTypeId-' + targetEnv + '.json', JSON.stringify(ctnTypeId));							
						}
						endProgram();
					}
				};

				if(ctnTypeNameCount !== 0){
					ctnTypeName.forEach((name)=>{
						let qry = {'type': name};
						let prj = {'_id':1, 'type': 1};
						cltCtnTypes.find(qry).project(prj).toArray()
							.then( (d)=>{
								d.forEach( (item)=>{
									if(reversedListing){
										ctnTypeId[item._id.toString()] = item.type.replace(/\s+/g,'');
									} else {
										ctnTypeId[item.type.replace(/\s+/g,'')] = item._id.toString();
									}
								});
								wait4CtnTypeIdEnd();
							})
							.catch( (e)=>{
								console.log('Finding content type ID error! - ' + e);
							});
					});
				} else if (ctnTypeNameCount === 0){
					let qry = {};
					let prj = {'_id':1, 'type': 1};
					cltCtnTypes.find(qry).project(prj).toArray()
						.then( (d)=>{
							count = 1;
							d.forEach( (item)=>{
								if(reversedListing){
									ctnTypeId[item._id.toString()] = item.type.replace(/\s+/g,'');
								} else {
									ctnTypeId[item.type.replace(/\s+/g,'')] = item._id.toString();
								}
							});
							wait4CtnTypeIdEnd();
						})
						.catch( (e)=>{
							console.log('Finding content type ID error! - ' + e);
						});
				}
			}

			// preparingData starting point
			getCtnTypeId();
		};

		let endProgram = ()=>{
			db.close();
			callback(ctnTypeId);
		}

		// Starting point
		preparingData();
	})
}

let getContents = (options, callback) => {
	// options = {
	// 	ctnTypeId: {},
	// 	qryFilter: {}
	// 	projection:{},
	// 	targetEnv: '',
	// 	dbOPSwitch: ''
	// }

	let ctnTypeId = options.ctnTypeId;
	let ctnTypeName = Object.keys(ctnTypeId);
	let targetEnv = options.targetEnv;
	let dbOPSwitch = options.dbOPSwitch;
	let qryFilter=	options.qryFilter;

	let operateDB = false;
	let mdbUrl = '';
	getMongoDBUrl(targetEnv, dbOPSwitch, (env, op, mUrl) => {
		targetEnv = env;
		operateDB = op;
		mdbUrl = mUrl;
	})

	let ctnTypeNameCount = ctnTypeName.length;
	let contents = {};
		// contents = {
		// 	"type1": [
		// 				{record1},
		// 				{record2}
		// 			],
		// 	"type2": [
		// 				{record1},
		// 				{record2}
		// 			]
		// }

	MongoClient.connect(mdbUrl, (err, db) => {

		let cltContents = db.collection('Contents');

		let preparingData = () => {

			let count = ctnTypeNameCount;
			let wait4GetContentsEnd = ()=>{
				count--;
				if(!count){
					// fs.writeFileSync('./log/contents-' + targetEnv + '.json', JSON.stringify(contents));
					endProgram();
				}
			};

			if(ctnTypeNameCount !== 0){
				ctnTypeName.forEach((name)=>{
					let qry = {'typeId': ctnTypeId[name]};
					if(qryFilter)
						Object.assign(qry,qryFilter);
					let prj = options.projection;
					cltContents.find(qry).project(prj).toArray()
						.then( (d)=>{
							contents[name] = d;
							wait4GetContentsEnd();
						})
						.catch( (e)=>{
							console.log('Finding contents error! - ' + e);
						});
				});
			} else if (ctnTypeNameCount === 0){
				let qry = {};
				if(qryFilter)
					qry = qryFilter;
				let prj = options.projection;
				cltContents.find(qry).project(prj).toArray()
					.then( (d)=>{
						contents = d;
						count = 1;
						wait4GetContentsEnd();
					})
					.catch( (e)=>{
						console.log('Finding contents error! - ' + e);
					});
			}
		};

		let endProgram = ()=>{
			db.close();
			callback(contents);
		}

		// Starting point
		preparingData();
	});
}

let getCtnTypesDef = (options, callback) => {

	// options = {
	// 	ctnTypeId: {}, //from getContentTypeId.js (not reversedListing)
	// 	projection:{},
	// 	targetEnv: '',
	// 	dbOPSwitch: ''
	// }

	let ctnTypeId = options.ctnTypeId;
	let ctnTypeName = Object.keys(ctnTypeId);
	let targetEnv = options.targetEnv;
	let dbOPSwitch = options.dbOPSwitch;

	let operateDB = false;
	let mdbUrl = '';
	getMongoDBUrl(targetEnv, dbOPSwitch, (env, op, mUrl) => {
		targetEnv = env;
		operateDB = op;
		mdbUrl = mUrl;
	})

	let ctnTypeNameCount = ctnTypeName.length;
	let contentTypes = {};
		// contentTypes = {
		// 	"type1": {record1},
		// 	"type2": {record}
		// }

	MongoClient.connect(mdbUrl, (err, db) => {

		let cltContentTypes = db.collection('ContentTypes');

		let preparingData = () => {

			let count = ctnTypeNameCount;
			let wait4GetContentsEnd = ()=>{
				count--;
				if(!count){
					fs.writeFileSync('./log/ctnTypesDef-' + targetEnv + '.json', JSON.stringify(contentTypes));
					endProgram();
				}
			};

			if(ctnTypeNameCount !== 0){
				ctnTypeName.forEach((name)=>{
					let qry = {'_id': ObjectID.createFromHexString(ctnTypeId[name])};
					let prj = options.projection;
					cltContentTypes.find(qry).project(prj).toArray()
						.then( (d)=>{
							d.forEach( (item) => {
								contentTypes[name] = item;
							});
							
							wait4GetContentsEnd();
						})
						.catch( (e)=>{
							console.log('Finding contentTypes error! - ' + e);
						});
				});
			} else if (ctnTypeNameCount === 0){
				let qry = {};
				let prj = options.projection;
				cltContentTypes.find(qry).project(prj).toArray()
					.then( (d)=>{
						d.forEach( (item) => {
							contentTypes = item;
						});
						
						count = 1;
						wait4GetContentsEnd();
					})
					.catch( (e)=>{
						console.log('Finding contentTypes error! - ' + e);
					});
			}
		};

		let endProgram = ()=>{
			db.close();
			callback(contentTypes);
		}

		// Starting point
		preparingData();
	});
}

let getTxVocsDef = (options, callback) => {

	// options = {
	// 	txVocName: [],
	// 	targetEnv: '',
	// 	dbOPSwitch: ''
	// }

	let txVocName = options.txVocName.slice(); //clone array
	let targetEnv = options.targetEnv;
	let dbOPSwitch = options.dbOPSwitch;

	let operateDB = false;
	let mdbUrl = '';
	getMongoDBUrl(targetEnv, dbOPSwitch, (env, op, mUrl) => {
		targetEnv = env;
		operateDB = op;
		mdbUrl = mUrl;

		let txVocNameCount = txVocName.length;
		let taxonomies = {};
			// txTermsId = {
			// 		"TourDestination": {
			// 			"Paris": "xxxxxxxxxxx",
			// 			"London": "xxxxxxxxxxx"
			// 		},
			// 		"TourCategory": {}
			// }

		MongoClient.connect(mdbUrl, (err, db) => {

			let cltTX = db.collection('Taxonomy');

			let endProgram = ()=>{
				db.close();
				callback(taxonomies);
			}

			let count = txVocNameCount;
			let wait4TaxonomiesEnd = ()=>{
				count--;
				if(!count){
					fs.writeFileSync('./log/txVocsDef-' + targetEnv + '.json', JSON.stringify(taxonomies));
					endProgram();
				}
			};

			if(txVocNameCount !== 0){ //assign specific vocabularies
				txVocName.forEach((vocName)=>{
					let qry = {'name': vocName};
					let prj = {'_id':1, 'name': 1, 'inputAsTree':1, 'multiSelect':1, 'mandatory':1};
					cltTX.find(qry).project(prj).toArray()
						.then( (d)=>{
							d.forEach( (item)=>{
								let key = item.name.replace(/\s+/g,'');
								taxonomies[key] = item;
							});
							wait4TaxonomiesEnd();
						})
						.catch( (e)=>{
							console.log('Finding taxonomies error! - ' + e);
						});
				});
			} else if(txVocNameCount === 0){ //list all vocabularies
				let qry = {};
				let prj = {'_id':1, 'name': 1, 'inputAsTree':1, 'multiSelect':1, 'mandatory':1};
				cltTX.find(qry).project(prj).toArray()
					.then( (d)=>{
						d.forEach( (item)=>{
							let key = item.name.replace(/\s+/g,'');
							taxonomies[key] = item;
						});

						count = 1;
						wait4TaxonomiesEnd();
					})
					.catch( (e)=>{
						console.log('Finding taxonomies error! - ' + e);
					});					
			}
		})
	})
}

let runScript = (scriptPath, args, options, callback) => {
	// args and options are demostrated as below
		// let args = []
		// let options = {}

		// options.execArgv = execArgv.slice()
		// args.push(targetEnv)
		// args.push(dbOPSwitch)
		// 


	// keep track of whether callback has been invoked to prevent multiple invocations
    let invoked = false;

    let process = childProcess.fork(scriptPath, args, options);

    // listen for errors as they may prevent the exit event from firing
    process.on('error', function (err) {
        if (invoked) return;
        invoked = true;
        callback(err);
    });

    // execute the callback once the process has finished running
    process.on('exit', function (code) {
        if (invoked) return;
        invoked = true;
        var err = code === 0 ? null : new Error('exit code ' + code);
        callback(err);
    });
}

let getSingleTxTermsId = (options, callback) => {

	// options = {
	// 	txVocName: '',
	// 	txTermName: '',
	// 	targetEnv: '',
	// 	dbOPSwitch: ''
	// }
	// 
	// callback(err,txTermsId)

	if(!options.txVocName){
		callback('Error! TX Vocabulary Name is necessary!', '')
		return
	}

	if(!options.txTermName){
		callback('Error! TX Term Name is necessary!','')
		return
	}

	let txVocName = options.txVocName; //clone array
	let txTermName = options.txTermName;
	let targetEnv = options.targetEnv;
	let dbOPSwitch = options.dbOPSwitch;

	let operateDB = false;
	let mdbUrl = '';
	getMongoDBUrl(targetEnv, dbOPSwitch, (env, op, mUrl) => {
		targetEnv = env;
		operateDB = op;
		mdbUrl = mUrl;

		let txVocId = '', txTermsId = '';

		MongoClient.connect(mdbUrl, (err, db) => {

			let cltTX = db.collection('Taxonomy');
			let cltTXTerms = db.collection('TaxonomyTerms');

			let qry = {'name': txVocName};
			let prj = {'_id':1, 'name': 1};
			cltTX.find(qry).project(prj).toArray()
				.then( (d)=>{
					d.forEach( (item)=>{
						txVocId = item._id.toString();
					});

					let qry = {'vocabularyId': txVocId, 'text': txTermName};
					let prj = {'_id':1, 'text': 1};

					cltTXTerms.find(qry).project(prj).toArray()
						.then( (d)=>{
							let terms = {};
							d.forEach( (term)=>{
								txTermsId = term._id.toString();
							})

							db.close()
							callback('',txTermsId)
						})
						.catch( (e)=>{
							console.log('Finding taxonomy terms ID error! - ' + e);
						});
				})
				.catch( (e)=>{
					console.log('Finding taxonomy vocabulary ID error! - ' + e);
				});

		})
	})
}

let getSingleTxTermText = (options) => {

	// options = {
	// 	txTermId: '',
	// 	targetEnv: '',
	// 	dbOPSwitch: ''
	// }
	// 
	// return txTermName

	if(!options.txTermId){
		console.log('Error! TX Term Id is necessary!')
		return null
	}

	let txTermId = options.txTermId;
	let targetEnv = options.targetEnv;
	let dbOPSwitch = options.dbOPSwitch;

	let operateDB = false;
	let mdbUrl = '';

	let mdbObj = getMongoDBUrlObj(targetEnv, dbOPSwitch)
	targetEnv = mdbObj.targetEnv
	operateDB = mdbObj.operateDB
	mdbUrl = mdbObj.mUrl

	async function getDB(){
		return await MongoClient.connect(mdbUrl)
	}

	async function getResult(db,qry,prj){
		let cltTXTerms = db.collection('TaxonomyTerms')
		return await cltTXTerms.findOne(qry, {fields: prj})
	}

	let db = getDB().then(db=>{return db})
	let qry = {'_id': ObjectID.createFromHexString(txTermId)};
	let prj = {'_id':0, 'text': 1};
	let d = getResult(db,qry, prj)
	let txTermName = ''
	if(d){
		txTermName = d.text
	}
	db.close()
	return txTermName

	// MongoClient.connect(mdbUrl)
	// .then( db => {
	// 	let cltTXTerms = db.collection('TaxonomyTerms');

	// 	let qry = {'_id': ObjectID.createFromHexString(txTermId)};
	// 	let prj = {'_id':0, 'text': 1};
	// 	cltTXTerms.findOne(qry, {fields: prj})
	// 	.then( (d)=>{
	// 		let txTermName = ''
	// 		if(d){
	// 			txTermName = d.text
	// 		}
	// 		db.close()
	// 		return txTermName
	// 	})
	// 	.catch( (e)=>{
	// 		console.log('Finding taxonomy terms Name error! - ' + e);
	// 		return null
	// 	})		
	// })
	// .catch( err => {
	// 	console.log('Connect to MongoDB Error - ' + e)
	// 	return null		
	// })

	// getMongoDBUrl(targetEnv, dbOPSwitch, (env, op, mUrl) => {
	// 	targetEnv = env;
	// 	operateDB = op;
	// 	mdbUrl = mUrl;

	// 	MongoClient.connect(mdbUrl, (err, db) => {

	// 		let cltTXTerms = db.collection('TaxonomyTerms');

	// 		let qry = {'_id': ObjectID.createFromHexString(txTermId)};
	// 		let prj = {'_id':0, 'text': 1};
	// 		cltTXTerms.findOne(qry, {fields: prj})
	// 		.then( (d)=>{
	// 			let txTermName = ''
	// 			if(d){
	// 				txTermName = d.text
	// 			}
	// 			db.close()
	// 			return txTermName
	// 		})
	// 		.catch( (e)=>{
	// 			console.log('Finding taxonomy terms Name error! - ' + e);
	// 			return null
	// 		})
	// 	})
	// })
}

let getSingleTxVocName = (options) => {

	// options = {
	// 	txVocId '',
	// 	targetEnv: '',
	// 	dbOPSwitch: ''
	// }
	// 
	// return txVocName

	if(!options.txVocId){
		console.log('Error! TX Vocabulary Id is necessary!')
		return null
	}

	let txVocId = options.txVocId; //clone array
	let targetEnv = options.targetEnv;
	let dbOPSwitch = options.dbOPSwitch;

	let operateDB = false;
	let mdbUrl = '';

	let mdbObj = getMongoDBUrlObj(targetEnv, dbOPSwitch)
	targetEnv = mdbObj.targetEnv
	operateDB = mdbObj.operateDB
	mdbUrl = mdbObj.mUrl

	MongoClient.connect(mdbUrl)
	.then( db => {
		let cltTX = db.collection('Taxonomy');

		let qry = {'_id': ObjectID.createFromHexString(txVocId)};
		let prj = {'_id':0, 'name': 1};
		cltTX.findOne(qry, {fields: prj})
		.then( (d)=>{
			let txVocName = ''
			if(d){
				txVocName = d.name
			}
			db.close()
			return txVocName
		})
		.catch( (e)=>{
			console.log('Finding taxonomy vocabulary Name error! - ' + e);
			return null
		})
	})
	.catch( err => {
		console.log('Connect to MongoDB Error - ' + e)
		return null
	})

	// getMongoDBUrl(targetEnv, dbOPSwitch, (env, op, mUrl) => {
	// 	targetEnv = env;
	// 	operateDB = op;
	// 	mdbUrl = mUrl;

		// MongoClient.connect(mdbUrl, (err, db) => {

		// 	let cltTX = db.collection('Taxonomy');

		// 	let qry = {'_id': ObjectID.createFromHexString(txVocId)};
		// 	let prj = {'_id':0, 'name': 1};
		// 	cltTX.findOne(qry, {fields: prj})
		// 	.then( (d)=>{
		// 		let txVocName = ''
		// 		if(d){
		// 			txVocName = d.name
		// 		}
		// 		db.close()
		// 		return txVocName
		// 	})
		// 	.catch( (e)=>{
		// 		console.log('Finding taxonomy vocabulary Name error! - ' + e);
		// 		return null
		// 	})
		// })
	// })
}

let getSingleDataById = async (mdbUrl, collection, id, fields) => {
	if(!mdbUrl){
		console.log('DB URL is requried!')
		return
	}
	if(!collection){
		console.log('collection name is requried!')
		return
	}
	if(!id){
		console.log('DB _id is requried!')
		return
	}

	let db
	try{
		db = await MongoClient.connect(mdbUrl)
	} catch(err){
		console.log('Connect to DB - %s Error!!', mdbUrl)
		throw err
	}

	let clt = db.collection(collection)
	let doc = ''
	let opts = {}
	if(fields)
		opts = {fields: fields}
	let qry = {_id: ObjectID.createFromHexString(id)}
	try{
		doc = await clt.findOne(qry,opts)
	} catch(err){
		console.log('Find data: id - %s error on collection %s of DB - %s, Error = %s', id, collection, mdbUrl, err )
		throw err
		return doc
	} finally{
		db.close()
	}
	
	return doc
}

let getSingleContentById = async (mdbUrl, id, fields) => {
	if(!mdbUrl){
		console.log('DB URL is requried!')
		return
	}
	if(!id){
		console.log('DB _id is requried!')
		return
	}

	let db
	try{
		db = await MongoClient.connect(mdbUrl)
	} catch(err){
		console.log('Connect to DB - %s Error!!', mdbUrl)
		throw err
	}

	let clt = db.collection('Contents')
	let doc = ''
	let opts = {}
	if(fields)
		opts = {fields: fields}
	let qry = {_id: ObjectID.createFromHexString(id)}
	try{
		doc = await clt.findOne(qry,opts)
	} catch(err){
		console.log('Find data: id - %s error on collection "Contents" of DB - %s, Error = %s', id, mdbUrl, err )
		throw err
		return doc
	} finally{
		db.close()
	}
	
	return doc
}

let getSingleContentDetailsByMasterId = async (mdbUrl, id, fields) => {
	if(!mdbUrl){
		console.log('DB URL is requried!')
		return
	}
	if(!id){
		console.log('DB _id is requried!')
		return
	}

	let db
	try{
		db = await MongoClient.connect(mdbUrl)
	} catch(err){
		console.log('Connect to DB - %s Error!!', mdbUrl)
		throw err
	}

	let clt = db.collection('Contents')
	let doc = ''
	let opts = {fields: {_id:1, text:1, typeId: 1}}
	let qry = {_id: ObjectID.createFromHexString(id)}
	try{
		doc = await clt.findOne(qry,opts)
	} catch(err){
		console.log('Find data: id - %s error on collection "Contents" of DB - %s, Error = %s', id, mdbUrl, err )
		throw err
		return doc
	}

	if(!masterDetailMapping[doc.typeId]){
		console.log('There is no master/details structure in DB!! Return undefined')
		return undefined
	}

	let docDetails = ''
	opts = {}
	if(fields)
		opts = {fields: fields}
	qry = {typeId: masterDetailMapping[doc.typeId], text: doc.text}
	try{
		docDetails = await clt.findOne(qry,opts)
	} catch(err){
		console.log('Find data details for id - %s error on collection "Contents" of DB - %s, Error = %s', id, mdbUrl, err )
		throw err
		return docDetails
	} finally{
		db.close()
	}
	
	return docDetails
}

let getMDBParam = (targetEnv, dbOPSwitch) => {

	let productionEnv = false;
	let testEnv = false;
	let test2Env = false;
	let operateDB = false;

	if('PRODUCTION' === targetEnv){
		productionEnv = true;
		if('OPDB' === dbOPSwitch){
			operateDB = true;
		}
	} else if('TEST' === targetEnv){
		testEnv = true;
		if('OPDB' === dbOPSwitch){
			operateDB = true;
		}
	} else if('TEST2' === targetEnv){
		test2Env = true;
		if('OPDB' === dbOPSwitch){
			operateDB = true;
		}
	} else if('OPDB' === targetEnv){
		targetEnv = 'TEST';
		testEnv = true;
		operateDB = true;
	} else {
		targetEnv = 'TEST';
		testEnv = true;	
	}

	return {targetEnv: targetEnv, operateDB: operateDB, mdbUrl: mongoDBUrl[targetEnv]}
}

let updateSingleContent = async (mdbUrl, filter, doc, options) => {
	if(!mdbUrl){
		console.log('DB URL is requried!')
		return
	}
	if(!filter){
		console.log('filter is requried!')
		return
	}
	if(!doc){
		console.log('updating data is requried!')
		return
	}

	if(!options){
		options = {}
	}

	let db
	try{
		db = await MongoClient.connect(mdbUrl)
	} catch(err){
		console.log('Connect to DB - %s Error!!', mdbUrl)
		throw err
	}

	let clt = db.collection('Contents')
	let res = ''
	try{
		res = await clt.updateOne(filter, doc, options)
	} catch(err){
		console.log('Update data: text - %s error on collection "Contents" of DB - %s, Error = %s', doc.text, mdbUrl, err )
		throw err
		return res
	} finally{
		db.close()
	}
	
	return res

}


module.exports = {
	getMongoDBUrl: getMongoDBUrl,
	getMongoDBUrlObj:getMongoDBUrlObj,
	cleanArray: cleanArray,
	getTxTermsMap: getTxTermsMap,
	getSingleTxTermsId: getSingleTxTermsId,
	getTxVocsDef: getTxVocsDef,
	getContentTypesId: getContentTypesId,
	getCtnTypesDef: getCtnTypesDef,
	getContents: getContents,
	getSingleTxTermText: getSingleTxTermText,
	getSingleTxVocName: getSingleTxVocName,
	runScript: runScript,
	getMDBParam:getMDBParam,
	getSingleDataById: getSingleDataById,
	getSingleContentById: getSingleContentById,
	getSingleContentDetailsByMasterId: getSingleContentDetailsByMasterId,
	updateSingleContent: updateSingleContent
};
