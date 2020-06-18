const ssh = require('./ssh');
const header = 'LCC-CloudPagingAuto-';

/*
 * VM name mutations are going to be handled here. I don't like the name mutations.
 * */

const list = async ()=>{
	await ssh.init();
	console.log('Querying server...');
	let str = 'Active packaging VMs:\n';
	str += ((await ssh.getVMs().catch(e=>{}))
		.filter(vm=>vm.includes(header))
		.map(vm=>vm.replace(header,''))
		.join('\n')
	);
	str += 'Restorable VMs:\n';
	str += ((await ssh.getRestorable())
		.map(file=>file.replace('.vhdx','').replace(header,''))
		.join('\n')
	);
	console.log(str);
	process.exit();
	//ssh.destroy();
}

const newVM = async (name)=>{
	await ssh.init();
	await ssh.newVM(header + name);
	process.exit();
}


module.exports = {
	list,
	newVM,
//	restoreVM,
//	removeVM
}
