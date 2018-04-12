var dba;

module.exports.setup = function(db){
	dba = db;
};


module.exports.process_getIndustryList = function(res){
	getIndustryList(res);
}

module.exports.process_getIndustriesWithSectorBySectorId = function(res,data){
     getIndustriesWithSectorBySectorId(res,data);
}

var getIndustryList = function(response) {
	
	dba.find({selector:{type:'industry'}}, function(er, result) {
		  if (er) {
		    throw er;
		  }
		  response.write(JSON.stringify(result));
		  response.end();});
}


var getIndustriesWithSectorBySectorId =function(response,data){
	
	dba.find({selector:{type:'industry',industrySectorId:data.id}}, function(er, result) {
		  if (er) {
		    throw er;
		  }
		    result.industrydetails=result.docs;
			delete result.docs;
			delete result.bookmark;
			delete result.warning;
			
			  dba.find({selector:{type:'sector', sectorId:data.id}}, function(er, sectorresult) {
				  if (er) {
				    throw er;
				  }
				  result.sectorDetails= sectorresult.docs;
			  
			  response.write(JSON.stringify(result));
			  response.end();}); });
}