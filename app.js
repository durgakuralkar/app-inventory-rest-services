/**
 * Module dependencies.
 */

var express = require('express'),
    routes = require('./routes'),
    user = require('./routes/user'),
    http = require('http'),
    path = require('path'),
    fs = require('fs');
	cors=require('cors');
var app = express();
var accountservice=require ('./public/functionScripts/account');
var towerservice=require ('./public/functionScripts/towerService');
var userservice=require ('./public/functionScripts/userService1');
var teamservice=require ('./public/functionScripts/teamService');
var sectorservice=require ('./public/functionScripts/sectorService');
var industryservice=require ('./public/functionScripts/industryService');
var applicationservice=require ('./public/functionScripts/applicationService');
var utilservice=require ('./public/functionScripts/util');
var dateTime = require('node-datetime');
var dt = dateTime.create();
dt.format('m/d/Y');
var compression=require("compression");
//var sleep = require('sleep');
var db;

var cloudant;

var fileToUpload;

var dbCredentials = {
    dbName: 'my_sample_db'
};

var bodyParser = require('body-parser');
var methodOverride = require('method-override');
var logger = require('morgan');
var errorHandler = require('errorhandler');
var multipart = require('connect-multiparty')
var multipartMiddleware = multipart();

// all environments
app.set('port', process.env.PORT || 3000);
app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');
app.engine('html', require('ejs').renderFile);
app.use(logger('dev'));
app.use(bodyParser.urlencoded({
    extended: true
}));
app.use(bodyParser.json());
app.use(methodOverride());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/style', express.static(path.join(__dirname, '/views/style')));
app.use(compression());

app.options('*', cors());
app.use(cors());
// development only
if ('development' == app.get('env')) {
    app.use(errorHandler());
}

function getDBCredentialsUrl(jsonData) {
    var vcapServices = JSON.parse(jsonData);
    // Pattern match to find the first instance of a Cloudant service in
    // VCAP_SERVICES. If you know your service key, you can access the
    // service credentials directly by using the vcapServices object.
    for (var vcapService in vcapServices) {
        if (vcapService.match(/cloudant/i)) {
            return vcapServices[vcapService][0].credentials.url;
        }
    }
}

function initDBConnection() {
    //When running on Bluemix, this variable will be set to a json object
    //containing all the service credentials of all the bound services
    if (process.env.VCAP_SERVICES) {
        dbCredentials.url = getDBCredentialsUrl(process.env.VCAP_SERVICES);
    } else { //When running locally, the VCAP_SERVICES will not be set

        // When running this app locally you can get your Cloudant credentials
        // from Bluemix (VCAP_SERVICES in "cf env" output or the Environment
        // Variables section for an app in the Bluemix console dashboard).
        // Once you have the credentials, paste them into a file called vcap-local.json.
        // Alternately you could point to a local database here instead of a
        // Bluemix service.
        // url will be in this format: https://username:password@xxxxxxxxx-bluemix.cloudant.com
        dbCredentials.url = getDBCredentialsUrl(fs.readFileSync("vcap-local.json", "utf-8"));
    }

    cloudant = require('cloudant')(dbCredentials.url);

    // check if DB exists if not create
    cloudant.db.create(dbCredentials.dbName, function(err, res) {
        if (err) {
            console.log('Could not create new db: ' + dbCredentials.dbName + ', it might already exist.');
        }
    });

    db = cloudant.use(dbCredentials.dbName);
    accountservice.setup(db);
    towerservice.setup(db);
    userservice.setup(db);
    teamservice.setup(db);
    applicationservice.setup(db);
    sectorservice.setup(db);
    industryservice.setup(db);
    utilservice.setup(db);
}

initDBConnection();


app.get('/', routes.index);

function createResponseData(id, name, value, attachments) {

    var responseData = {
        id: id,
        name: sanitizeInput(name),
        value: sanitizeInput(value),
        attachements: []
    };


    attachments.forEach(function(item, index) {
        var attachmentData = {
            content_type: item.type,
            key: item.key,
            url: '/api/favorites/attach?id=' + id + '&key=' + item.key
        };
        responseData.attachements.push(attachmentData);

    });
    return responseData;
}

