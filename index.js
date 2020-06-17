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
const actions = ['new','remove','restore','list'];
const options ={
	'PACKAGE':{
		alias:['package','n','p','name'],
		describe:'Name of package for which to create a Cloudpaging Studio VM.',
		modes:['new','remove','restore']
	},
	'HOST':{
		alias:['host','h'],
		describe:'HyperV host address on which to create this VM.',
		modes:actions
	},
	'SSH_USER':{
		alias:['username','u','user'],
		describe:'Username used to connect to the HyperV host.',
		modes:actions
	},
	'STORE_PATH':{
		alias:['store','s'],
		describe:'Path on HyperV host of folder in which to create this VM.',
		modes:['new','remove','restore']
	},
	'IMAGE_PATH':{
		alias:['image','i'],
		describe:'Path on HyperV host of the base image to be cloned to create this VM.',
		modes:['new']
	},
	'DUMP_PATH':{
		alias:['dump','d'],
		describe:'Path on HyperV host to store disk images after they have been removed so they can later be restored.',
		modes:['new','list']
	},
	'SWITCH_NAME':{
		alias:['switch'],
		describe:'Name of virtual switch on HyperV host to connect to the VM.',
		modes:['new','restore']
	},
	'TRASH_VM':{
		alias:['trash','t'],
		describe:'Don\'t save a copy of the VM disk when removing a VM. This will make it no longer later restorable',
		modes:['remove']

	},
	'CONFIG':{
		alias:['config','c'],
		describe:'Path to a config.json file that can help fill in some of the options here for easy use.',
		ignorable:true
	},
	'ACTION':{
		alias:['action','a'],
		describe:'Action to complete on hypervisor.',
		choices:actions,
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
			//if(err) console.error(err);
			resolve(res);
		});
	});

}

//get action input
const getAction = (prompt)=>{
	return new Promise((resolve,reject)=>{
		prompt.get({
			name: 'action',
			description: options['ACTION'].describe,
			type:'string',
			required:true,
			message:'Action must be one of ' + actions.join(', ') + '.',
			conform:(action)=>{
				//console.log(action);
				return actions.includes(action);
			}
		},(err,res)=>{
			//i have no idea what kind of error could possibley happen. Maybe reject() on error could be valid but eh
			//if(err) console.error(err);
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
		description:'Password for authenticating with HyperV host. (Will not be echoed.)'
	});
	if(promptOptions.length){
		promptOptions.push({
			name:'SAVE',
			description:'Write options out to a config.json file? (Will overwrite!) [y/N]'
		});
	}
	prompt.start();
	prompt.message = '';
	prompt.delimiter = '';
	if(!('action' in argv)) argv.action = (await getAction(prompt).catch(e=>console.error(e))).action;
	const promptResults = await getInput(prompt,promptOptions);
	process.env = {...process.env,...argv,...promptResults};
	if(process.env.SAVE.toLowerCase() === 'y'){
		const config = {};
		Object.entries(options).forEach(([k,v])=>{
			if(!v.ignorable){
				config[k] = process.env[k];
			}

		});
		fs.writeFileSync('config.json',JSON.stringify(config,null,2));
		
	}
	//console.log(promptResults);
}
init().catch(e=>{});
