var dba;

module.exports.setup = function(db){
	dba = db;
	//sleeps=sleep;
};

module.exports.process_saveAccount = function(res,data){
	saveAccount(data,res);
}

module.exports.process_updateAccount = function(res,data){
	updateAccount(data,res);
}

module.exports.process_getAccountList=function(res,data){
	getByAccountType(data,res);
}


module.exports.process_getAccountById=function(res,data){
	getByAccountId(data,res);
}

module.exports.process_getUserAccounts=function(data,res){
	getUserAccounts(data,res);
}

module.exports.process_getUserAccountsByRole=function(data,res){
	getUserAccountsByRole(data,res);
}

module.exports.process_getAccountsWithIndustrybyIndustryid=function(res,data){
	getAccountsWithIndustrybyIndustryid(res,data);
}

var getByAccountId=function(data,response){
	var id=data.id;
	dba.get(id, {
        revs_info: false
    }, function(err, doc) {
        if (!err) {
        	console.log(JSON.stringify(doc));
        	response.write(JSON.stringify(doc));
        	response.end();
        }
        else{
        	response.sendStatus(500);
        }
    });
}

var getByAccountType = function(data, response) {
	
	dba.find({selector:{type:'account'}}, function(er, result) {
		  if (er) {
		    throw er;
		  }
		  response.write(JSON.stringify(result));
		  response.end();});
}

var getUserAccounts = function(data, response) {
	
	dba.find({selector:{type:'user',userId:data.id}}, function(er, result) {
		  if (er) {
		    throw er;
		  }
		  console.log(result.docs[0].accounts);
		  response.write(JSON.stringify(result.docs[0].accounts));
		  response.end();});
		  
}


var getUserAccountsByRole = function(data, response) {
	
	dba.find({selector:{type:'user',userId:data.id}}, function(er, result) {
		  if (er) {
		    throw er;
		  }
		  
		  console.log(result);
		  if(result.docs[0].accounts.length != 0){
			  console.log("inside account length != 0");
			  var responseResult=result;
			  
			  var accounts=result.docs[0].accounts;
			  var i=0;
			  accounts.forEach(function(account) {
				  	console.log("i before"+i);
			    	console.log("account"+JSON.stringify(account));
			    	dba.find({selector:{type:'account',accountId:account.accountId}}, function(er, result1) {
			  		  if (er) {
			  		    throw er;
			  		  }
			  		  
			  		responseResult.docs[0].accounts[i]=(result1.docs[0]);
			  		i++;
			  		console.log("i"+i);
			  		console.log("responseResult.docs[0].accounts.length"+responseResult.docs[0].accounts.length)
			  		if(i >= responseResult.docs[0].accounts.length){
			  		  response.write(JSON.stringify(responseResult));
			  		  response.end();
			  		}
			   });
			 });}});
		  
}

var getAccountsWithIndustrybyIndustryid =function(response,data){
	
	dba.find({selector:{type:'account',accountIndustryID:data.id}}, function(er, result) {
		  if (er) {
		    throw er;
		  }
		  result.accountdetails=result.docs;
			delete result.docs;
			delete result.bookmark;
			delete result.warning;
			  dba.find({selector:{type:'industry',industryId:data.id}}, function(er, industryresult) {
				  if (er) {
				    throw er;
				  }
				  result.industryDetails= industryresult.docs;
			  
			  response.write(JSON.stringify(result));
			  response.end();}); });
}
