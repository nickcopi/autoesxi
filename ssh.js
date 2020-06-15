require('dotenv').config();
const fs = require('fs');
const template = fs.readFileSync('template.vmx').toString();
const NodeSSH = require('node-ssh');

const init = async ()=>{
	//const ssh = await newConnection();
	//const ls = await runCommand(ssh,'ls');
	//await newVM('test2');
	await removeVM('test2');
	//await restoreVM('test2');
	//console.log(await getRestorable());
	console.log('disposing...');
	//ssh.dispose();
}



const getVMs = async ()=>{
	return await getVMCache();
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
	const result = await createVM(ssh,name,newImage);
	await ssh.dispose();
	return result;
}

/*
 * Restore a VM based on name
 * */
const restoreVM = async(name)=>{
	const ssh = await newConnection();
	const oldImage = process.env.DUMP_PATH + '\\' +  name + '.vhdx';
	console.log('Checking cache....');
	const cache = await getRestorable(ssh);
	if(!cache.includes(name + '.vhdx')){
		console.error(`Error: there is no VM restorable for ${name}!`);
		await ssh.dispose();
		return false;
	}
	const result = await createVM(ssh,name,oldImage);
	await ssh.dispose();
	return result;
}



const createVM = async (ssh,name, imagePath)=>{
	console.log('Copying disk for new VM...');
	await runCommand(ssh,'cp',[process.env.IMAGE_PATH,imagePath]);
	console.log('Registering new VM...');
	await runCommand(ssh,'New-VM',['-Name', name, '-MemoryStartupBytes' ,'8GB', '-Generation', '2' ,'-VHDPath', imagePath]);
	console.log('Configuring new VM...');
	await runCommand(ssh,'Set-VM -Name ' +  name + ' -AutomaticCheckpointsEnabled $false -ProcessorCount 4');
	console.log('Starting new VM...');
	await runCommand(ssh,'Start-VM', ['-Name', name,'-ErrorAction', 'SilentlyContinue']);
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
	await runCommand(ssh,'Stop-VM', ['-Name',name,'-TurnOff','-ErrorAction', 'SilentlyContinue']);
	console.log('Deregistering VM....');
	await runCommand(ssh,'Remove-VM', ['-Name',name,'-Force','-ErrorAction', 'SilentlyContinue']);
	if(process.env.SAVE_VM){
		console.log('Backing up VM image....');
		await runCommand(ssh,'mv', ['-Force',imagePath,process.env.DUMP_PATH]);
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

/*
 * Get a list of restorable VMs we have images for
 * */
const getRestorable = async ssh=>{
	let newSession = false;
	if(!ssh){
		ssh = await newConnection();
		newSession = true;
	}
	//await runCommand(ssh,'touch',[cachePath]);
	const cache = await runCommand(ssh,`Get-ChildItem -Path '${process.env.DUMP_PATH}' -Name '*' -File | ConvertTo-JSON`,null,process.env.DUMP_PATH);
	if(newSession) ssh.dispose();
	if(!cache) return [];
	try{
		const list = JSON.parse(cache);//.map(item=>item.Name);
		if(!list.length) return [list.value];
		return list.map(item=>item.value);
	}
	catch(e){
		return {};
	}

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
	getVMs,

}
