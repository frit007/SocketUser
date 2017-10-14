var express = require('express');
var router = express.Router();

module.exports = function(users) {

	// console.log(router);
	router.use(users.pickupSession);

    router.get('/', function(req, res, next) {

		// console.log("hit auth");
		// res.send(users.signIn());
		// res.send("hit auth");
		res.render('../SocketUser/views/auth/index', { title: 'Login' });
	});
	router.get('/googleUrl', function(req, res, next) {

		res.send(users.signIn());
		//res.send('respond with a resource');
	});
	router.get('/oauthcallback', function(req, res, next) {


	
		// set the cookie

		users.getToken(req.query.code, function(err, token) {
			
			if (err) {
				console.log("error",err);
				res.status(500).render({error: err});
				return;
			};

            users.getUserProfile(token,function(err, userResponse) {
                if (err) {
                    console.log("error", err);				
					res.status(500).render("error",{error: err});
					return;
                }
				req.session.user = {id: userResponse.id, name: userResponse.name};
				if (!res.headersSent) {
    				res.redirect("/");
				}
            })
		});
	})


    return router;

}