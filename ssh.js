require('dotenv').config();
const fs = require('fs');
const template = fs.readFileSync('template.vmx').toString();
const NodeSSH = require('node-ssh');

const init = async ()=>{
	const ssh = await newConnection();
	const ls = await runCommand(ssh,'ls');
	await newVM('test2');
	console.log('disposing...');
	ssh.dispose();
}


const newVM = async(name)=>{
	const ssh = await newConnection();
	const path = process.env.STORE_PATH;
	const tempFilePath = process.env.temp + '/' + name + '.vmx';
	const vmxPath = path + '/' + name + '/' + name + '.vmx';
	fs.writeFileSync(tempFilePath, replace(template,'{{name}}',name));
	await runCommand(ssh,'mkdir', ['-p',name], path);
	await runCommand(ssh,'cp', [process.env.IMAGE_PATH,name + '.vmdk'], path + '/' + name);
	await ssh.putFile(tempFilePath, vmxPath);
	await runCommand(ssh,'vim-cmd', ['solo/registervm',vmxPath]);
	fs.unlinkSync(tempFilePath);
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
