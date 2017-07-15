var express = require('express');
var router = express.Router();

module.exports = function(users) {

	
	router.use(users.pickupSession);

    router.get('/', function(req, res, next) {

		
		// res.send(users.signIn());
		res.render('../routes/auth/index', { title: 'Login' });
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
			// throw err
			};

            users.getUserProfile(token,function(err, userResponse) {
                if (err) {
                    console.log("error", err);				
					res.status(500).render("error",{error: err});
					return;
                    // throw err;
                }

				// res.cookie("authentication", response.secret, {maxAge:900000, httpOnly: true});
				req.session.user = {id: userResponse.id, display_name: userResponse.display_name};
				if (!res.headersSent) {
    				res.redirect("/lobbies");
				}
            })

			// res.cookie("oauthCode",response, {maxAge:9000000, httpOnly:true});

			// res.send(response);
			// res.send("something lame");
		});

		// console.log(req.query);
		// res.send("something happend");
	})


    return router;

}