require('dotenv').config();
const NodeSSH = require('node-ssh');

const init = async ()=>{
	const ssh = await newConnection();
	const ls = await runCommand(ssh,'ls');
	ssh.dispose();
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

const runCommand = async(ssh,command,args)=>{
	if(!args) args = [];
	return await ssh.exec(command, args, { cwd: '/', stream: 'stdout', options: { pty: true } });
}

init();
