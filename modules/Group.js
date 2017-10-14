var Group = Group || (function() {
    class Group {
        constructor() {
            // create a new array so it is not shared among instances
            this.users = [];
            // store the bound socket functions
            this.boundFunctions = {};
            // since we use bind to pass in the user, each function is unique which means we have to store the funcion for every user.
            // stored like [event][user.id]
            this.userBoundFunctions ={};
            // default filter
            this.filter = {};
        }

        


        /**
         * Add user to the group, and add any socket bindings for the group
         * 
         * @param {User} user 
         */
        addUser(user) {
            if(this.containsUser(user)) {
                // if the user is already added then do nothing 
                return;
            }
            this.users.push(user);
            // create a two way relationship to the user
            user.addToGroup(this);

            for	(var key in this.boundFunctions) {
                // var boundFunction = this.boundFunctions[key];
                // user.socket.on(key, boundFunction.bind(user));
                this.bindEventToUser(key,user);
            }
        }

        /**
         * Used internally to reduce redundancy. Binds a event to a user
         * 
         * @param {string} eventName 
         * @param {User} user 
         */
        bindEventToUser(eventName, user) {
            var boundFunction = this.boundFunctions[eventName];
            if(typeof boundFunction === "undefined") {
                throw "The function you are trying to bind is not defined yet."
            }

            if(typeof this.userBoundFunctions[eventName] === "undefined") {
                this.userBoundFunctions[eventName] = {};
            }
            
            var userBoundFunction = this.userBoundFunctions[eventName][user.id]
            
            if (!userBoundFunction) {
                // check if the function already exists and if doesn't create it     
                userBoundFunction = boundFunction.bind(user);
                
                this.userBoundFunctions[eventName][user.id] = userBoundFunction;
            }

            // user.socket.on(eventName,userBoundFunction);
            user.bindEvent(eventName, userBoundFunction);
        }

        /**
         * Used internally to reduce redundancy. Removes a event from a user
         * 
         * @param {any} event 
         * @param {any} user 
         * @returns 
         */
        unbindEventFromUser(event, user) {
            if(!(this.userBoundFunctions[event] && this.userBoundFunctions[event][user.id])) {
                // don't do anything if the function does not exist for the user
                return;
            }

            // if(user && user.socket) {
            //     user.socket.removeListener(event, this.userBoundFunctions[event][user.id]);
            // }
            user.unbindEventFromUser(event, this.userBoundFunction[event]);
            // delete the function regardless if the user is there or not, because if the user is not connected it is no longer relevant anyway 
            delete this.userBoundFunctions[event][user.id]
            
        }

        /**
         * Remove user from the group and optionally remove socket bindings
         * 
         * @param {User} user 
         * @param {Boolean} keepBindings 
         */
        removeUser(user, keepBindings) {
            var index = this.users.indexOf(user);
            if(index != -1) {
                this.users.splice(index, 1);
                // end the two way relationship to the user
                user.removeFromGroup(this);
            }

            if (keepBindings !== true && typeof user.socket === "object") {
                // if removeBindings is true remove all socket bindings
                for (var event in this.boundFunctions) {
                    // var boundFunction = this.boundFunctions[event];
                    // if (typeof user.socket === "object" && typeof user.socket.removeListener !== "undefined") {
                    //     user.socket.removeListener(event, boundFunction);
                    //     // this.manuallyRemoveEvent(user, event, boundFunction)   
                    // }
                    this.unbindEventFromUser(event, user);
                }
            }
        }

        // /**
        //  * Since the event listener does not actually remove events i implemented it myself
        //  * 
        //  * @param {User} user 
        //  * @param {String} event 
        //  * @param {Function} boundFunction 
        //  */
        // manuallyRemoveEvent: function(user, event, boundFunction) {
        //     if(user && typeof user.socket == "object") {
        //         var events = user.socket._events;
        //         var boundEvent = events[event];
        //         if(boundEvent === boundFunction){
        //             delete events[boundEvent];
        //         } else if(typeof boundEvent === "object" && boundEvent.constructor === Array && boundEvent.indexOf(boundFunction) != -1){
        //             var index = boundEvent.indexOf(boundFunction);
        //             boundEvent.splice(index, 1);
        //             if(boundEvent.length === 1) {
        //                 events[event] = boundEvent[0];
        //             }
        //         }
        //     }
        // },


        /**
         * check if this has a user
         * 
         * @param {User} user
         * @return {boolean}
         */
        containsUser(user) {
            return this.users.indexOf(user) !== -1;
        }


        /**
         * bind callback to socket event
         * "this" is bound to the person sending the event 
         * 
         * @param {string} event 
         * @param {callback} response 
         */
        on(event, response) {
            
            this.boundFunctions[event] = response;
            // bind the event on every user socket
            for (var key in this.users ) {
                var user = this.users[key];
                // if (user.socket) {
                //     user.socket.on(event, response.bind(user));
                // }
                this.bindEventToUser(event, user);
            }
        }

        /**
         * Unbind specific event
         * 
         * @param {string} event 
         */
        off(event) {
            var boundFunction = this.boundFunctions[event]

            this.users.forEach(function(user){
                // user.socket.removeListener(event, boundFunction);
                // this.manuallyRemoveEvent(user, event, boundFunction);
                user.unbindEventFromUser(event,user);
            }, this)
        }

        /**
         * emit event to every user in group
         * 
         * @param {string} event 
         * @param {any} data 
         */
        emit(event, data, filter) {
            if (typeof filter == "undefined") {
<<<<<<< HEAD
=======
                // default the filter it was not defined
>>>>>>> c2938d6dcf52c6b34cee8d1240bd594695049471
                filter = this.filter;
            }
            this.users.forEach(function(user) {
                user.emit(event, data, filter);
            }, this);
        }

        /**
         * Transfers all members from this group to another
         * 
         * @param {Group} otherGroup 
         */
        transferToGroup(otherGroup) {
            for (var index = this.users.length-1; index >= 0 ; index--) {
                var user = this.users[index];
                user.removeFromGroup(this);
                otherGroup.addUser(user);
            }
        }

        /**
         * Disband the group, remove all users from the group
         * 
         */
        disband() {
            for (var index = this.users.length-1; index >= 0 ; index--) {
                var user = this.users[index];
                user.removeFromGroup(this);
            }
        }
    }

 

    return Group;
}())


// UMD (Universal Module Definition)
;(function (root) {
    if (typeof define === 'function' && define.amd) {

        // AMD
        define([], function () {
            return Group;
        });

    } else if (typeof module !== 'undefined' && typeof exports === 'object') {

        // Node.js
        module.exports = Group;

    } else if (typeof root !== 'undefined') {

        // Global variable
        root.Group = Group;

    }
})(this);