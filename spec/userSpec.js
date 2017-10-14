var User = require("../modules/User")({},{},{});

var user = new User(31, "frithjof", {});

describe("User", function() {
    describe("filter function", function() {
        it("check for id", function() {
            expect(user.matchesFilter({id:31}, {id:31})).toBeTruthy();
        });
        it("check for false id", function() {
            expect(user.matchesFilter({id:31}, {id:30})).toBeFalsy();
        });
        it("check for id in array", function() {
            expect(user.matchesFilter({id:[31,51]}, {id:31})).toBeTruthy();
        });
        it("check for type in types", function() {
            expect(user.matchesFilter({type:["web", "server"]}, {type: "web"})).toBeTruthy()
        });
    })
})