var google = require('googleapis');
var OAuth2 = google.auth.OAuth2;

var es6bindall = require("es6bindall");

var randomstring = require("randomstring");

var plus = google.plus('v1');

// stores user profiles where the key is the client cookie


// requires node js
module.exports = function(mysqlPool, sessionMiddleware, config) {

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
	class SocketUsers {
		constructor() {
			this.cachedUsers = {};
			
			// 
			es6bindall(this, ["requireLogin", "pickupSession", "requireSocketLogin"])
		}
		
		signIn(name, password) {
			// return "Simple";
			return url;
		}
		
		/**
		 * Get access from google
		 * 
		 * @param {string/User} userToken 
		 * @param {function} callback 
		 */
		getToken(userToken, callback) {
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
		}

		updateCache(user) {
			this.cachedUsers[user.secret] = user;
		}

		/**
		 * Get user from socketAuthToken
		 * returns null if there is no available user
		 * 
		 * @param {string} socketAuthToken 
		 * @returns {User} user
		 */
		getUserFromSocketAuthToken(socketAuthToken) {
			for(var key in this.cachedUsers) {
				var user = this.cachedUsers[key];
				if(user.authenticateSocket(socketAuthToken)) {
					return user;
				}
			}
			return null;
		}

		/**
		 * Get user from database who belong to a google id
		 * 
		 * @param {string} token 
		 * @param {function} callback 
		 * @returns 
		 */
		getUserProfile(token, callback) {

			const createCachedUserFromProfileInfo = (profileInfo) => {

				// check if the user already exists before creating a new one
				if (this.cachedUsers[profileInfo.id] !== undefined) {
					this.cachedUsers[profileInfo.id].token = token;
					return this.cachedUsers[profileInfo.id];
				}

				// var secret = randomstring.generate(200);
				var user = new User(profileInfo.id, profileInfo.name, token);
				// user.secret = secret;

				this.cachedUsers[user.id] = user;

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
					connection.query('SELECT name,id from users as u where u.google_id = ?', [googleData.id], function(err, mysqlResult, fields) {
						if (err) {
							connection.release();
							callback(err);
							return;
						}
						var profileInfo = {
							name: googleData.displayName,
							google_id: googleData.id,
							id: null,
						}
						if (mysqlResult.length == 1) {
							// get the display name if it exists
							profileInfo.name = mysqlResult[0].name;
							
							profileInfo.id = mysqlResult[0].id;

							connection.release();
							callback(null, createCachedUserFromProfileInfo(profileInfo));
						} else {
							// if the user profile does not yet exist create it
							connection.query('insert into users(name,google_id) values(?,?)', 
							[profileInfo.name,profileInfo.google_id],
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
		}

		getUser(user_id, callback) {
			if(this.cachedUsers[user_id]) {
				return callback(null, this.cachedUsers[user_id]);
			}

			mysqlPool.query("select * from users where id = ?",
			 [user_id], (err, result) => {
				 callback(err, result[0]);
			})
		}
		
		updateProfile(token, data, callback) {

		}

		/**
		 * Loads users into cache if they are not already in it
		 * 
		 * @param {[number,...]} userIds 
		 * @param {function} callback 
		 */
		loadUsersIntoCache(userIds, callback) {
			mysqlPool.query("SELECT * from users where id in (?)", [userIds], (err, rows) => {
				if (err) {
					return callback(err);
				}
				var users = {};
				for (var i = 0; i < rows.length; i++) {
					var row = rows[i];
					if(typeof this.cachedUsers[row.id] === "undefined") {
						var user = new User(row.id, row.name);
						this.cachedUsers[user.id] = user;
					}
					// push the cached user into an array so they can be returned
					users[row.id] = this.cachedUsers[row.id];
				}
				callback(null, users);
			});
		}

		requireLogin(req, res, next) {
			
			if (typeof req.session.user === "undefined") {
				if (req.method == "GET") {
					res.redirect("/auth");
					// next();
				} else {
					res.status(400).send("Not signed in")
				}
				return;
			}
			var user = this.cachedUsers[req.session.user.id];
			
			req.user = user;

			next();
		}

		/**
		 * Make sure the user is not able to log in twice.
		 * 
		 * @param {any} req 
		 * @param {any} res 
		 * @param {any} next 
		 */
		pickupSession(req, res, next) {
			if(config.no_network) {
				// for development without network highly insecure and limiting
				// TODO implement a more safe implementation
				// anybody could impersonate user 1 at the moment 
				// if they manage to set no_network on the config object
				mysqlPool.query("SELECT * from users where id = 1", (err, users) => {
					if(err) {next();return}
					var userRow = users[0];
					if(userRow) {
						var user = new User(userRow.id, userRow.name, "no_tokens");
						this.cachedUsers[user.id] = user;
						req.session.user = user;
					}
					res.redirect("/");
				})
				return;
			}

			if (typeof req.session.user === "undefined") {
				next();
			} else {
				var user = this.cachedUsers[req.session.user.id];
				
				res.redirect("/");
			}
		}

		requireSocketLogin(socket, next) {
					
			if (typeof socket.request.session.user === "undefined") {
				next("Not signed in", false);
			} else {
				var user = this.cachedUsers[socket.request.session.user.id];
				socket.user = user;

				user.attachSocket(socket);

				next();
			}


		}

		/**
		 * Get user session for a socket 
		 * 
		 * @param {Socket} socket 
		 * @param {callback} next 
		 */
		socketSession(socket, next) {
			sessionMiddleware(socket.request, socket.request.res, next);
		}
	}

	return new SocketUsers();
}