require('dotenv').config();
const fs = require('fs');
const template = fs.readFileSync('template.vmx').toString();
const NodeSSH = require('node-ssh');
const cachePath = '/vmCache.json';

const init = async ()=>{
	const ssh = await newConnection();
	const ls = await runCommand(ssh,'ls');
	//await newVM('test2');
	await removeVM('test2');
	console.log('disposing...');
	ssh.dispose();
}

/*
 * Read VM cache from remote disk and return object
 * */
const getVMCache = async (ssh)=>{
	let newSession = false;
	if(!ssh){
		ssh = await newConnection();
		newSession = true;
	}
	await runCommand(ssh,'touch',[cachePath]);
	const cache = await runCommand(ssh,'cat',[cachePath]);
	if(newSession) ssh.dispose();
	try{
		return JSON.parse(cache);
	}
	catch(e){
		return {};
	}
}


/*
 * Write cache object to remote disk
 * */
//please don't run this concurrently with itself, ever, thanks
const saveVMCache = async(ssh,cache)=>{
	let newSession = false;
	if(!ssh){
		ssh = await newConnection();
		newSession = true;
	}
	const tempFilePath = process.env.temp + '/vmCache.json';
	fs.writeFileSync(tempFilePath, JSON.stringify(cache));
	await ssh.putFile(tempFilePath, cachePath);
	fs.unlinkSync(tempFilePath);
	if(newSession) ssh.dispose();
}

/*
 * Create and track a VM based on a name and save it in a cache
 * */
const newVM = async(name)=>{
	const ssh = await newConnection();
	const path = process.env.STORE_PATH;
	const tempFilePath = process.env.temp + '/' + name + '.vmx';
	const vmxPath = path + '/' + name + '/' + name + '.vmx';
	const cache = await getVMCache(ssh);
	if(name in cache){
		console.error(`Error: there is already a VM registered for ${name}!`);
		ssh.dispose();
		return false;
	}
	fs.writeFileSync(tempFilePath, replace(template,'{{name}}',name));
	await runCommand(ssh,'mkdir', ['-p',name], path);
	await runCommand(ssh,'cp', [process.env.IMAGE_PATH,name + '.vmdk'], path + '/' + name);
	await ssh.putFile(tempFilePath, vmxPath);
	const id = await runCommand(ssh,'vim-cmd', ['solo/registervm',vmxPath]);
	if(isNaN(Number(id))){
		console.error(`Error: VM registration failed: ${id}`);
		ssh.dispose();
		return false;
	}
	fs.unlinkSync(tempFilePath);
	cache[name] = id;
	await saveVMCache(ssh,cache);
	ssh.dispose();
	return true;
}


/*
 * Remove a tracked VM based on a name and remove it crom cache
 * */
const removeVM = async(name)=>{
	const ssh = await newConnection();
	const vmPath = process.env.STORE_PATH + '/' + name;
	const cache = await getVMCache(ssh);
	if(!(name in cache)){
		console.error(`Error: there is no VM registered for ${name}!`);
		ssh.dispose();
		return false;
	}
	await runCommand(ssh,'vim-cmd', ['/vmsvc/unregister', cache[name]]);
	//await runCommand(ssh,'rm',['-r',vmPath]));
	delete cache[name];
	await saveVMCache(ssh,cache);
	ssh.dispose();
	return true;
}

const newConnection = async()=>{
	const ssh = new NodeSSH();
	await ssh.connect({
		host: process.env.SSH_HOST,
		username: process.env.SSH_USER,
		password: process.env.SSH_PASS,
		tryKeyboard: true,
		onKeyboardInteractive: (name, instructions, instructionsLang, prompts, finish) => {
			if (prompts.length > 0 && prompts[0].prompt.toLowerCase().includes('password')) {
				finish([process.env.SSH_PASS])
			}
		}
	}).catch(e=>console.error(e));
	return ssh;
}

const replace = (template,tag,filler) =>{
	let result = template;
	if(tag.includes(filler)) return result;
	while(result.includes(tag))
		result = result.replace(tag,filler);
	return result;
}

const runCommand = async(ssh,command,args,path)=>{
	if(!args) args = [];
	if(!path) path = '/';
	return await ssh.exec(command, args, { cwd: path, stream: 'stdout', options: { pty: true } }).catch(e=>console.error(e));
}

init();

module.exports = {
	newVM,
}
