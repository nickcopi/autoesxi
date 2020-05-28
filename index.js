require('dotenv').config();
const express = require('express');
const esxi = require('./ssh');
const app = express();
const port = process.env.PORT || 8080;

app.get('/',(req,res)=>{
	res.send('ok');
});

app.listen(port,()=>{
	console.log(`Listening on port ${port}.`);
});
