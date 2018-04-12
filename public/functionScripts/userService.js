var dba;

module.exports.setup = function(db){
	dba = db;
};

module.exports.process_validateUser = function(data,res){
	validateUser(data,res);
}

module.exports.process_getUserRoleList = function(res,data){
	getuserRoleList(data,res);
}

var validateUser = function(data, response) {
	dba.find({selector:{type:"user",userId:data.id,password:data.password}}, function(er, result) {
		  if (er) {
		    throw er;
		  }
		  console.log(result);
		  if(result.docs.length != 0){
			  response.write(JSON.stringify(result.docs[0]));
			  response.end();  
		  }
		  else{
		  response.write(JSON.stringify({"result":false}));
		  response.end();}});
}

var getuserRoleList = function(data, response) {
	dba.find({selector:{type:"userRoles"}}, function(er, result) {
		  if (er) {
		    throw er;
		  }
		  console.log(result);
		  if(result.docs.length != 0){
			  response.write(JSON.stringify(result.docs[0]));
			  response.end();  
		  }});
}
