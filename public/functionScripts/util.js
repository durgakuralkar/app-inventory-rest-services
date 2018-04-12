var dba;

module.exports.setup = function(db){
	dba = db;
};

module.exports.process_save = function(res,data){
	save(data,res);
}

module.exports.process_update = function(res,data){
	update(data,res);
}

module.exports.process_getById=function(res,data){
	getById(data,res);
}

module.exports.process_getCount=function(res){
	getCount(res);
}

var save = function(data, response) {
    
    //finaldata=JSON.stringify(data);
   // console.log("save data" + finaldata)
    dba.insert(data, null, function(err, doc) {
        console.log("Error:", err);
        console.log("Data:", data);
        //callback(err, data);
        if (err) {
            console.log(err);
            response.sendStatus(500);
        } else
            response.sendStatus(200);
        response.end();
      });

}

var update=function(data,response){
	var id=data.id;
	dba.get(id, {
        revs_info: true
    }, function(err, doc) {
        if (!err) {
        	var rev=doc._rev;
            doc = data;
            doc._id=data.id;
            delete data.id;
            doc._rev=rev;
           console.log(JSON.stringify(doc));
            dba.insert(doc, doc._id, function(err, doc) {
                if (err) {
                    console.log('Error updating data\n' + err);
                    response.sendStatus(500);
                }
                response.sendStatus(200);
            });
        }
    });
}

var getById=function(data,response){
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

var getCount=function(response){
	var finalResult;
	dba.find({selector:{type:'sector'}}, function(er, sectorresult) {
		  if (er) {
		    throw er;
		  }
		 var sectorCount=sectorresult.docs.length;
		  console.log("sectorCount"+sectorresult.docs.length);
		  
	dba.find({selector:{type:'industry'}}, function(er, industryresult) {
				  if (er) {
				    throw er;
				  }
				 var industryCount=industryresult.docs.length;
				  console.log("industrycount"+industryresult.docs.length);
				  
	dba.find({selector:{type:'account'}}, function(er, accountresult) {
					  if (er) {
					    throw er;
					  }
					 var accountCount=accountresult.docs.length;
					  console.log("accountcount"+accountresult.docs.length);
 dba.find({selector:{type:'tower'}}, function(er, towerresult) {
						  if (er) {
						    throw er;
						  }
						 var towerCount=towerresult.docs.length;
						  console.log("towercount"+towerresult.docs.length);
		
	finalResult = {
			"sector" :sectorCount,
			"industry" :industryCount,
			"account" :accountCount,
			"tower":towerCount
	}
	
	response.write(JSON.stringify(finalResult));
	  response.end();
			
				});
			});
		});
    });
}