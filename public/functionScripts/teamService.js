var dba;

module.exports.setup = function(db){
	dba = db;
};


module.exports.process_getTeamList=function(res,data){
	getByTeamType(data,res);
}

module.exports.process_getTeambyTowerId=function(res,data){
	getTeamByTowerId(data,res);
}

module.exports.process_getTeambyTower=function(res,data){
	getTeamByTower(data,res);
}


var getByTeamType = function(data, response) {
	
	dba.find({selector:{type:'team'}}, function(er, result) {
		  if (er) {
		    throw er;
		  }
		  response.write(JSON.stringify(result));
		  response.end();});
}

var getTeamByTowerId = function(data, response) {
	
	dba.find({selector:{type:'team',teamTowerId:data.id}}, function(er, result) {
		  if (er) {
		    throw er;
		  }
		  response.write(JSON.stringify(result));
		  response.end();});
}


var getTeamByTower = function(data, response) {
	
	dba.find({selector:{type:'team',teamTowerId:data.id}}, function(er, result) {
		  if (er) {
		    throw er;
		  }
		  result.teamdetails=result.docs;
			delete result.docs;
			delete result.bookmark;
			delete result.warning;
			  dba.find({selector:{type:'tower',towerId:data.id}}, function(er, towerresult) {
				  if (er) {
				    throw er;
				  }
				  result.towerDetails= towerresult.docs;
			  
			  response.write(JSON.stringify(result));
			  response.end();}); });
}