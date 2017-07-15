
var randomstring = require("randomstring");

module.exports = function(mysqlPool, config, oauth2Client) {


    /**
     * User constructor
     * 
     * @param {int} id 
     * @param {string} display_name 
     * @param {any} tokens 
     */
    function User(id, display_name,tokens) {
        this.id = id;
        this.display_name = display_name;
        this.tokens = tokens;  
        // this.socketAuth = null; 

        this.socket = null;

        // create a new array so it is not shared among instances
        this.groups = [];
    }

    User.prototype = {
        
        /**
         * Update user name
         * 
         * @param {string} newName 
         * @param {function(err, success)} callBack 
         */
        updateName: function(newName, callBack) {
            // escape the name to avoid js injection
            mysqlPool.getConnection((err, connection) => {
                connection.query('update users set display_name = ? where id = ?', [newName, this.id], (err) => {
                    connection.release();
                    if (err) {
                        callBack(err, false);
                    }
                    var x = this;
                    this.display_name = newName;
                    //this.updateCache();
                    callBack(null, true);
                })

            })
        },
        
        /**
         * Generate a socket token
         * 
         * @returns {String} socketToken
         */
        generateSocketAuth: function() {
            var auth = randomstring.generate(100);
            this.socketAuth = {
                auth: auth,
                // take the time at the current location, to make sockets time out after a certain amount of time.
                valid_until: Date.now() + 5000
            };
            return auth;
        },
        



        /**
         * emit event 
         * 
         * @param {string} event 
         * @param {any} data 
         */
        emit: function(event, data) {
            if (this.socket) {
                this.socket.emit(event, data);
            }
        },


        /**
         * Attach socket to user
         * Allows to send messages to user.
         * 
         * @param {Socket} socket 
         */
        attachSocket: function(socket) {
            this.socket = socket;

            this.groups.forEach(function(group) {
                // give every group a chance to re attach their socket listeners
                group.addUser(this);
            }, this);

            socket.on('disconnect', () => {
                if (this.socket === socket) {
                    this.socket = null;
                }
            })
        },

        groups: [],

        addToGroup: function(group) {
            if(this.groups.indexOf(group) === -1) {
                this.groups.push(group);
                // create a two way relationship to the group
                group.addUser(this);
            }
        },

        removeFromGroup: function(group) {
            var index = this.groups.indexOf(group);
            console.log("groups", this.groups);
            if(index != -1) {
                this.groups.splice(index, 1);
                // end the two way relationship to the group
                group.removeUser(this);
            }
        },


    }

    return User;
}