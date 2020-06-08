/*
 *
 * General conceptual structure
 * Read CLI arg for --config to a path
 * Replace all args from --whatever from CLI args
 * For all mandated args that aren't filled from these two methods, prompt manually
 *
 *
 * */

require('dotenv').config();
//const esxi = require('./ssh');
const fs = require('fs');
const prompt = require('prompt');
const yargs = require('yargs');
const options ={
	'PACKAGE':{
		alias:['package','n','p','name'],
		describe:'Name of package for which to create a Cloudpaging Studio VM.',
	},
	'HOST':{
		alias:['host','h'],
		describe:'ESXI host address on which to create this VM.',
	},
	'SSH_USER':{
		alias:['username','u','user'],
		describe:'Username used to connect to the ESXI host.',
	},
	'STORE_PATH':{
		alias:['store','s'],
		describe:'Path on ESXI host of datastore on which to create this VM.',
	},
	'IMAGE_PATH':{
		alias:['image','i'],
		describe:'Path on ESXI host of the base image to be cloned to create this VM.',
	},
	'CONFIG':{
		alias:['config','c'],
		describe:'Path to a config.json file that can help fill in some of the options here for easy use.',
		ignorable:true
	}
}
Object.entries(options).forEach(([k,v])=>{
	yargs.option(k,v);
});
let argv = yargs.argv;

//async method for getting input
const getInput = (prompt,promptOptions)=>{
	return new Promise((resolve,reject)=>{
		prompt.get(promptOptions,(err,res)=>{
			//i have no idea what kind of error could possibley happen. Maybe reject() on error could be valid but eh
			if(err) console.error(err);
			resolve(res);
		});
	});

}

const init = async ()=>{
	if(argv.CONFIG){
		try{
			Object.entries(JSON.parse(fs.readFileSync(argv.CONFIG).toString())).forEach(([k,v])=>{
				if(!(k in argv)) argv[k] = v;
			});
		} catch(e){
			console.error('Failed to read config file, ' + e);
		}
	}
	console.log(argv);
	const promptOptions = [];
	Object.entries(options).forEach(([k,v])=>{
		if((!(k in argv)) && !v.ignorable){
			promptOptions.push({
				name:k,
				description:v.describe,
				type:'string',
				required:true
			});
		}
	});
	promptOptions.push({
		hidden:true,
		name:'SSH_PASS',
		description:'Password for authenticating with ESXI host. (Will not be echoed.)'
	});
	prompt.start();
	prompt.message = '';
	prompt.delimiter = '';
	const promptResults = await getInput(prompt,promptOptions);
	console.log(promptResults);
}
init();
