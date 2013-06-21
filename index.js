#!/usr/bin/env node
var smtp = require('smtp-protocol');
var http = require('http');
var cli = require('cli').enable('catchall');

var config = cli.parse({
    smtpPort:   ['s', 'SMTP port to listen on', 'number', 1025],
    httpPort:  ['h', 'HTTP port to listen on', 'number', 1080],
    whitelist: ['w','Only accept e-mails from these adresses. Accepts multiple e-mails comma-separated', 'string'],
    max: ['m','Max number of e-mails to keep','number',10]
});

var whitelist = config.whitelist != null ? config.whitelist.split(',') : [];

var mails = [];

smtp.createServer(function (req) {
    req.on('from', function (from, ack) {
        if(whitelist.length == 0 || whitelist.indexOf(from) !== -1)
        	ack.accept()
        else ack.reject()
    });

    req.on('message', function (stream, ack) {
    	var message = "";
    	
        stream.on('data',function(d) {
			message += d;
        });

        stream.on('end', function() {
        	if(message != null) {
        		var mail = {
        			to:req.to,
        			from:req.from,
        			message:message
        		};

        		cli.debug(JSON.stringify(mail));
    			
    			mails.push(mail);
    			
    			//trim list of emails if necessary
    			while(mails.length > config.max) {
    				mails.splice(1,1);
    			}
        	}
        	message = null;
        });
        ack.accept();
    });
}).listen(config.smtpPort);

http.createServer(function (req, res) {
	if(req.url == "/emails") {
		res.writeHead(200, {'Content-Type': 'application/json'});
		res.end(JSON.stringify(mails));
	} else {
		res.writeHead(404, {'Content-Type': 'text/plain'});
		res.end('Not found');
	}
  
}).listen(config.httpPort);

cli.info("SMTP server listening on port " + config.smtpPort);
cli.info("HTTP server listening on port " + config.httpPort + ", e-mails are available on /emails.");
