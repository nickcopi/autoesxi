require('dotenv').config();
const fs = require('fs');
const template = fs.readFileSync('template.vmx').toString();
const NodeSSH = require('node-ssh');
const cachePath = '/vmCache.json';

const init = async ()=>{
	//const ssh = await newConnection();
	//const ls = await runCommand(ssh,'ls');
	//await newVM('test2');
	await removeVM('test2');
	console.log('disposing...');
	//ssh.dispose();
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
	//await runCommand(ssh,'touch',[cachePath]);
	const cache = await runCommand(ssh,'Get-VM | ConvertTo-JSON',null,null,true);
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
	const newImage = process.env.STORE_PATH + '\\' +  name + '.vhdx';
	console.log('Checking cache....');
	const cache = (await getVMCache(ssh)).map(vm=>vm.VMName);
	if(cache.includes(name)){
		console.error(`Error: there is already a VM registered for ${name}!`);
		await ssh.dispose();
		return false;
	}
	console.log('Copying disk for new VM...');
	console.log(await runCommand(ssh,'cp',[process.env.IMAGE_PATH,newImage]));
	console.log('Registering new VM...');
	console.log(await runCommand(ssh,'New-VM',['-Name', name, '-MemoryStartupBytes' ,'8GB', '-Generation', '2' ,'-VHDPath', newImage]));
	console.log('Configuring new VM...');
	console.log(await runCommand(ssh,'Set-VM -Name ' +  name + ' -AutomaticCheckpointsEnabled $false -ProcessorCount 4'));
	console.log('Starting new VM...');
	await runCommand(ssh,'Start-VM', ['-Name', name]);
	await ssh.dispose();
	return true;
}


/*
 * Remove a tracked VM based on a name and remove it crom cache
 * */
const removeVM = async(name)=>{
	const ssh = await newConnection();
	const imagePath = process.env.STORE_PATH + '\\' +  name + '.vhdx';
	console.log('Checking cache....');
	const cache = (await getVMCache(ssh)).map(vm=>vm.VMName);
	if(!cache.includes(name)){
		console.error(`Error: there is no VM registered for ${name}!`);
		await dispose(ssh);
		return false;
	}
	console.log('Stopping VM....');
	await runCommand(ssh,'Stop-VM', ['-Name',name,'-TurnOff']);
	console.log('Deregistering VM....');
	await runCommand(ssh,'Remove-VM', ['-Name',name,'-Force']);
	if(process.env.SAVE_VM){
		console.log('Backing up VM image....');
		await runCommand(ssh,'mv', [imagePath,process.env.DUMP_PATH]);
	} else {
		console.log('Removing Disk....');
		await runCommand(ssh,'rm', [imagePath]);
	}
	await dispose(ssh);
	return true;
}

const dispose = async ssh=>{
	try{
		(await ssh.dispose());
	} catch (e){}
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

const runCommand = async(ssh,command,args,path,getOutput)=>{
	if(!args) args = [];
	if(!path) path = '/';
	//if(!getOutput){
	//	command = command + ' ' + args.join(' ') + ' > $null';
	//	args = [];
	//	return await ssh.exec(command, args, { cwd: path}).catch(e=>console.error(e));
	//}
	return await ssh.exec(command, args, { cwd: path, stream: 'stdout'}).catch(e=>console.error(e));
}

init();

module.exports = {
	newVM,
}
