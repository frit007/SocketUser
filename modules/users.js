var google = require('googleapis');
var OAuth2 = google.auth.OAuth2;

var randomstring = require("randomstring");

var plus = google.plus('v1');

// stores user profiles where the key is the client cookie
var cachedUsers = {};

// requires node js
module.exports = function(mysqlPool, config) {

	var oauth2Client = new OAuth2(
		config.googleOauth.clientId,
		config.googleOauth.clientSecret,
		config.serverName + "/auth/oauthcallback"
	);
	
	var scopes = [
	  'https://www.googleapis.com/auth/plus.me',
	  'https://www.googleapis.com/auth/userinfo.profile'
	  // 'https://www.googleapis.com/auth/calendar'

	];

	var User = require('./User')(mysqlPool, config, oauth2Client);

	var url = oauth2Client.generateAuthUrl({
		// 'online' (default) or 'offline' (gets refresh_token)
		access_type: 'offline',

		// If you only need one scope you can pass it as a string
		scope: scopes,

		// Optional property that passes state parameters to redirect URI
		// state: { foo: 'bar' }
	});

	var usersModule = {
		signIn: function(name, password) {
			// return "Simple";
			return url;
		},
		/**
		 * Get access from google
		 * 
		 * @param {string/User} userToken 
		 * @param {function} callback 
		 */
		getToken: function(userToken, callback) {
			// console.log();
			if (userToken instanceof User) {
				userToken = userToken.tokens
			}
			// currentToken = currentToken  || {};

			// oauth2Client.getToken(code, function(err, tokens) {
			// 	if (err) {
			// 		console.error(err);
			// 		throw err;
			// 	}
			// 	// if(tokens.refresh_token === undefined && currentToken.refresh_token !== undefined) {
			// 	// 	tokens.refresh_token = currentToken.refresh_token;
			// 	// }
			// 	// console.log("tokens", tokens)

			// 	callback(null, tokens);

			// 	// oauth2Client.setCredentials(tokens);
				
			// })



			oauth2Client.getToken(userToken, callback)
		},

		updateCache: function(user) {
			cachedUsers[user.secret] = user;
		},

		/**
		 * Get user from socketAuthToken
		 * returns null if there is no available user
		 * 
		 * @param {string} socketAuthToken 
		 * @returns {User} user
		 */
		getUserFromSocketAuthToken: function(socketAuthToken) {
			for(var key in cachedUsers) {
				var user = cachedUsers[key];
				if(user.authenticateSocket(socketAuthToken)) {
					return user;
				}
			}
			return null;
		},

		/**
		 * Get user from database who belong to a google id
		 * 
		 * @param {string} token 
		 * @param {function} callback 
		 * @returns 
		 */
		getUserProfile: function(token, callback) {

			createCachedUserFromProfileInfo = function(profileInfo) {

				// check if the user already exists before creating a new one
				if (cachedUsers[profileInfo.id] !== undefined) {
					cachedUsers.token = token;
					return cachedUsers[profileInfo.id];
				}

				// var secret = randomstring.generate(200);
				var user = new User(profileInfo.id, profileInfo.display_name, token);
				// user.secret = secret;

				cachedUsers[user.id] = user;

				return user;
				
			}

			if (!token) {
				callback("no_token")
				return;
			}
			// console.log("token", token);
			oauth2Client.setCredentials(token);

			plus.people.get({
			  userId: 'me',
			  auth: oauth2Client
			}, function (err, googleData) {
				// handle err and response
				if (err) {
					callback(err);
					return;
				// console.log(err);
				// throw err;
				}

				if (token.refresh_token != undefined && googleData.refresh_token === undefined) {
					googleData.refresh_token = token.refresh_token
					}
				// console.log("DATA", googleData);

				mysqlPool.getConnection((err, connection) => {
					if(err) {
						callback(err);
						return;
					}
					connection.query('SELECT display_name,id from users as u where u.google_id = ?', [googleData.id], function(err, mysqlResult, fields) {
						if (err) {
							connection.release();
							callback(err);
							return;
						}
						var profileInfo = {
							display_name: googleData.displayName,
							google_id: googleData.id,
							id: null,
						}
						if (mysqlResult.length == 1) {
							// get the display name if it exists
							profileInfo.display_name = mysqlResult[0].display_name;
							
							profileInfo.id = mysqlResult[0].id;

							connection.release();
							callback(null, createCachedUserFromProfileInfo(profileInfo));
						} else {
							// if the user profile does not yet exist create it
							connection.query('insert into users(display_name,google_id) values(?,?)', 
							[profileInfo.display_name,profileInfo.google_id],
							function(err,insertResults,fields) {
								connection.release();
								if (err) {
									callback(err);
									return;
								}
								// console.log("insertError", err);
								// console.log("insertResults",insertResults);
								profileInfo.id = insertResults.insertId;
								
								callback(null, createCachedUserFromProfileInfo(profileInfo));
							});
						}

					})
				})


			});
		},

		getUserWithId: function(userId) {
			return cachedUsers[userId];
		},
		
		updateProfile: function(token, data, callback) {

		},

		/**
		 * Loads users into cache if they are not already in it
		 * 
		 * @param {[number,...]} userIds 
		 * @param {function} callback 
		 */
		loadUsersIntoCache: function(userIds, callback) {
			mysqlPool.query("SELECT * from users where id in (?)", [userIds], function(err, rows) {
				if (err) {
					return callback(err);
				}
				var users = {};
				for (var i = 0; i < rows.length; i++) {
					var row = rows[i];
					if(typeof cachedUsers[row.id] === "undefined") {
						var user = new User(row.id, row.display_name);
						cachedUsers[user.id] = user;
					}
					// push the cached user into an array so they can be returned
					users[row.id] = cachedUsers[row.id];
				}
				callback(null, users);
			});
		},

		requireLogin: function(req, res, next) {
			
			console.log(req.session.user);

			if (typeof req.session.user === "undefined") {
				if (req.method == "GET") {
					res.redirect("/auth");				
				} else {
					res.send(400, "Not signed in")
				}
				return;
			}
			var user = cachedUsers[req.session.user.id];
			
			req.user = user;

			next();
		},

		/**
		 * Make sure the user is not able to log in twice.
		 * 
		 * @param {any} req 
		 * @param {any} res 
		 * @param {any} next 
		 */
		pickupSession: function(req, res, next) {

			if (typeof req.session.user === "undefined") {
				next();
			} else {
				var user = cachedUsers[req.session.user.id];
				
				res.redirect("/lobbies");

				next();
			}
		},

		requireSocketLogin: function(socket, next) {
					
			if (typeof socket.request.session.user === "undefined") {
				next("Not signed in", false);
			} else {
				var user = cachedUsers[socket.request.session.user.id];
				socket.user = user;

				user.attachSocket(socket);

				next();
			}


		}


	}

	return usersModule;
}