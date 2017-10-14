var util = require("util");
var randomstring = require("randomstring");

module.exports = function(mysqlPool, config, oauth2Client) {

    class User {
        /**
         * User constructor
         * 
         * @param {int} id 
         * @param {string} display_name 
         * @param {any} tokens 
         */
        constructor(id, display_name, tokens) {
            this.id = id;
            this.display_name = display_name;
            this.tokens = tokens;   

    //     // this.socket = null;

        this.sockets = [];

        // create a new array so it is not shared among instances
        this.groups = [];
        }
        


        /**
         * Update user name
         * 
         * @param {string} newName 
         * @param {function(err, success)} callBack 
         */
        updateName(newName, callBack) {
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
        }
        


        /**
         * emit event 
         * 
         * @param {string} event 
         * @param {any} data 
         * @param {Object} filter
         */
        emit(event, data, filter) {
            this.filteredSocketsDo(filter, function(socket) {
                socket.emit(event,data);
            })
        }


        /**
         * 
         * 
         * @param {Object} filter 
         * @param {Object} action(socket)
         */
        filteredSocketsDo(filter, action) {
            for(var i = this.sockets.length - 1; 0 <= i; i--) {
                var socket = this.sockets[i];
                if (this.matchesFilter(filter, socket)) {
                    action(socket);
                }
            }
        }


        /**
         * 
         * 
         * @param {Object} filter 
         * @param {Socket} socket 
         * @returns 
         */
        matchesFilter(filter, socket) {
            if (filter) {
                for (var filterKey in filter) {
                    var filterValue = filter[filterKey];
                    var socketRuleValue = socket[filterKey]; 
                    if(Array.isArray(socketRuleValue)) {
                        if (Array.isArray(filterValue)) {
                            var found = false;
                            for (var i = 0; i < filterValue.length; i++) {
                                var filterElement = filterValue[i];
                                if (socketRuleValue.indexOf(filterElement) !== -1) {
                                    found = true;
                                }
                            }
                            if (!found) {
                                return false;
                            }
                        } else {
                            if (socketRuleValue.indexOf(filterValue) === -1) {
                                return false;
                            }
                        }
                    } else {
                        if (Array.isArray(filterValue)) {
                            if (filterValue.indexOf(socketRuleValue) === -1) {
                                return false;
                            }
                        } else {
                            if (socketRuleValue != filterValue) {
                                return false;
                            }
                        }
                        // if it is a string value then 
                        // return filterValue === socket[filterKey];
                    }
                    
                }
            }
            return true;
            
        }

        /**
         * Attach socket to user
         * Allows to send messages to user.
         * 
         * @param {Socket} socket
         * @param {Object} filters
         */
        attachSocket(socket, filters) {

            // this.socket = socket;
            if (filters) {                
                socket = Object.assign(socket, filters);
            }

            this.groups.forEach(function(group) {
                // give every group a chance to re attach their socket listeners
                group.addUser(this);
            }, this);

            socket.on('disconnect', () => {
                if (this.socket === socket) {
                    this.socket = null;
                }
            })
        }

        hasSocket(socket) {
            return this.sockets.indexOf(socket) !== -1;
        }


        addToGroup(group) {
            if(this.groups.indexOf(group) === -1) {
                this.groups.push(group);
                // create a two way relationship to the group
                group.addUser(this);
            }
        }

        removeFromGroup(group) {
            var index = this.groups.indexOf(group);
            console.log("groups", this.groups);
            if(index != -1) {
                this.groups.splice(index, 1);
                // end the two way relationship to the group
                group.removeUser(this);
            }
        }

        bindEvent(eventName, event, filter) {
            this.filteredSocketsDo(filter, function(socket) {
                socket.on(eventName, event);
            })
        }

        unbindEvent(eventName, event, filter) {
            this.filteredSocketsDo(false, function(socket) {
                socket.removeListener(event)
            })
        }
    }

    return User;
}