function sanitizeInput(str) {
	console.log("str"+str);
    return String(str).replace(/&(?!amp;|lt;|gt;)/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

var saveDocument = function(id, name, value, response) {

    if (id === undefined) {
        // Generated random id
        id = '';
    }

    db.insert({
        name: name,
        value: value
    }, id, function(err, doc) {
        if (err) {
            console.log(err);
            response.sendStatus(500);
        } else
            response.sendStatus(200);
        response.end();
    });

}

app.get('/api/favorites/attach', function(request, response) {
    var doc = request.query.id;
    var key = request.query.key;

    db.attachment.get(doc, key, function(err, body) {
        if (err) {
            response.status(500);
            response.setHeader('Content-Type', 'text/plain');
            response.write('Error: ' + err);
            response.end();
            return;
        }

        response.status(200);
        response.setHeader("Content-Disposition", 'inline; filename="' + key + '"');
        response.write(body);
        response.end();
        return;
    });
});

app.post('/api/favorites/attach', multipartMiddleware, function(request, response) {

    console.log("Upload File Invoked..");
    console.log('Request: ' + JSON.stringify(request.headers));

    var id;

    db.get(request.query.id, function(err, existingdoc) {

        var isExistingDoc = false;
        if (!existingdoc) {
            id = '-1';
        } else {
            id = existingdoc.id;
            isExistingDoc = true;
        }

        var name = sanitizeInput(request.query.name);
        var value = sanitizeInput(request.query.value);

        var file = request.files.file;
        var newPath = './public/uploads/' + file.name;

        var insertAttachment = function(file, id, rev, name, value, response) {

            fs.readFile(file.path, function(err, data) {
                if (!err) {

                    if (file) {

                        db.attachment.insert(id, file.name, data, file.type, {
                            rev: rev
                        }, function(err, document) {
                            if (!err) {
                                console.log('Attachment saved successfully.. ');

                                db.get(document.id, function(err, doc) {
                                    console.log('Attachements from server --> ' + JSON.stringify(doc._attachments));

                                    var attachements = [];
                                    var attachData;
                                    for (var attachment in doc._attachments) {
                                        if (attachment == value) {
                                            attachData = {
                                                "key": attachment,
                                                "type": file.type
                                            };
                                        } else {
                                            attachData = {
                                                "key": attachment,
                                                "type": doc._attachments[attachment]['content_type']
                                            };
                                        }
                                        attachements.push(attachData);
                                    }
                                    var responseData = createResponseData(
                                        id,
                                        name,
                                        value,
                                        attachements);
                                    console.log('Response after attachment: \n' + JSON.stringify(responseData));
                                    response.write(JSON.stringify(responseData));
                                    response.end();
                                    return;
                                });
                            } else {
                                console.log(err);
                            }
                        });
                    }
                }
            });
        }

        if (!isExistingDoc) {
            existingdoc = {
                name: name,
                value: value,
                create_date: new Date()
            };

            // save doc
            db.insert({
                name: name,
                value: value
            }, '', function(err, doc) {
                if (err) {
                    console.log(err);
                } else {

                    existingdoc = doc;
                    console.log("New doc created ..");
                    console.log(existingdoc);
                    insertAttachment(file, existingdoc.id, existingdoc.rev, name, value, response);

                }
            });

        } else {
            console.log('Adding attachment to existing doc.');
            console.log(existingdoc);
            insertAttachment(file, existingdoc._id, existingdoc._rev, name, value, response);
        }

    });

});

app.post('/api/favorites', function(request, response) {

    console.log("Create Invoked..");
    console.log("Name: " + request.body.name);
    console.log("Value: " + request.body.value);

    // var id = request.body.id;
    var name = sanitizeInput(request.body.name);
    var value = sanitizeInput(request.body.value);

    saveDocument(null, name, value, response);

});





app.get('/api/getByType', function(request, response) {

    console.log("get By Type Invoked..");

   var type = sanitizeInput(request.query.type);
      
   console.log("type: " + type);
  
    var data={
    		type: type,
	};
    
   if(data.type == "account"){
	   accountservice.process_getAccountList(response,data);
   }
   if(data.type == "tower"){
	   towerservice.process_getTowerList(response,data);
   }
   if(data.type=="team"){
	   teamservice.process_getTeamList(response,data);
   }
   if(data.type=="application"){
	   applicationservice.process_getApplicationList(response,data);
   }
   if(data.type=="userRoles"){
	   userservice.process_getUserRoleList(response,data);
   }
   if(data.type=="sector"){
	   sectorservice.process_getSectorList(response);
   }
   if(data.type=="industry"){
	   industryservice.process_getIndustryList(response);
   }
});


app.post('/api/createUser', function(request,response) {
	console.log("Create user Invoked..");
	console.log('Request: ' + JSON.stringify(request.headers));
	console.log('Body: ' + JSON.stringify(request.body));  
	var userId = sanitizeInput(request.body.userId);   
	var firstName = sanitizeInput(request.body.firstName);   
	var middleName = sanitizeInput(request.body.middleName);
	var userEmailId = sanitizeInput(request.body.userEmailId);
	var lastName = sanitizeInput(request.body.lastName);
	var userSector=sanitizeInput(request.body.userSector);
	var userIndustry=sanitizeInput(request.body.userIndustry);
	var userAccount=sanitizeInput(request.body.userAccount);
	var userPortfolio=sanitizeInput(request.body.userPortfolio);
	var userApplicationArea=sanitizeInput(request.body.userApplicationArea); 
	var userApplication=sanitizeInput(request.body.userApplication); 
	var userRole=sanitizeInput(request.body.userRole);
	var password=sanitizeInput(request.body.password);
	var alexaEnabled=sanitizeInput(request.body.alexaEnabled);
	//console.log("sectorType: " + type);
	var data={    		
			userId : userId,    		
			type: "user",    		
			firstName:firstName, 
			middleName:middleName,
			userEmailId:userEmailId,
			lastName:lastName,    		
			userSector:userSector,    		
			userIndustry:userIndustry,    		
			userPortfolio:userPortfolio,    		
			userApplicationArea:userApplicationArea,   		
			userApplication:userApplication,
			userRole:userRole,
			password:password,
			userAccount:userAccount,
			alexaEnabled:alexaEnabled
			};  
	console.log("data"+data)
	utilservice.process_save(response,data);
	});

function randomChar(){
    return String.fromCharCode(randomNum(100));
}

function randomNum(hi){
    return Math.floor(Math.random()*hi);
} 

function randomString(length){
   var str = "";
   for(var i = 0; i < length; ++i){
        str += randomChar();
   }
   return str;
}

function keyGen(keyLength) {
    var i, key = "", characters = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

    var charactersLength = characters.length;

    for (i = 0; i < keyLength; i++) {
        key += characters.substr(Math.floor((Math.random() * charactersLength) + 1), 1);
    }

    return key;
}

app.post('/api/createSector', function(request,response) {
	console.log("Create Sector Invoked..");
	console.log('Request: ' + JSON.stringify(request.headers));
	console.log('Body: ' + JSON.stringify(request.body));  
	var sectorId = null;   
	var sectorName = sanitizeInput(request.body.sectorName); 
	var sectorDesc = sanitizeInput(request.body.sectorDesc);
	var sectorLeadName = sanitizeInput(request.body.sectorLeadName);
	var sectorLeadEmailId = sanitizeInput(request.body.sectorLeadEmailId);
	var sectorLeadPhoneNo = sanitizeInput(request.body.sectorLeadPhoneNo);
	var sectorCreatedBy=sanitizeInput(request.body.sectorCreatedBy);  
	var sectorCreatedOn=new Date(dt.now()); 
	var sectorLastModifyBy="Admin"; 
	var sectorLastModifyOn=new Date(dt.now());   
	var sectorImage=sanitizeInput(request.body.sectorImage); 
	console.log("sectorId: " + sectorId);   
	sectorId=keyGen(5)+sectorName;
	console.log("sectorId"+sectorId);
	//console.log("sectorType: " + type);
	var data={    		
			sectorId : sectorId,    		
			type: "sector",    		
			sectorName:sectorName, 
			sectorLeadEmailId:sectorLeadEmailId,
			sectorLeadPhoneNo:sectorLeadPhoneNo,
			sectorLeadName:sectorLeadName,    		
			sectorCreatedBy:sectorCreatedBy,    		
			sectorCreatedOn:sectorCreatedOn,    		
			sectorLastModifyBy:sectorLastModifyBy,    		
			sectorLastModifyOn:sectorLastModifyOn,   		
		    sectorImage:sectorImage,
		    sectorDesc:sectorDesc
			};  
	console.log("data"+data)
	utilservice.process_save(response,data);
	});

app.put('/api/updateSector', function(request, response) {

    console.log("Update Invoked for Industry..");
    var id = sanitizeInput(request.body._id); 
    var sectorId = sanitizeInput(request.body.sectorId);   
	var sectorName = sanitizeInput(request.body.sectorName);   
	var sectorLeadName = sanitizeInput(request.body.sectorLeadName);
	var sectorLeadEmailId = sanitizeInput(request.body.sectorLeadEmailId);
	var sectorLeadPhoneNo = sanitizeInput(request.body.sectorLeadPhoneNo);
	var sectorLastModifyBy="Admin"; 
	var sectorLastModifyOn=new Date(dt.now()); 
	var sectorCreatedBy=sanitizeInput(request.body.sectorCreatedBy);  
	var sectorCreatedOn=sanitizeInput(request.body.sectorCreatedOn);  
	var sectorImage=sanitizeInput(request.body.sectorImage); 
	var sectorDesc = sanitizeInput(request.body.sectorDesc);
    var data={
    		id:id,
    		sectorId : sectorId,    		
			type: "sector",    		
			sectorName:sectorName,
			sectorDesc:sectorDesc,
			sectorLeadEmailId:sectorLeadEmailId,
			sectorLeadPhoneNo:sectorLeadPhoneNo,
			sectorLeadName:sectorLeadName,    		
			sectorCreatedBy:sectorCreatedBy,    		
			sectorCreatedOn:sectorCreatedOn,    		
			sectorLastModifyBy:sectorLastModifyBy,    		
			sectorLastModifyOn:sectorLastModifyOn,   		
		    sectorImage:sectorImage	 
    		
	};
    utilservice.process_update(response,data);
    });

app.post('/api/createIndustry', function(request,response) {
	console.log("Create Industry Invoked..");
	console.log('Request: ' + JSON.stringify(request.headers));
	console.log('Body: ' + JSON.stringify(request.body));  
	var industryId =null;   
	var industryName = sanitizeInput(request.body.industryName); 
	var industryDesc = sanitizeInput(request.body.industryDesc);
	var industrySectorId = sanitizeInput(request.body.industrySectorId);
	var industrySectorName = sanitizeInput(request.body.industrySectorName);
	var industryLeadName = sanitizeInput(request.body.industryLeadName); 
	var industryLeadEmailId = sanitizeInput(request.body.industryLeadEmailId);  
	var industryLeadPhoneNo = sanitizeInput(request.body.industryLeadPhoneNo);
	var industryCreatedBy=sanitizeInput(request.body.industryCreatedBy);  
	var industryCreatedOn=new Date(dt.now());  
	var industryLastModifyBy="Admin"; 
	var industryLastModifyOn=new Date(dt.now());   
	var industryImage=sanitizeInput(request.body.industryImage); 
	industryId=keyGen(5)+industryName;
	console.log("industryId: " + industryId);   
	//console.log("industryType: " + type);
	var data={    		
			industryId : industryId,    		
			type: "industry",    		
			industryName:industryName, 
			industryDesc:industryDesc,
			industrySectorId:industrySectorId,
			industrySectorName:industrySectorName,
			industryLeadName:industryLeadName,
			industryLeadEmailId:industryLeadEmailId,
			industryLeadPhoneNo:industryLeadPhoneNo,
			industryCreatedBy:industryCreatedBy,    		
			industryCreatedOn:industryCreatedOn,    		
			industryLastModifyBy:industryLastModifyBy,    		
			industryLastModifyOn:industryLastModifyOn,		
			industryImage:industryImage	
			};    
	utilservice.process_save(response,data);
	});


app.put('/api/updateIndustry', function(request, response) {

    console.log("Update Invoked for Industry..");
    var id=sanitizeInput(request.body._id);  
    var industryId = sanitizeInput(request.body.industryId);   
	var industryName = sanitizeInput(request.body.industryName);
	var industryDesc = sanitizeInput(request.body.industryDesc);
	var industrySectorId = sanitizeInput(request.body.industrySectorId);  
	var industryLeadName = sanitizeInput(request.body.industryLeadName); 
	var industryLeadEmailId = sanitizeInput(request.body.industryLeadEmailId);  
	var industryLeadPhoneNo = sanitizeInput(request.body.industryLeadPhoneNo);
	var industryCreatedBy=sanitizeInput(request.body.industryCreatedBy);  
	var industryCreatedOn=sanitizeInput(request.body.industryCreatedOn);  
	var industryLastModifyBy="Admin"; 
	var industryLastModifyOn=new Date(dt.now());   
	var industryImage=sanitizeInput(request.body.industryImage); 
	console.log("industryId: " + industryId);   
	var industrySectorName = sanitizeInput(request.body.industrySectorName);
	 
     
    var data={
    		id:id,
    		industryId : industryId,    		
			type: "industry",    		
			industryName:industryName,
			industryDesc:industryDesc,
			industrySectorId:industrySectorId,
			industrySectorName:industrySectorName,
			industryLeadName:industryLeadName,
			industryLeadEmailId:industryLeadEmailId,
			industryLeadPhoneNo:industryLeadPhoneNo,
			industryCreatedBy:industryCreatedBy,    		
			industryCreatedOn:industryCreatedOn,    		
			industryLastModifyBy:industryLastModifyBy,    		
			industryLastModifyOn:industryLastModifyOn,		
			industryImage:industryImage	  
    		
	};
    utilservice.process_update(response,data);
    });


app.get('/api/getAccountbyId',function(request,response){
	 var id = sanitizeInput(request.query.id);
	 
	 var data={
			 id:id
	 };
	 
	 utilservice.process_getById(response,data);
	 
});

app.get('/api/getUserDetailsByRole',function(request,response){
	 var id = sanitizeInput(request.query.user);
	 var userRole=sanitizeInput(request.query.userRole);
	 var data={
			 user:id,
			 role:userRole
	 };
	 
	 sectorservice.process_getUserDetailsByRole(response,data);
	 
});

app.get('/api/getIndustriesWithSectorBySectorId',function(request,response){
	 var id = sanitizeInput(request.query.sectorId);
	 var data={
			 id:id
	 };
	 
	 industryservice.process_getIndustriesWithSectorBySectorId(response,data);
	 
});

app.get('/api/getAccountsWithIndustrybyIndustryid',function(request,response){
	 var id = sanitizeInput(request.query.industryId);
	 var data={
			 id:id
	 };
	 
	 accountservice.process_getAccountsWithIndustrybyIndustryid(response,data);
	 
});

app.post('/api/createAccount', function(request,response) {

    console.log("Create Account Invoked..");
    
    console.log('Request: ' + JSON.stringify(request.headers));
    console.log('Body: ' + JSON.stringify(request.body));

   var accountId = sanitizeInput(request.body.accountId);
   var accountName = sanitizeInput(request.body.accountName);
   var accountDesc = sanitizeInput(request.body.accountDesc);
   var accountSectorName = sanitizeInput(request.body.accountSectorName);
   var accountIndustryName = sanitizeInput(request.body.accountIndustryName);
   var accountSectorID = sanitizeInput(request.body.accountSectorID);
   var accountIndustryID = sanitizeInput(request.body.accountIndustryID);
   var accountPalName = sanitizeInput(request.body.accountPalName);
   var accountPalEmailId = sanitizeInput(request.body.accountPalEmailId);
   var accountPalPhoneNo = sanitizeInput(request.body.accountPalPhoneNo);
   var accountCreatedBy=sanitizeInput(request.body.accountCreatedBy);
   var accountCreatedOn=new Date(dt.now());
   var accountLastModifyBy="Admin";
   var accountLastModifyOn=new Date(dt.now());
   var accountImage=sanitizeInput(request.body.accountImage);
   var accountGeoInfo=sanitizeInput(request.body.accountGeoInfo);
   var accountClientLocation=sanitizeInput(request.body.accountClientLocation);
   var accountClientWebsite=sanitizeInput(request.body.accountClientWebsite);
   var accountIndustry=sanitizeInput(request.body.accountIndustry);
   var accountOnsiteLocation=sanitizeInput(request.body.accountOnsiteLocation);
   console.log("accountId: " + accountId);
   console.log("userid: ");
   //console.log("accountType: " + type);
    var data={
    		accountId : accountId,
    		type: "account",
    		accountName:accountName,
    		accountDesc:accountDesc,
    		accountSectorName:accountSectorName,
    		accountSectorID:accountSectorID,
    		accountPalName:accountPalName,
    		accountCreatedBy:accountCreatedBy,
    		accountCreatedOn:accountCreatedOn,
    		accountLastModifyBy:accountLastModifyBy,
    		accountLastModifyOn:accountLastModifyOn,
    		accountImage:accountImage,
    		accountGeoInfo:accountGeoInfo,
    		accountClientLocation:accountClientLocation,
    		accountClientWebsite:accountClientWebsite,
    		accountIndustryName:accountIndustryName,
    		accountIndustryID:accountIndustryID,
    		accountOnsiteLocation:accountOnsiteLocation,
    		accountPalEmailId:accountPalEmailId,
    		accountPalPhoneNo:accountPalPhoneNo
	};

    utilservice.process_save(response,data);

});

app.put('/api/updateAccount', function(request, response) {

    console.log("Update Invoked for Account..");

    var id = request.body._id;
    var accountId = sanitizeInput(request.body.accountId);
    var accountName = sanitizeInput(request.body.accountName);
    var accountDesc = sanitizeInput(request.body.accountDesc);
    var accountSectorName = sanitizeInput(request.body.accountSectorName);
    var accountSectorID = sanitizeInput(request.body.accountSectorID);
    var accountPal = sanitizeInput(request.body.accountPal);
    var accountCreatedBy=sanitizeInput(request.body.accountCreatedBy);
    var accountCreatedOn=new Date(dt.now());
    var accountImage=sanitizeInput(request.body.accountImage);
    var accountGeoInfo=sanitizeInput(request.body.accountGeoInfo);
    var accountClientLocation=sanitizeInput(request.body.accountClientLocation);
    var accountClientWebsite=sanitizeInput(request.body.accountClientWebsite);
    var accountIndustryName=sanitizeInput(request.body.accountIndustryName);
    var accountIndustryID=sanitizeInput(request.body.accountIndustryID);
    var accountLastModifyBy="Admin";
    var accountLastModifyOn=new Date(dt.now());
    var accountOnsiteLocation=sanitizeInput(request.body.accountOnsiteLocation);
    
    var data={
    		id:request.body._id,
    		accountId : accountId,
    		type: "account",
    		accountDesc:accountDesc,
    		accountName:accountName,
    		accountSectorName:accountSectorName,
    		accountSectorID:accountSectorID,
    		accountPal:accountPal,
    		accountCreatedBy:accountCreatedBy,
    		accountCreatedOn:accountCreatedOn,
    		accountLastModifyBy:accountLastModifyBy,
    		accountLastModifyOn:accountLastModifyOn,
    		accountImage:accountImage,
    		accountGeoInfo:accountGeoInfo,
    		accountClientLocation:accountClientLocation,
    		accountClientWebsite:accountClientWebsite,
    		accountIndustryName:accountIndustryName,
    		accountIndustryID:accountIndustryID,
    		accountOnsiteLocation:accountOnsiteLocation
    };
    
    utilservice.process_update(response,data);
    });

app.post('/api/createTower', function(request,response) {

    console.log("Create Tower Invoked..");
    console.log('Request: ' + JSON.stringify(request.headers));
    console.log('Body: ' + JSON.stringify(request.body));

   var id = request.body._id;
   var towerId = sanitizeInput(request.body.towerId);
   var towerAccountId = sanitizeInput(request.body.towerAccountId);
   var towerAccountName = sanitizeInput(request.body.towerAccountName);
   var towerName = sanitizeInput(request.body.towerName);
   var towerDesc = sanitizeInput(request.body.towerDesc);
   var towerDMName = sanitizeInput(request.body.towerDMName);
   var towerDMEmail = sanitizeInput(request.body.towerDMEmail);
   var towerDMPhoneNo = sanitizeInput(request.body.towerDMPhoneNo);
   var towerImage = sanitizeInput(request.body.towerImage);
   var towerCreatedBy=sanitizeInput(request.body.towerCreatedBy);
   var towerCreatedOn=new Date(dt.now());
   var towerLastModifyBy="Admin";
   var towerLastModifyOn=new Date(dt.now());
   var towerDescription=sanitizeInput(request.body.towerDescription);
   var towerGeoDMName=sanitizeInput(request.body.towerGeoDMName);
   var towerGeoDMEmail=sanitizeInput(request.body.towerGeoDMEmail);
   var towerGeoDMPhoneNo=sanitizeInput(request.body.towerGeoDMPhoneNo);
   var towerGeoBAMName=sanitizeInput(request.body.towerGeoBAMName);
   var towerGeoBAMEmail=sanitizeInput(request.body.towerGeoBAMEmail);
   var towerGeoBAMPhoneNo=sanitizeInput(request.body.towerGeoBAMPhoneNo);
   var towerClientManagerName=sanitizeInput(request.body.towerClientManagerName);
   var towerClientManagerEmail=sanitizeInput(request.body.towerClientManagerEmail);
   var towerClientManagerPhoneNo=sanitizeInput(request.body.towerClientManagerPhoneNo);
   console.log("towerId: " + towerId);
    var data={
    		towerAccountId:towerAccountId,
    		towerId : towerId,
    		id: id,
    		type:'tower',
    		towerName:towerName,
    		towerDesc:towerDesc,
    		towerDMName:towerDMName,
    		towerAccountName:towerAccountName,
    		towerDMEmail:towerDMEmail,
    		towerCreatedBy:towerCreatedBy,
    		towerCreatedOn:towerCreatedOn,
    		towerLastModifyBy:towerLastModifyBy,
    		towerClientManagerEmail:towerClientManagerEmail,
    		towerClientManagerPhoneNo:towerClientManagerPhoneNo,
    		towerLastModifyOn:towerLastModifyOn,
    		towerImage:towerImage,
    		towerGeoDMPhoneNo:towerGeoDMPhoneNo,
    		towerDMPhoneNo:towerDMPhoneNo,
    		towerDescription:towerDescription,
    		towerGeoDMName:towerGeoDMName,
    		towerGeoDMEmail:towerGeoDMEmail,
    		towerGeoBAMName:towerGeoBAMName,
    		towerGeoBAMEmail:towerGeoBAMEmail,
    		towerGeoBAMPhoneNo:towerGeoBAMPhoneNo,
    		towerClientManagerName:towerClientManagerName
	};

    utilservice.process_save(response,data);
});

app.put('/api/updateTower', function(request, response) {

    console.log("Update Invoked for Account..");
    var id=sanitizeInput(request.body._id);
    var towerId = sanitizeInput(request.body.towerId);
    var towerAccountId = sanitizeInput(request.body.towerAccountId);
    var towerName = sanitizeInput(request.body.towerName);
    var towerDesc = sanitizeInput(request.body.towerDesc);
    var towerDMName = sanitizeInput(request.body.towerDMName);
    var towerDMPhoneNo = sanitizeInput(request.body.towerDMPhoneNo);
    var towerDMEmail = sanitizeInput(request.body.towerDMEmail);
    var towerImage = sanitizeInput(request.body.towerImage);
    var towerCreatedBy=sanitizeInput(request.body.towerCreatedBy);
    var towerCreatedOn=sanitizeInput(request.body.towerCreatedOn);
    var towerLastModifyBy="Admin";
    var towerAccountName = sanitizeInput(request.body.towerAccountName);
    var towerLastModifyOn=new Date(dt.now());
    var towerDescription=sanitizeInput(request.body.towerDescription);
    var towerGeoDMName=sanitizeInput(request.body.towerGeoDMName);
    var towerGeoDMEmail=sanitizeInput(request.body.towerGeoDMEmail);
    var towerGeoDMPhoneNo=sanitizeInput(request.body.towerGeoDMPhoneNo);
    var towerGeoBAMName=sanitizeInput(request.body.towerGeoBAMName);
    var towerGeoBAMEmail=sanitizeInput(request.body.towerGeoBAMEmail);
    var towerGeoBAMPhoneNo=sanitizeInput(request.body.towerGeoBAMPhoneNo);
    var towerClientManagerName=sanitizeInput(request.body.towerClientManagerName);
    var towerClientManagerEmail=sanitizeInput(request.body.towerClientManagerEmail);
    var towerClientManagerPhoneNo=sanitizeInput(request.body.towerClientManagerPhoneNo);
    var towerClientManagerName=sanitizeInput(request.body.towerClientManagerName);
    var towerClientManagerEmail=sanitizeInput(request.body.towerClientManagerEmail);
    var towerClientManagerPhoneNo=sanitizeInput(request.body.towerClientManagerPhoneNo);
     
    var data={
            id:id,
    		towerAccountId:towerAccountId,
    		towerId : towerId,
    		type: "tower",
    		towerName:towerName,
    		towerDesc:towerDesc,
    		towerDMName:towerDMName,
    		towerDMEmail:towerDMEmail,
    		towerCreatedBy:towerCreatedBy,
    		towerCreatedOn:towerCreatedOn,
    		towerLastModifyBy:towerLastModifyBy,
    		towerClientManagerEmail:towerClientManagerEmail,
    		towerClientManagerPhoneNo:towerClientManagerPhoneNo,
    		towerLastModifyOn:towerLastModifyOn,
    		towerImage:towerImage,
    		towerAccountName:towerAccountName,
    		towerGeoDMPhoneNo:towerGeoDMPhoneNo,
    		towerDMPhoneNo:towerDMPhoneNo,
    		towerDescription:towerDescription,
    		towerGeoDMName:towerGeoDMName,
    		towerGeoDMEmail:towerGeoDMEmail,
    		towerGeoBAMName:towerGeoBAMName,
    		towerGeoBAMEmail:towerGeoBAMEmail,
    		towerGeoBAMPhoneNo:towerGeoBAMPhoneNo,
    		towerClientManagerName:towerClientManagerName

	};
    utilservice.process_update(response,data);
    });

app.get('/api/getTowerbyAccountId',function(request,response){
	 var id = sanitizeInput(request.query.id);
	 
	 var data={
			 id:id
	 };
	 
	 towerservice.process_getTowerByAccountId(response,data);
	 
});

app.get('/api/getTowerbyAccount',function(request,response){
	 var id = sanitizeInput(request.query.id);
	 
	 var data={
			 id:id
	 };
	 
	 towerservice.process_getTowerByAccount(response,data);
	 
});

app.get('/api/getTeambyTowerId',function(request,response){
	 var id = sanitizeInput(request.query.id);
	 
	 var data={
			 id:id
	 };
	 
	 teamservice.process_getTeambyTowerId(response,data);
	 
});

app.get('/api/getTeambyTower',function(request,response){
	 var id = sanitizeInput(request.query.id);
	 
	 var data={
			 id:id
	 };
	 
	 teamservice.process_getTeambyTower(response,data);
	 
});

app.get('/api/getApplicationById',function(request,response){
	 var id = sanitizeInput(request.query.id);
	 
	 var data={
			 id:id
	 };
	 
	 applicationservice.process_getApplicationById(response,data);
	 
});

app.put('/api/updateApplication', function(request, response) {

    console.log("Update Invoked for Application..");

    var id = request.body._Id;
    var applicationName = sanitizeInput(request.body.applicationName);
    var applicationID = sanitizeInput(request.body.applicationID);
    var applicationDescription = sanitizeInput(request.body.applicationDescription);
    var applicationTeamId = sanitizeInput(request.body.applicationTeamId);
    var applicationTeamName = sanitizeInput(request.body.applicationTeamName);
    var towerId = sanitizeInput(request.body.towerId);
    var accountId = sanitizeInput(request.body.accountId);
    var industryId  = sanitizeInput(request.body.industryId);
    var sectorId = sanitizeInput(request.body.sectorId);
    var towerName = sanitizeInput(request.body.towerName);
    var accountName = sanitizeInput(request.body.accountName);
    var industryName  = sanitizeInput(request.body.industryName);
    var sectorName = sanitizeInput(request.body.sectorName);
    var applicationSrNo	 = sanitizeInput(request.body.applicationSrNo);
    var applicationImage = sanitizeInput(request.body.applicationImage);
    
    var applicationGroup = sanitizeInput(request.body.applicationGroup);
    var applicationTierClassification = sanitizeInput(request.body.applicationTierClassification);
    var buildVendor	 = sanitizeInput(request.body.buildVendor);
    var supportQueueName	 = sanitizeInput(request.body.supportQueueName);
    var confItemsInsupportGroup = sanitizeInput(request.body.confItemsInsupportGroup);
    var primarySupportPerson = sanitizeInput(request.body.primarySupportPerson);
    var SMELocation = sanitizeInput(request.body.SMELocation);

    var SMEName = sanitizeInput(request.body.SMEName);
    var SMEMailID = sanitizeInput(request.body.SMEMailID);
    var SMEContactDetails = sanitizeInput(request.body.SMEContactDetails);
    var applicationLead = sanitizeInput(request.body.applicationLead);
    var applicationLeadMailID = sanitizeInput(request.body.applicationLeadMailID);
    var applicationLeadContactNo = sanitizeInput(request.body.applicationLeadContactNo);
    var applicationManager  = sanitizeInput(request.body.applicationManager);
    var applicationMgrMailID	 = sanitizeInput(request.body.applicationMgrMailID);
    var applicationMgrContactNo	 = sanitizeInput(request.body.applicationMgrContactNo);
    var DMName = sanitizeInput(request.body.DMName);
    var DMMailID = sanitizeInput(request.body.DMMailID);
    var DMContactNumber	 = sanitizeInput(request.body.DMContactNumber);
    var onsiteBAMName = sanitizeInput(request.body.onsiteBAMName);
    var onsiteBAMMailID	 = sanitizeInput(request.body.onsiteBAMMailID);
    var onsiteBAMContactNo	 = sanitizeInput(request.body.onsiteBAMContactNo);
    var offshoreArchitectName = sanitizeInput(request.body.offshoreArchitectName);
    var offshoreArchitectMailID	 = sanitizeInput(request.body.offshoreArchitectMailID);
    var offshoreArchitectContactNo = sanitizeInput(request.body.offshoreArchitectContactNo);
    var deliveryLeadName = sanitizeInput(request.body.deliveryLeadName);
    var deliveryLeadMailID = sanitizeInput(request.body.deliveryLeadMailID);
    var deliveryLeadContactNumber = sanitizeInput(request.body.deliveryLeadContactNumber);

    var clientDeliveryMgrName = sanitizeInput(request.body.clientDeliveryMgrName);
    var clientDeliveryMgrMailID = sanitizeInput(request.body.clientDeliveryMgrMailID);
    var clientDeliveryMgrContactNo = sanitizeInput(request.body.clientDeliveryMgrContactNo);
    var clientPortfolioMgr = sanitizeInput(request.body.clientPortfolioMgr);
    var clientPortfolioMgrMailID	 = sanitizeInput(request.body.clientPortfolioMgrMailID);
    var clientPortfolioMgrContact = sanitizeInput(request.body.clientPortfolioMgrContact);
    var clientApplicationMgr = sanitizeInput(request.body.clientApplicationMgr);
    var clientApplicationMgrMailID	 = sanitizeInput(request.body.clientApplicationMgrMailID);
    var clientApplicationMgrContact	 = sanitizeInput(request.body.clientApplicationMgrContact);
    var clientBUILD   = sanitizeInput(request.body.clientBUILD);
    var responsibleName = sanitizeInput(request.body.responsibleName);
    var responsibleContact = sanitizeInput(request.body.responsibleContact);
    var applicationSupportScope = sanitizeInput(request.body.applicationSupportScope);

    var GTSSAMName = sanitizeInput(request.body.GTSSAMName);
    var GTSSAMMailID = sanitizeInput(request.body.GTSSAMMailID);
    var GTSSAMContactNo = sanitizeInput(request.body.GTSSAMContactNo);

    var sourceCodeAvailable = sanitizeInput(request.body.sourceCodeAvailable);
    var sourceTested = sanitizeInput(request.body.sourceTested);
    var sourceCodeServer = sanitizeInput(request.body.sourceCodeServer);
    var sourceCodeLocation = sanitizeInput(request.body.sourceCodeLocation);
    var sourceCodePath	 = sanitizeInput(request.body.sourceCodePath);
    var reasonForNothavingSourceCode = sanitizeInput(request.body.reasonForNothavingSourceCode);

    var DBMSused  = sanitizeInput(request.body.DBMSused);
    var DBMSVersion = sanitizeInput(request.body.DBMSVersion);
    var DBMSPlatform = sanitizeInput(request.body.DBMSPlatform);

    var AIDStatus	 = sanitizeInput(request.body.AIDStatus);
    var AIDTADAvailableInOKMS = sanitizeInput(request.body.AIDTADAvailableInOKMS);

    var primarySkills	 = sanitizeInput(request.body.primarySkills);
    var secondarySkill	 = sanitizeInput(request.body.secondarySkill);


    var primaryConnectivity	 = sanitizeInput(request.body.primaryConnectivity);
    var seconadaryConnectivity	 = sanitizeInput(request.body.seconadaryConnectivity);
    var tertiaryConnectivity = sanitizeInput(request.body.tertiaryConnectivity);

    var NoofSolutionsArticles	 = sanitizeInput(request.body.NoofSolutionsArticles);
    var lastReviewDateforSolutionArticle = sanitizeInput(request.body.lastReviewDateforSolutionArticle);
     
    var applicationAccessMode = sanitizeInput(request.body.applicationAccessMode);
    var applicationHealthMonitoringTool = sanitizeInput(request.body.applicationHealthMonitoringTool);
    var Remarks = sanitizeInput(request.body.Remarks);
    
    var applicationNature  = sanitizeInput(request.body.applicationNature);
    var applicationLocation = sanitizeInput(request.body.applicationLocation);
    var SOI = sanitizeInput(request.body.SOI);
    var SOR = sanitizeInput(request.body.SOR);
    var SOD = sanitizeInput(request.body.SOD);
    var virtualized = sanitizeInput(request.body.virtualized);
    var physicalCoresCount	 = sanitizeInput(request.body.physicalCoresCount);
    var physicalRAM = sanitizeInput(request.body.physicalRAM);
    var storageAmountTB	 = sanitizeInput(request.body.storageAmountTB);
    var storageType   = sanitizeInput(request.body.storageType);
    var dataCenterGeography = sanitizeInput(request.body.dataCenterGeography);
    var documenationAvailability 	 = sanitizeInput(request.body.documenationAvailability);
    var contactForDocumentation  = sanitizeInput(request.body.contactForDocumentation);
    var documentationLinkToBox = sanitizeInput(request.body.documentationLinkToBox);
    var SLA	 = sanitizeInput(request.body.SLA);
    var externalDependencies = sanitizeInput(request.body.externalDependencies);
    var regulatoryRequirements	 = sanitizeInput(request.body.regulatoryRequirements);
    var platformNames = sanitizeInput(request.body.platformNames);

    var devopsEnabled = sanitizeInput(request.body.devopsEnabled);
    var devopsTechnology = sanitizeInput(request.body.devopsTechnology);
    var devopsPossibility = sanitizeInput(request.body.devopsPossibility);
    var devopsPlan = sanitizeInput(request.body.devopsPlan);

    var dataSharedWithPartners = sanitizeInput(request.body.dataSharedWithPartners);
    var partnersInvolved = sanitizeInput(request.body.partnersInvolved);
    var dataSensitivity = sanitizeInput(request.body.dataSensitivity);
    var impactOfDataBreach = sanitizeInput(request.body.impactOfDataBreach);

    var microservicesEnabled = sanitizeInput(request.body.microservicesEnabled);
    var microservicesCount = sanitizeInput(request.body.microservicesCount);
    var microservicesTechnology = sanitizeInput(request.body.microservicesTechnology);
    var containerType = sanitizeInput(request.body.containerType);
    var clusterType = sanitizeInput(request.body.clusterType);

    var cognitiveEnabled = sanitizeInput(request.body.cognitiveEnabled);
    var cognitiveTechnology = sanitizeInput(request.body.cognitiveTechnology);
    var cognitiveDescription = sanitizeInput(request.body.cognitiveDescription);
    var voiceUi = sanitizeInput(request.body.voiceUi);
    var cognitivePlan = sanitizeInput(request.body.cognitivePlan);
    
    var keyUserPain = sanitizeInput(request.body.keyUserPain);
    var anyDowntime = sanitizeInput(request.body.anyDowntime);
    var frequentIssues = sanitizeInput(request.body.frequentIssues);
    var majorBusinessCriticalIncident = sanitizeInput(request.body.majorBusinessCriticalIncident);
    var AMSCost = sanitizeInput(request.body.AMSCost);
    var causeOfHighAMSCost = sanitizeInput(request.body.causeOfHighAMSCost);
    var costOfChange = sanitizeInput(request.body.costOfChange);
    var causeofHighCostChange = sanitizeInput(request.body.causeofHighCostChange);
    //var microservicesEnabled = sanitizeInput(request.body.microservicesEnabled);
    //var microservicesCount = sanitizeInput(request.body.microservicesCount);
    //var microservicesTechnology = sanitizeInput(request.body.microservicesTechnology);
    //var containerType = sanitizeInput(request.body.containerType);
    //var clusterType = sanitizeInput(request.body.clusterType);
    var numberOfLayers = sanitizeInput(request.body.numberOfLayers);
    var applicationLayers = sanitizeInput(request.body.applicationLayers);
    var coueplingOfLayers = sanitizeInput(request.body.coueplingOfLayers);
    var canbeBrokeninParts = sanitizeInput(request.body.canbeBrokeninParts);
    var costofBreaking = sanitizeInput(request.body.costofBreaking);
    var valueAddOfBreaking = sanitizeInput(request.body.valueAddOfBreaking);
    
	var applicationCreatedBy=sanitizeInput(request.body.applicationCreatedBy);
	var applicationCreatedOn=new Date(dt.now());
	var applicationLastModifyBy="Admin";
	var applicationLastModifyOn=new Date(dt.now());
   
   //console.log("applicationID: " + applicationID);
   //console.log("applicationType: " + type);
    var data={
    		type: "application",
    		id:id,
    		applicationName:applicationName,
    		applicationImage:applicationImage,
    		applicationID:applicationID,
    		applicationDescription:applicationDescription,
    		applicationTeamId:applicationTeamId,
    		applicationTeamName:applicationTeamName,
    		towerId:towerId,
    		accountId:accountId,
    		industryId :industryId,
    		sectorId:sectorId,
    		towerName:towerName,
    		accountName:accountName,
    		industryName:industryName,
    		sectorName:sectorName,
    		applicationSrNo	:applicationSrNo,
    			
    		applicationGroup:applicationGroup,
    		applicationTierClassification:applicationTierClassification,
    		buildVendor	:buildVendor,
    		supportQueueName	:supportQueueName,
    		confItemsInsupportGroup:confItemsInsupportGroup,
    		primarySupportPerson:primarySupportPerson,
    		SMELocation:SMELocation,

    		SMEName:SMEName,
    		SMEMailID:SMEMailID,
    		SMEContactDetails:SMEContactDetails,
    		applicationLead:applicationLead,
    		applicationLeadMailID:applicationLeadMailID,
    		applicationLeadContactNo:applicationLeadContactNo,
    		applicationManager :applicationManager,
    		applicationMgrMailID	:applicationMgrMailID,
    		applicationMgrContactNo	:applicationMgrContactNo,
    		DMName:DMName,
    		DMMailID:DMMailID,
    		DMContactNumber	:DMContactNumber,
    		onsiteBAMName:onsiteBAMName,
    		onsiteBAMMailID	:onsiteBAMMailID,
    		onsiteBAMContactNo	:onsiteBAMContactNo,
    		offshoreArchitectName:offshoreArchitectName,
    		offshoreArchitectMailID	:offshoreArchitectMailID,
    		offshoreArchitectContactNo:offshoreArchitectContactNo,
    		deliveryLeadName:deliveryLeadName,
    		deliveryLeadMailID:deliveryLeadMailID,
    		deliveryLeadContactNumber:deliveryLeadContactNumber,

    		clientDeliveryMgrName:clientDeliveryMgrName,
    		clientDeliveryMgrMailID:clientDeliveryMgrMailID,
    		clientDeliveryMgrContactNo:clientDeliveryMgrContactNo,
    		clientPortfolioMgr:clientPortfolioMgr,
    		clientPortfolioMgrMailID	:clientPortfolioMgrMailID,
    		clientPortfolioMgrContact:clientPortfolioMgrContact,
    		clientApplicationMgr:clientApplicationMgr,
    		clientApplicationMgrMailID	:clientApplicationMgrMailID,
    		clientApplicationMgrContact	:clientApplicationMgrContact,
    		clientBUILD  :clientBUILD,
    		responsibleName:responsibleName,
    		responsibleContact:responsibleContact,
    		applicationSupportScope:applicationSupportScope,

    		GTSSAMName:GTSSAMName,
    		GTSSAMMailID:GTSSAMMailID,
    		GTSSAMContactNo:GTSSAMContactNo,

    		sourceCodeAvailable:sourceCodeAvailable,
    		sourceTested:sourceTested,
    		sourceCodeServer:sourceCodeServer,
    		sourceCodeLocation:sourceCodeLocation,
    		sourceCodePath	:sourceCodePath,
    		reasonForNothavingSourceCode:reasonForNothavingSourceCode,

    		DBMSused :DBMSused,
    		DBMSVersion:DBMSVersion,
    		DBMSPlatform:DBMSPlatform,

    		AIDStatus	:AIDStatus,
    		AIDTADAvailableInOKMS:AIDTADAvailableInOKMS,

    		primarySkills	:primarySkills,
    		secondarySkill	:secondarySkill,


    		primaryConnectivity	:primaryConnectivity,
    		seconadaryConnectivity	:seconadaryConnectivity,
    		tertiaryConnectivity:tertiaryConnectivity,

    		NoofSolutionsArticles	:NoofSolutionsArticles,
    		lastReviewDateforSolutionArticle:lastReviewDateforSolutionArticle,
    		 
    		applicationAccessMode:applicationAccessMode,
    		applicationHealthMonitoringTool:applicationHealthMonitoringTool,
    		Remarks:Remarks,
    		
    		applicationNature:applicationNature,
    		applicationLocation:applicationLocation,
    		SOI:SOI, 
    		SOR:SOR, 
    		SOD:SOD, 
    		virtualized:virtualized, 
    		physicalCoresCount:physicalCoresCount,
    		physicalRAM:physicalRAM, 
    		storageAmountTB:storageAmountTB, 
    		storageType:storageType,
    		dataCenterGeography:dataCenterGeography,
    		documenationAvailability:documenationAvailability,
    		contactForDocumentation:contactForDocumentation,
    		documentationLinkToBox:documentationLinkToBox, 
    		SLA:SLA,
    		externalDependencies:externalDependencies, 
    		regulatoryRequirements:regulatoryRequirements,
    		platformNames:platformNames, 

    		devopsEnabled:devopsEnabled, 
    		devopsTechnology:devopsTechnology, 
    		devopsPossibility:devopsPossibility,
    		devopsPlan:devopsPlan, 

    		dataSharedWithPartners:dataSharedWithPartners, 
    		partnersInvolved:partnersInvolved, 
    		dataSensitivity:dataSensitivity,
    		impactOfDataBreach:impactOfDataBreach,

    		microservicesEnabled:microservicesEnabled,
    		microservicesCount:microservicesCount, 
    		microservicesTechnology:microservicesTechnology, 
    		containerType:containerType, 
    		clusterType:clusterType,

    		cognitiveEnabled:cognitiveEnabled, 
    		cognitiveTechnology:cognitiveTechnology, 
    		cognitiveDescription:cognitiveDescription, 
    		voiceUi:voiceUi,
    		cognitivePlan:cognitivePlan,
    		
    		keyUserPain:keyUserPain,
    		anyDowntime:anyDowntime,
    		frequentIssues:frequentIssues,
    		majorBusinessCriticalIncident:majorBusinessCriticalIncident,
    		AMSCost:AMSCost,
    		causeOfHighAMSCost:causeOfHighAMSCost,
    		costOfChange:costOfChange,
    		causeofHighCostChange:causeofHighCostChange,
    		/*microservicesEnabled:microservicesEnabled,
    		microservicesCount:microservicesCount,
    		microservicesTechnology:microservicesTechnology,
    		containerType:containerType,
    		clusterType:clusterType,*/
    		numberOfLayers:numberOfLayers,
    		applicationLayers:applicationLayers,
    		coueplingOfLayers:coueplingOfLayers,
    		canbeBrokeninParts:canbeBrokeninParts,
    		costofBreaking:costofBreaking,
    		valueAddOfBreaking:valueAddOfBreaking,
    		
    		applicationCreatedBy:applicationCreatedBy,
    		applicationCreatedOn:applicationCreatedOn,
    		applicationLastModifyBy:applicationLastModifyBy,
    		applicationLastModifyOn:applicationLastModifyOn
	};

    
    utilservice.process_update(response,data);

});

app.post('/api/createApplication', function(request,response) {

    console.log("Create Application Invoked..");
       
    var applicationName = sanitizeInput(request.body.applicationName);
    var applicationID = sanitizeInput(request.body.applicationID);
    var applicationDescription = sanitizeInput(request.body.applicationDescription);
    var applicationTeamId = sanitizeInput(request.body.applicationTeamId);
    var applicationTeamName = sanitizeInput(request.body.applicationTeamName);
    var towerId = sanitizeInput(request.body.towerId);
    var accountId = sanitizeInput(request.body.accountId);
    var industryId  = sanitizeInput(request.body.industryId);
    var sectorId = sanitizeInput(request.body.sectorId);
    var towerName = sanitizeInput(request.body.towerName);
    var accountName = sanitizeInput(request.body.accountName);
    var industryName  = sanitizeInput(request.body.industryName);
    var sectorName = sanitizeInput(request.body.sectorName);
    var applicationSrNo	 = sanitizeInput(request.body.applicationSrNo);
    var applicationImage = sanitizeInput(request.body.applicationImage);
    
    var applicationGroup = sanitizeInput(request.body.applicationGroup);
    var applicationTierClassification = sanitizeInput(request.body.applicationTierClassification);
    var buildVendor	 = sanitizeInput(request.body.buildVendor);
    var supportQueueName	 = sanitizeInput(request.body.supportQueueName);
    var confItemsInsupportGroup = sanitizeInput(request.body.confItemsInsupportGroup);
    var primarySupportPerson = sanitizeInput(request.body.primarySupportPerson);
    var SMELocation = sanitizeInput(request.body.SMELocation);

    var SMEName = sanitizeInput(request.body.SMEName);
    var SMEMailID = sanitizeInput(request.body.SMEMailID);
    var SMEContactDetails = sanitizeInput(request.body.SMEContactDetails);
    var applicationLead = sanitizeInput(request.body.applicationLead);
    var applicationLeadMailID = sanitizeInput(request.body.applicationLeadMailID);
    var applicationLeadContactNo = sanitizeInput(request.body.applicationLeadContactNo);
    var applicationManager  = sanitizeInput(request.body.applicationManager);
    var applicationMgrMailID	 = sanitizeInput(request.body.applicationMgrMailID);
    var applicationMgrContactNo	 = sanitizeInput(request.body.applicationMgrContactNo);
    var DMName = sanitizeInput(request.body.DMName);
    var DMMailID = sanitizeInput(request.body.DMMailID);
    var DMContactNumber	 = sanitizeInput(request.body.DMContactNumber);
    var onsiteBAMName = sanitizeInput(request.body.onsiteBAMName);
    var onsiteBAMMailID	 = sanitizeInput(request.body.onsiteBAMMailID);
    var onsiteBAMContactNo	 = sanitizeInput(request.body.onsiteBAMContactNo);
    var offshoreArchitectName = sanitizeInput(request.body.offshoreArchitectName);
    var offshoreArchitectMailID	 = sanitizeInput(request.body.offshoreArchitectMailID);
    var offshoreArchitectContactNo = sanitizeInput(request.body.offshoreArchitectContactNo);
    var deliveryLeadName = sanitizeInput(request.body.deliveryLeadName);
    var deliveryLeadMailID = sanitizeInput(request.body.deliveryLeadMailID);
    var deliveryLeadContactNumber = sanitizeInput(request.body.deliveryLeadContactNumber);

    var clientDeliveryMgrName = sanitizeInput(request.body.clientDeliveryMgrName);
    var clientDeliveryMgrMailID = sanitizeInput(request.body.clientDeliveryMgrMailID);
    var clientDeliveryMgrContactNo = sanitizeInput(request.body.clientDeliveryMgrContactNo);
    var clientPortfolioMgr = sanitizeInput(request.body.clientPortfolioMgr);
    var clientPortfolioMgrMailID	 = sanitizeInput(request.body.clientPortfolioMgrMailID);
    var clientPortfolioMgrContact = sanitizeInput(request.body.clientPortfolioMgrContact);
    var clientApplicationMgr = sanitizeInput(request.body.clientApplicationMgr);
    var clientApplicationMgrMailID	 = sanitizeInput(request.body.clientApplicationMgrMailID);
    var clientApplicationMgrContact	 = sanitizeInput(request.body.clientApplicationMgrContact);
    var clientBUILD   = sanitizeInput(request.body.clientBUILD);
    var responsibleName = sanitizeInput(request.body.responsibleName);
    var responsibleContact = sanitizeInput(request.body.responsibleContact);
    var applicationSupportScope = sanitizeInput(request.body.applicationSupportScope);

    var GTSSAMName = sanitizeInput(request.body.GTSSAMName);
    var GTSSAMMailID = sanitizeInput(request.body.GTSSAMMailID);
    var GTSSAMContactNo = sanitizeInput(request.body.GTSSAMContactNo);

    var sourceCodeAvailable = sanitizeInput(request.body.sourceCodeAvailable);
    var sourceTested = sanitizeInput(request.body.sourceTested);
    var sourceCodeServer = sanitizeInput(request.body.sourceCodeServer);
    var sourceCodeLocation = sanitizeInput(request.body.sourceCodeLocation);
    var sourceCodePath	 = sanitizeInput(request.body.sourceCodePath);
    var reasonForNothavingSourceCode = sanitizeInput(request.body.reasonForNothavingSourceCode);

    var DBMSused  = sanitizeInput(request.body.DBMSused);
    var DBMSVersion = sanitizeInput(request.body.DBMSVersion);
    var DBMSPlatform = sanitizeInput(request.body.DBMSPlatform);

    var AIDStatus	 = sanitizeInput(request.body.AIDStatus);
    var AIDTADAvailableInOKMS = sanitizeInput(request.body.AIDTADAvailableInOKMS);

    var primarySkills	 = sanitizeInput(request.body.primarySkills);
    var secondarySkill	 = sanitizeInput(request.body.secondarySkill);


    var primaryConnectivity	 = sanitizeInput(request.body.primaryConnectivity);
    var seconadaryConnectivity	 = sanitizeInput(request.body.seconadaryConnectivity);
    var tertiaryConnectivity = sanitizeInput(request.body.tertiaryConnectivity);

    var NoofSolutionsArticles	 = sanitizeInput(request.body.NoofSolutionsArticles);
    var lastReviewDateforSolutionArticle = sanitizeInput(request.body.lastReviewDateforSolutionArticle);
     
    var applicationAccessMode = sanitizeInput(request.body.applicationAccessMode);
    var applicationHealthMonitoringTool = sanitizeInput(request.body.applicationHealthMonitoringTool);
    var Remarks = sanitizeInput(request.body.Remarks);
    
    var applicationNature  = sanitizeInput(request.body.applicationNature);
    var applicationLocation = sanitizeInput(request.body.applicationLocation);
    var SOI = sanitizeInput(request.body.SOI);
    var SOR = sanitizeInput(request.body.SOR);
    var SOD = sanitizeInput(request.body.SOD);
    var virtualized = sanitizeInput(request.body.virtualized);
    var physicalCoresCount	 = sanitizeInput(request.body.physicalCoresCount);
    var physicalRAM = sanitizeInput(request.body.physicalRAM);
    var storageAmountTB	 = sanitizeInput(request.body.storageAmountTB);
    var storageType   = sanitizeInput(request.body.storageType);
    var dataCenterGeography = sanitizeInput(request.body.dataCenterGeography);
    var documenationAvailability 	 = sanitizeInput(request.body.documenationAvailability);
    var contactForDocumentation  = sanitizeInput(request.body.contactForDocumentation);
    var documentationLinkToBox = sanitizeInput(request.body.documentationLinkToBox);
    var SLA	 = sanitizeInput(request.body.SLA);
    var externalDependencies = sanitizeInput(request.body.externalDependencies);
    var regulatoryRequirements	 = sanitizeInput(request.body.regulatoryRequirements);
    var platformNames = sanitizeInput(request.body.platformNames);

    var devopsEnabled = sanitizeInput(request.body.devopsEnabled);
    var devopsTechnology = sanitizeInput(request.body.devopsTechnology);
    var devopsPossibility = sanitizeInput(request.body.devopsPossibility);
    var devopsPlan = sanitizeInput(request.body.devopsPlan);

    var dataSharedWithPartners = sanitizeInput(request.body.dataSharedWithPartners);
    var partnersInvolved = sanitizeInput(request.body.partnersInvolved);
    var dataSensitivity = sanitizeInput(request.body.dataSensitivity);
    var impactOfDataBreach = sanitizeInput(request.body.impactOfDataBreach);

    var microservicesEnabled = sanitizeInput(request.body.microservicesEnabled);
    var microservicesCount = sanitizeInput(request.body.microservicesCount);
    var microservicesTechnology = sanitizeInput(request.body.microservicesTechnology);
    var containerType = sanitizeInput(request.body.containerType);
    var clusterType = sanitizeInput(request.body.clusterType);

    var cognitiveEnabled = sanitizeInput(request.body.cognitiveEnabled);
    var cognitiveTechnology = sanitizeInput(request.body.cognitiveTechnology);
    var cognitiveDescription = sanitizeInput(request.body.cognitiveDescription);
    var voiceUi = sanitizeInput(request.body.voiceUi);
    var cognitivePlan = sanitizeInput(request.body.cognitivePlan);
    
    var keyUserPain = sanitizeInput(request.body.keyUserPain);
    var anyDowntime = sanitizeInput(request.body.anyDowntime);
    var frequentIssues = sanitizeInput(request.body.frequentIssues);
    var majorBusinessCriticalIncident = sanitizeInput(request.body.majorBusinessCriticalIncident);
    var AMSCost = sanitizeInput(request.body.AMSCost);
    var causeOfHighAMSCost = sanitizeInput(request.body.causeOfHighAMSCost);
    var costOfChange = sanitizeInput(request.body.costOfChange);
    var causeofHighCostChange = sanitizeInput(request.body.causeofHighCostChange);
    //var microservicesEnabled = sanitizeInput(request.body.microservicesEnabled);
    //var microservicesCount = sanitizeInput(request.body.microservicesCount);
    //var microservicesTechnology = sanitizeInput(request.body.microservicesTechnology);
    //var containerType = sanitizeInput(request.body.containerType);
    //var clusterType = sanitizeInput(request.body.clusterType);
    var numberOfLayers = sanitizeInput(request.body.numberOfLayers);
    var applicationLayers = sanitizeInput(request.body.applicationLayers);
    var coueplingOfLayers = sanitizeInput(request.body.coueplingOfLayers);
    var canbeBrokeninParts = sanitizeInput(request.body.canbeBrokeninParts);
    var costofBreaking = sanitizeInput(request.body.costofBreaking);
    var valueAddOfBreaking = sanitizeInput(request.body.valueAddOfBreaking);
    
	var applicationCreatedBy=sanitizeInput(request.body.applicationCreatedBy);
	var applicationCreatedOn=new Date(dt.now());
	var applicationLastModifyBy="Admin";
	var applicationLastModifyOn=new Date(dt.now());
   
   //console.log("applicationID: " + applicationID);
   //console.log("applicationType: " + type);
    var data={
    		type: "application",
    		
    		applicationName:applicationName,
    		applicationImage:applicationImage,
    		applicationID:applicationID,
    		applicationDescription:applicationDescription,
    		applicationTeamId:applicationTeamId,
    		applicationTeamName:applicationTeamName,
    		towerId:towerId,
    		accountId:accountId,
    		industryId :industryId,
    		sectorId:sectorId,
    		towerName:towerName,
    		accountName:accountName,
    		industryName :industryName,
    		sectorName:sectorName,
    		applicationSrNo	:applicationSrNo,
    			
    		applicationGroup:applicationGroup,
    		applicationTierClassification:applicationTierClassification,
    		buildVendor	:buildVendor,
    		supportQueueName	:supportQueueName,
    		confItemsInsupportGroup:confItemsInsupportGroup,
    		primarySupportPerson:primarySupportPerson,
    		SMELocation:SMELocation,

    		SMEName:SMEName,
    		SMEMailID:SMEMailID,
    		SMEContactDetails:SMEContactDetails,
    		applicationLead:applicationLead,
    		applicationLeadMailID:applicationLeadMailID,
    		applicationLeadContactNo:applicationLeadContactNo,
    		applicationManager :applicationManager,
    		applicationMgrMailID	:applicationMgrMailID,
    		applicationMgrContactNo	:applicationMgrContactNo,
    		DMName:DMName,
    		DMMailID:DMMailID,
    		DMContactNumber	:DMContactNumber,
    		onsiteBAMName:onsiteBAMName,
    		onsiteBAMMailID	:onsiteBAMMailID,
    		onsiteBAMContactNo	:onsiteBAMContactNo,
    		offshoreArchitectName:offshoreArchitectName,
    		offshoreArchitectMailID	:offshoreArchitectMailID,
    		offshoreArchitectContactNo:offshoreArchitectContactNo,
    		deliveryLeadName:deliveryLeadName,
    		deliveryLeadMailID:deliveryLeadMailID,
    		deliveryLeadContactNumber:deliveryLeadContactNumber,

    		clientDeliveryMgrName:clientDeliveryMgrName,
    		clientDeliveryMgrMailID:clientDeliveryMgrMailID,
    		clientDeliveryMgrContactNo:clientDeliveryMgrContactNo,
    		clientPortfolioMgr:clientPortfolioMgr,
    		clientPortfolioMgrMailID	:clientPortfolioMgrMailID,
    		clientPortfolioMgrContact:clientPortfolioMgrContact,
    		clientApplicationMgr:clientApplicationMgr,
    		clientApplicationMgrMailID	:clientApplicationMgrMailID,
    		clientApplicationMgrContact	:clientApplicationMgrContact,
    		clientBUILD  :clientBUILD,
    		responsibleName:responsibleName,
    		responsibleContact:responsibleContact,
    		applicationSupportScope:applicationSupportScope,

    		GTSSAMName:GTSSAMName,
    		GTSSAMMailID:GTSSAMMailID,
    		GTSSAMContactNo:GTSSAMContactNo,

    		sourceCodeAvailable:sourceCodeAvailable,
    		sourceTested:sourceTested,
    		sourceCodeServer:sourceCodeServer,
    		sourceCodeLocation:sourceCodeLocation,
    		sourceCodePath	:sourceCodePath,
    		reasonForNothavingSourceCode:reasonForNothavingSourceCode,

    		DBMSused :DBMSused,
    		DBMSVersion:DBMSVersion,
    		DBMSPlatform:DBMSPlatform,

    		AIDStatus	:AIDStatus,
    		AIDTADAvailableInOKMS:AIDTADAvailableInOKMS,

    		primarySkills	:primarySkills,
    		secondarySkill	:secondarySkill,


    		primaryConnectivity	:primaryConnectivity,
    		seconadaryConnectivity	:seconadaryConnectivity,
    		tertiaryConnectivity:tertiaryConnectivity,

    		NoofSolutionsArticles	:NoofSolutionsArticles,
    		lastReviewDateforSolutionArticle:lastReviewDateforSolutionArticle,
    		 
    		applicationAccessMode:applicationAccessMode,
    		applicationHealthMonitoringTool:applicationHealthMonitoringTool,
    		Remarks:Remarks,
    		
    		applicationNature:applicationNature,
    		applicationLocation:applicationLocation,
    		SOI:SOI, 
    		SOR:SOR, 
    		SOD:SOD, 
    		virtualized:virtualized, 
    		physicalCoresCount:physicalCoresCount,
    		physicalRAM:physicalRAM, 
    		storageAmountTB:storageAmountTB, 
    		storageType:storageType,
    		dataCenterGeography:dataCenterGeography,
    		documenationAvailability:documenationAvailability,
    		contactForDocumentation:contactForDocumentation,
    		documentationLinkToBox:documentationLinkToBox, 
    		SLA:SLA,
    		externalDependencies:externalDependencies, 
    		regulatoryRequirements:regulatoryRequirements,
    		platformNames:platformNames, 

    		devopsEnabled:devopsEnabled, 
    		devopsTechnology:devopsTechnology, 
    		devopsPossibility:devopsPossibility,
    		devopsPlan:devopsPlan, 

    		dataSharedWithPartners:dataSharedWithPartners, 
    		partnersInvolved:partnersInvolved, 
    		dataSensitivity:dataSensitivity,
    		impactOfDataBreach:impactOfDataBreach,

    		microservicesEnabled:microservicesEnabled,
    		microservicesCount:microservicesCount, 
    		microservicesTechnology:microservicesTechnology, 
    		containerType:containerType, 
    		clusterType:clusterType,

    		cognitiveEnabled:cognitiveEnabled, 
    		cognitiveTechnology:cognitiveTechnology, 
    		cognitiveDescription:cognitiveDescription, 
    		voiceUi:voiceUi,
    		cognitivePlan:cognitivePlan,
    		
    		keyUserPain:keyUserPain,
    		anyDowntime:anyDowntime,
    		frequentIssues:frequentIssues,
    		majorBusinessCriticalIncident:majorBusinessCriticalIncident,
    		AMSCost:AMSCost,
    		causeOfHighAMSCost:causeOfHighAMSCost,
    		costOfChange:costOfChange,
    		causeofHighCostChange:causeofHighCostChange,
    		/*microservicesEnabled:microservicesEnabled,
    		microservicesCount:microservicesCount,
    		microservicesTechnology:microservicesTechnology,
    		containerType:containerType,
    		clusterType:clusterType,*/
    		numberOfLayers:numberOfLayers,
    		applicationLayers:applicationLayers,
    		coueplingOfLayers:coueplingOfLayers,
    		canbeBrokeninParts:canbeBrokeninParts,
    		costofBreaking:costofBreaking,
    		valueAddOfBreaking:valueAddOfBreaking,
    		
    		applicationCreatedBy:applicationCreatedBy,
    		applicationCreatedOn:applicationCreatedOn,
    		applicationLastModifyBy:applicationLastModifyBy,
    		applicationLastModifyOn:applicationLastModifyOn
	};

    utilservice.process_save(response,data);

});

app.get('/api/getApplicationbyTeamId',function(request,response){
	 var id = sanitizeInput(request.query.id);
	 
	 var data={
			 id:id
	 };
	 
	 applicationservice.process_getApplicationByTeamId(response,data);
	 
});

app.get('/api/getApplicationbyTeamWithApplicationGroup',function(request,response){
	 var id = sanitizeInput(request.query.id);
	 
	 var data={
			 id:id
	 };
	 
	 applicationservice.process_getApplicationbyTeamWithApplicationGroup(response,data);
	 
});

app.get('/api/getCount',function(request,response){
	  
	utilservice.process_getCount(response);
	 
});

/*app.get('/api/getAduitRecordForUser',function(request,response){
	  
 var id = sanitizeInput(request.query.id);
	 
	 var data={
			 id:id
	 };
	userservice.process_getAduitRecordForUser(response,data);
	 
});*/

app.get('/api/getApplicationDetails',function(request,response){
	 var towerId = sanitizeInput(request.query.towerId);
	 var accountId= sanitizeInput(request.query.accountId);
	 var applicationTeamId = sanitizeInput(request.query.applicationTeamId);
	 var applicationID=sanitizeInput(request.query.applicationID);
	 var data={
			 towerId:towerId,
			 accountId:accountId,
			 applicationTeamId:applicationTeamId,
			 applicationID:applicationID
	 };
	 
	 applicationservice.process_getApplicationDetails(response,data);
	 
});

app.post('/api/validateUserinfo', function(request,response) {

    console.log("validateUserinfo  Invoked..");
    console.log('Request: ' + JSON.stringify(request.headers));
    console.log('Body: ' + JSON.stringify(request.body));

   var id = sanitizeInput(request.body.userId);
   var password = sanitizeInput(request.body.password);
   var role = sanitizeInput(request.body.role);

   console.log("Id: " + id);
    var data={
    		id:id,
    		password : password,
    		role :role
	};

    userservice.process_validateUser(data, response);
});

app.get('/api/getUserAccounts', function(request,response) {

    console.log("validateUserinfo  Invoked..");
    console.log('Request: ' + JSON.stringify(request.headers));
    console.log('Body: ' + JSON.stringify(request.body));

   var id = sanitizeInput(request.query.user);
  // var password = sanitizeInput(request.body.password);

   console.log("Id: " + id);
    var data={
    		id:id
	};

    accountservice.process_getUserAccounts(data, response);
});

app.get('/api/getUserAccountsByRole', function(request,response) {

    console.log("getUserAccountsByRole  Invoked..");
    console.log('Request: ' + JSON.stringify(request.headers));
    console.log('Body: ' + JSON.stringify(request.body));

   var id = sanitizeInput(request.query.user);
   var role = sanitizeInput(request.query.role);
  // var password = sanitizeInput(request.body.password);

   console.log("Id: " + id);
    var data={
    		id:id,
    		role:role
	};

    if(role == 'superUser' || role == 'adminUser'){
    	 accountservice.process_getAccountList( response,data);	
    }
    if(role == 'normalUser' || role == 'executiveUser'){
    accountservice.process_getUserAccountsByRole(data, response);
    }
});

app.post('/api/createTeam', function(request,response) {

    console.log("Create Team Invoked..");
    console.log('Request: ' + JSON.stringify(request.headers));
    console.log('Body: ' + JSON.stringify(request.body));

   var id = request.body._id;
   var teamId = sanitizeInput(request.body.teamId);
   var teamTowerId = sanitizeInput(request.body.teamTowerId);
   var teamAccountId = sanitizeInput(request.body.teamAccountId);
   var teamTowerName = sanitizeInput(request.body.teamTowerName);
   var teamAccountName = sanitizeInput(request.body.teamAccountName);
   var teamName = sanitizeInput(request.body.teamName);
   var teamDesc = sanitizeInput(request.body.teamDesc);
   var teamLeadName = sanitizeInput(request.body.teamLeadName);
   var teamLeadEmail = sanitizeInput(request.body.teamLeadEmail);
   var teamLeadPhoneNo = sanitizeInput(request.body.teamLeadPhoneNo);
   var teamImage = sanitizeInput(request.body.teamImage);
   var teamCreatedBy=sanitizeInput(request.body.teamCreatedBy);
   var teamCreatedOn=new Date(dt.now());
   var teamLastModifyBy="Admin";
   var teamLastModifyOn=new Date(dt.now());
   console.log("teamId: " + teamId);
    var data={
    		teamTowerId:teamTowerId,
    		teamTowerName:teamTowerName,
    		teamId : teamId,
    		type:'team',
    		teamAccountId: teamAccountId,
    		teamAccountName: teamAccountName,
    		teamName:teamName,
    		teamDesc:teamDesc,
    		teamLeadName:teamLeadName,
    		teamLeadPhoneNo:teamLeadPhoneNo,
    		teamCreatedBy:teamCreatedBy,
    		teamCreatedOn:teamCreatedOn,
    		teamLastModifyBy:teamLastModifyBy,
    		teamLastModifyOn:teamLastModifyOn,
    		teamImage:teamImage,
    		teamLeadEmail:teamLeadEmail
	};

    utilservice.process_save(response,data);
});


app.put('/api/updateTeam', function(request, response) {

    console.log("Update Invoked for Team..");
    var id=sanitizeInput(request.body._id);
    var teamId = sanitizeInput(request.body.teamId);
    var teamTowerId = sanitizeInput(request.body.teamTowerId);
    var teamAccountId = sanitizeInput(request.body.teamAccountId);
    var teamName = sanitizeInput(request.body.teamName);
    var teamLeadName = sanitizeInput(request.body.teamLeadName);
    var teamImage = sanitizeInput(request.body.teamImage);
    var teamCreatedBy=sanitizeInput(request.body.teamCreatedBy);
    var teamCreatedOn=sanitizeInput(request.body.teamCreatedOn);
    var teamLastModifyBy="Admin";
    var teamLastModifyOn=new Date(dt.now()); 
    var teamLeadEmail = sanitizeInput(request.body.teamLeadEmail); 
    var teamDesc = sanitizeInput(request.body.teamDesc);
    var teamLeadPhoneNo = sanitizeInput(request.body.teamLeadPhoneNo);
    var teamTowerName = sanitizeInput(request.body.teamTowerName);
    var teamAccountName = sanitizeInput(request.body.teamAccountName);
    var data={
            id:id,
            teamTowerId:teamTowerId,
            teamTowerName:teamTowerName,
            teamAccountName:teamAccountName,
    		teamId : teamId,
    		teamLeadEmail:teamLeadEmail,
    		teamDesc:teamDesc,
    		teamLeadPhoneNo:teamLeadPhoneNo,
    		teamAccountId: teamAccountId,
    		teamName:teamName,
    		teamLeadName:teamLeadName,
    		type:"team",
    		teamCreatedBy:teamCreatedBy,
    		teamLastModifyBy:teamLastModifyBy,
    		teamLastModifyOn:teamLastModifyOn,
    		teamCreatedOn:teamCreatedOn,
    		teamImage:teamImage
	};
    utilservice.process_update(response,data);
    });

app.delete('/api/delete', function(request, response) {

    console.log("Delete Invoked..");
    var id = request.query.id;
    // var rev = request.query.rev; // Rev can be fetched from request. if
    // needed, send the rev from client
    console.log("Removing document of ID: " + id);
    console.log('Request Query: ' + JSON.stringify(request.query));

    db.get(id, {
        revs_info: true
    }, function(err, doc) {
        if (!err) {
            db.destroy(doc._id, doc._rev, function(err, res) {
                // Handle response
                if (err) {
                    console.log(err);
                    response.sendStatus(500);
                } else {
                    response.sendStatus(200);
                }
            });
        }
    });

});

app.put('/api/favorites', function(request, response) {

    console.log("Update Invoked..");

    var id = request.body.id;
    var name = sanitizeInput(request.body.name);
    var value = sanitizeInput(request.body.value);

    console.log("ID: " + id);

    db.get(id, {
        revs_info: true
    }, function(err, doc) {
        if (!err) {
            console.log(doc);
            doc.name = name;
            doc.value = value;
            db.insert(doc, doc.id, function(err, doc) {
                if (err) {
                    console.log('Error inserting data\n' + err);
                    return 500;
                }
                return 200;
            });
        }
    });
});



app.get('/api/favorites', function(request, response) {

    console.log("Get method invoked.. ")

    db = cloudant.use(dbCredentials.dbName);
    var docList = [];
    var i = 0;
    db.list(function(err, body) {
        if (!err) {
            var len = body.rows.length;
            console.log('total # of docs -> ' + len);
            if (len == 0) {
                // push sample data
                // save doc
                var accountId = 'sample_id';
                var accountType = 'A sample Type';
                db.insert({
                	accountId: accountId,
                	accountType: 'A sample Type'
                }, '', function(err, doc) {
                    if (err) {
                        console.log(err);
                    } else {

                        console.log('Document : ' + JSON.stringify(doc));
                        var responseData = createResponseData(
                            //doc.id,
                            accountId,
                            accountType, []);
                        docList.push(responseData);
                        response.write(JSON.stringify(docList));
                        console.log(JSON.stringify(docList));
                        console.log('ending response...');
                        response.end();
                    }
                });
            } else {

                body.rows.forEach(function(document) {

                    db.get(document.id, {
                        revs_info: true
                    }, function(err, doc) {
                        if (!err) {
                            if (doc['_attachments']) {

                                var attachments = [];
                                for (var attribute in doc['_attachments']) {

                                    if (doc['_attachments'][attribute] && doc['_attachments'][attribute]['content_type']) {
                                        attachments.push({
                                            "key": attribute,
                                            "type": doc['_attachments'][attribute]['content_type']
                                        });
                                    }
                                    console.log(attribute + ": " + JSON.stringify(doc['_attachments'][attribute]));
                                }
                                var responseData = createResponseData(
                                    doc._id,
                                    doc.name,
                                    doc.value,
                                    attachments);

                            } else {
                                var responseData = createResponseData(
                                    doc._id,
                                    doc.name,
                                    doc.value, []);
                            }

                            docList.push(responseData);
                            i++;
                            if (i >= len) {
                                response.write(JSON.stringify(docList));
                                console.log('ending response...');
                                response.end();
                            }
                        } else {
                            console.log(err);
                        }
                    });

                });
            }

        } else {
            console.log(err);
        }
    });

});


http.createServer(app).listen(app.get('port'), '0.0.0.0', function() {
    console.log('Express server listening on port ' + app.get('port'));
});
