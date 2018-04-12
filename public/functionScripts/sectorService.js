var dba;

module.exports.setup = function(db){
	dba = db;
};


module.exports.process_getSectorList = function(data){
	getSectorList(data);
}

module.exports.process_getUserDetailsByRole = function(response,data){
	console.log(data);
	getUserDetailsByRole(response,data);
}


var getSectorList = function(response) {
	
	dba.find({selector:{type:'sector'}}, function(er, result) {
		  if (er) {
		    throw er;
		  }
		  response.write(JSON.stringify(result));
		  response.end();});
}

var getUserDetailsByRole = function(response,data) {
	console.log(data.user);
	dba.find({selector:{type:'user',userId:data.user}}, function(er, result) {
		  if (er) {
		    throw er;
		  }
		  console.log(result);
		  if(data.role == "SU01" && result.docs[0].userRole == "SU01" ){
			  getSectorList(response);
		  }
		  if(data.role == "SL01" && result.docs[0].userRole == "SL01" ){
			  console.log(result.docs[0].userRole);
			  getIndustryList(response,result.docs[0].userSector);
		  }	
		  if(data.role == "IL01" && result.docs[0].userRole == "IL01" ){
			 getAccountList(response,result.docs[0].userIndustry);
		  }
		  if(data.role == "AL01" && result.docs[0].userRole == "AL01" ){
				 getTowerList(response,result.docs[0].useraccount);
		 }
		  if(data.role == "PL01" && result.docs[0].userRole == "PL01" ){
				 getTeamList(response,result.docs[0].userPortfolio);
		 }
		 if(data.role == "AA01" && result.docs[0].userRole == "AA01" ){
				 getApplicationList(response,result.docs[0].userApplicationArea);
		 }
	
	});
		 
}

var getIndustryList = function(response,data) {
	
	dba.find({selector:{type:'industry',industrySectorId:data}}, function(er, result) {
		  if (er) {
		    throw er;
		  }
		  response.write(JSON.stringify(result));
		  response.end();});
}

var getAccountList = function(response,data) {
	
	dba.find({selector:{type:'account',accountIndustryID: data}}, function(er, result) {
		  if (er) {
		    throw er;
		  }
		  response.write(JSON.stringify(result));
		  response.end();});
}

var getTowerList = function(response,data) {
	
	dba.find({selector:{type:'tower',towerAccountId: data}}, function(er, result) {
		  if (er) {
		    throw er;
		  }
		  response.write(JSON.stringify(result));
		  response.end();});
}

var getTeamList = function(response,data) {
	
	dba.find({selector:{type:'team',teamTowerId: data}}, function(er, result) {
		  if (er) {
		    throw er;
		  }
		  response.write(JSON.stringify(result));
		  response.end();});
}

var getApplicationList = function(response,data) {
	dba.find({selector:{type:'application',applicationTeamName: data}}, function(er, result) {
		  if (er) {
		    throw er;
		  }
		  response.write(JSON.stringify(result));
		  response.end();});
}