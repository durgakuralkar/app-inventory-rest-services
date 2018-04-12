var dba;

module.exports.setup = function(db){
	dba = db;
};

module.exports.process_getTowerList=function(res,data){
	getByTowerType(data,res);
}


module.exports.process_getTowerByAccountId=function(res,data){
	getTowerByAccountId(data,res);
}


module.exports.process_getTowerByAccount=function(res,data){
	getTowerByAccount(data,res);
}



var getByTowerType = function(data, response) {
	
	dba.find({selector:{type:'tower'}}, function(er, result) {
		  if (er) {
		    throw er;
		  }
		  response.write(JSON.stringify(result));
		  response.end();});
}


var getTowerByAccountId = function(data, response) {
	
	dba.find({selector:{type:'tower',towerAccountId:data.id}}, function(er, result) {
		  if (er) {
		    throw er;
		  }
		  response.write(JSON.stringify(result));
		  response.end();});
}

var getTowerByAccount = function(data, response) {
	
	
	dba.find({selector:{type:'tower',towerAccountId:data.id}}, function(er, result) {
		  if (er) {
		    throw er;
		  }
		  result.towerdetails=result.docs;
		delete result.docs;
		delete result.bookmark;
		delete result.warning;
		  dba.find({selector:{type:'account',accountId:data.id}}, function(er, accountresult) {
			  if (er) {
			    throw er;
			  }
			  result.accountDetails= accountresult.docs;
		  
		  response.write(JSON.stringify(result));
		  response.end();}); });
}