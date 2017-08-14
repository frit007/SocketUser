var util = require("util");
var randomstring = require("randomstring");

module.exports = function(mysqlPool, config, oauth2Client) {

    class User {
        /**
         * User constructor
         * 
         * @param {int} id 
         * @param {string} name 
         * @param {any} tokens 
         */
        constructor(id, name, tokens) {
            this.id = id;
            this.name = name;
            this.tokens = tokens;   

            // this.socket = null;

            this.sockets = [];

            // create a new array so it is not shared among instances
            this.groups = [];
        }
        
        getInfo() {
            return {
                id: this.id,
                name: this.name, 
            }
            
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
                connection.query('update users set name = ? where id = ?', [newName, this.id], (err) => {
                    connection.release();
                    if (err) {
                        callBack(err, false);
                    }
                    var x = this;
                    this.name = newName;
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
                    if (socket.filter) {
                        // if the socket does not have a filter then assume it does not match the filter
                        // and there is anything on the filter
                        return false;
                    }
                    var socketRuleValue = null;
                    var filterValue = filter[filterKey];
                    if (socket.filter) {
                        socketRuleValue = socket.filter[filterKey];
                    }
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
        attachSocket(socket, filters = {}) {

            // this.socket = socket;
            // if (filters) {
            //     socket = Object.assign(socket, filters);
            // }
            socket.filters = filters


            socket.updateFilter = (filter) => {
                var oldFilter = socket.filter;
                
                this.groups.forEach(function(group) {
                    var matchesNew = false;
                    var matchesOld = false;
                    if(this.matchesFilter(group.filter, {filter: oldFilter})) {
                        // check if it was accepted by the old filter
                        matchesOld = true;
                    }
                    if(this.matchesFilter(group.filter, {filter: filter})) {
                        // check if it is accepted by the new filter
                        matchesNew = true;
                    }

                    if(matchesNew && !matchesOld) {
                        // the group has to be added to the socket
                        for (eventName in group.userBoundFunctions) {
                            let boundFunction = group.userBoundFunctions[eventName][this.id];

                            socket.on(boundFunction);
                        }
                    }
                    if(matchesOld && !matchesNew) {
                        // if it matched the old filter but no longer matches the new filter remove the boundFunctions
                        for (eventName in group.userBoundFunctions) {
                            let boundFunction = group.userBoundFunctions[eventName][this.id];

                            socket.off(boundFunction);
                        }
                    }
                    
                }, this);

            }

            this.sockets.push(socket);

            this.groups.forEach(function(group) {
                // give every group a chance to re attach their socket listeners
                group.addUser(this);
            }, this);

            socket.on('disconnect', () => {

                // when the socket disconnects remove it from the list
                var index = this.sockets.indexOf(socket);
                if (index != -1) {
                    this.sockets.splice(index, 1);
                }
                // if (this.socket === socket) {
                //     // this.socket = null;
                // }
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