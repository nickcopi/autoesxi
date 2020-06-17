const ssh = require('./ssh');
const header = 'LCC-CloudPagingAuto-';

/*
 * VM name mutations are going to be handled here. I don't like the name mutations.
 * */

const list = async ()=>{
	await ssh.init();
	console.log('Querying server...');
	let str = 'Active packaging VMs:\n';
	console.log(await ssh.getVMs());
	str += ((await ssh.getVMs().catch(e=>{}))
		.filter(vm=>vm.includes(header))
		.map(vm=>vm.replace(header,''))
		.join('\n')
	);
	console.log('aaa');
	str += 'Restorable VMs:\n';
	str += (await (ssh.getRestorables())
		.join('\n')
	);
	console.log(str);
	ssh.destroy();
}


module.exports = {
	list,
//	newVM,
//	restoreVM,
//	removeVM
}
