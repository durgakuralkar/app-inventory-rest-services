var dba;

module.exports.setup = function(db){
	dba = db;
};

module.exports.process_getApplicationList=function(res,data){
	getByApplicationType(data,res);
}


module.exports.process_getApplicationById=function(res,data){
	getByApplicationId(data,res);
}

module.exports.process_getApplicationDetails=function(res,data){
	getApplicationDetails(data,res);
}

module.exports.process_getApplicationByTeamId=function(res,data){
	getApplicationByTeamId(data,res);
}

module.exports.process_getApplicationbyTeamWithApplicationGroup=function(res,data){
	getApplicationbyTeamWithApplicationGroup(data,res);
}

var getByApplicationId=function(data,response){
	var id=data.id;
			 
		 dba.find({selector:{applicationID:data.id,type:"application"}}, function(er, result) {
			  if (er) {
			    throw er;
			  }
			  response.write(JSON.stringify(result.docs));
			  response.end();
			});
	
}

var getApplicationDetails=function(data,response){
				 
		 dba.find({selector:{applicationID:data.applicationID,type:"application",accountId:data.accountId,applicationTeamId:data.applicationTeamId,towerId:data.towerId}}, function(er, result) {
			  if (er) {
			    throw er;
			  }
			 
			  response.write(JSON.stringify(result.docs));
			  response.end();
			});
	
}

var getByApplicationType = function(data, response) {
	 
	 dba.find({selector:{type:'application'}}, function(er, result) {
		  if (er) {
			    throw er;
			  }
			  response.write(JSON.stringify(result));
			  response.end();});
}

var getApplicationByTeamId = function(data, response) {
	
	dba.find({selector:{type:'application',applicationTeamId:data.id}}, function(er, result) {
		  if (er) {
		    throw er;
		  }
		  response.write(JSON.stringify(result));
		  response.end();});
}


var getApplicationbyTeamWithApplicationGroup =function(data,response){
	
	dba.find({selector:{type:'application',applicationTeamId:data.id}}, function(er, result) {
		  if (er) {
		    throw er;
		  }
		    result.applicationdetails=result.docs;
			delete result.docs;
			delete result.bookmark;
			delete result.warning;
			
			  dba.find({selector:{type:'team', teamId:data.id}}, function(er, teamresult) {
				  if (er) {
				    throw er;
				  }
				  result.teamDetails= teamresult.docs;
			  
			  response.write(JSON.stringify(result));
			  response.end();}); });
}