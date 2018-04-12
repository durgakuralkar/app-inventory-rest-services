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

module.exports.process_getAduitRecordForUser = function(res,data){
	getAduitRecordForUser(data,res);
}

/*var validateUser = function(data, response) {
	console.log(data.id);
	var adminRole=data.role;
	dba.find({selector:{type:"user",userId:data.id,password:data.password}}, function(er, result) {
		  if (er) {
		    throw er;
		  }
		  //response = result;
		  console.log(result);
		  if(result.docs.length != 0){
			  console.log("inside result.docs.length != 0");
			 // if(contains(result.docs[0].roles,adminRole)){
				  result.docs[0].status = true;
				  //result.docs[0].loggedInRole= adminRole;
				  response.write(JSON.stringify(result));
				  response.end();
			 // }
		  else{
			  result.docs[0].status = false;
		  response.write(JSON.stringify(result));
		  response.end();}}
		 });
}*/

var validateUser = function(data, response) {
	dba.find({selector:{type:"user",userId:data.id,password:data.password}}, function(er, result) {
		  if (er) {
		    throw er;
		  }
		  console.log(result);
		  if(result.docs.length != 0){
			  result.docs[0].status=true;
			  response.write(JSON.stringify(result.docs[0]));
			  response.end();  
		  }
		  else{
		  response.write(JSON.stringify({"status":false}));
		  response.end();}});
}


function contains(arr, element) {
    for (var i = 0; i < arr.length; i++) {
        if (arr[i] === element) {
            return true;
        }
    }
    return false;
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

var getAduitRecordForUser = function(data, response) {
	dba.find({selector:{type:"account" , accountLastModifyBy: data.id}}, function(er, result) {
		  if (er) {
		    throw er;
		  }
		  
		 /* var accountLastModified= result.docs[0]*/
		  console.log(result);
		  if(result.docs.length != 0){
			  response.write(JSON.stringify(result.docs[0]));
			  response.end();  
		  }});
}