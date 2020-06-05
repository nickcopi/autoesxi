require('dotenv').config();
const esxi = require('./ssh');
const {argv} = require('yargs')
	.option('package',{
		alias:['n','p','name'],
		describe:'Name of package for which to create a Cloudpaging Studio VM.',
		demandOption:true
	})
	.option('host',{
		alias:['h'],
		describe:'ESXI host address on which to create the VM.',
		demandOption:true
	})

