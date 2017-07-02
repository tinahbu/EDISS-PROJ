/**
 * Created by Tina on 6/10/17.
 */
var express = require('express');
var bodyParser = require('body-parser');
var cookieParser = require('cookie-parser');
var DB = require('../DB.js');

var router = express.Router();
var config = require('../config');
var auth = require('./authenticator.js');

router.use(bodyParser.json());
router.use(bodyParser.urlencoded({ extended: false}));
router.use(cookieParser());

router.post('/registerUser', auth.ensureValidInput, function(req, res) {
    // If not all fields are provided
    if(Object.keys(req.body).length !== 9) {
        res.send({"message": "The input you provided is not valid"});
        console.log("Not all required information is provided");
    } else {
        var col = "(fname, lname, address, city, state, zip, email, username, password)";
        var values = "(";
        for (var key in req.body) {
            values += `"${req.body[key]}", `;
        }
        values = values.substring(0, values.length-2);
        values += ")";
        // var values = `("${req.body.fname}", "${req.body.lname}", "${req.body.address}", "${req.body.city}", "${req.body.state}", "${req.body.zip}", "${req.body.email}", "${req.body.username}", "${req.body.password}")`;
        var sql = `INSERT INTO ${config.user_table} ${col} VALUES ${values};`;

        // Create new user into db
        DB.insert(sql, function(err, result) {
            if(err){       
                if (err.code === 'ER_DUP_ENTRY') {
                    console.log(`Duplicate username already existed, please choose another one`);
                    res.send({"message": "The information you provided is not valid"});
                } else console.log(err);
            }
            else if(result.affectedRows === 1){
                res.send({"message": `${req.body.fname} was registered successfully`});
                console.log(`1 new user registered, first name is ${req.body.fname}`);
            }
        });
    }
});

router.post('/updateInfo', auth.ensureLoggedIn, auth.ensureValidInput, function(req, res, next)  {
    var sess = req.session;
    var new_username = sess.user_name;
    console.log("Information to be updated: ", req.body, Object.keys(req.body).length);

    if(Object.keys(req.body).length > 0) {
        // Construct the SQL query
        var set = "";
        Object.keys(req.body).forEach(function(key) {
            set += `${key} = "${req.body[key]}", `;
            if(key === 'username') new_username = req.body[key];
        });
        set = set.slice(0, set.length - 2);
        var update = `UPDATE ${config.user_table} SET ${set} WHERE username = "${sess.user_name}";`

        // Handle username Duplication Entry error if user wants to update to an existing username
        DB.insert(update, function(err, result) {
            if (err) {
                if (err.code === 'ER_DUP_ENTRY') {
                    console.log(`ER_DUP_ENTRY for username detected, your username is still: ${sess.user_name}`);
                    res.send({"message": "The information you provided is not valid"});
                } else console.log(err);
            } else if (result.affectedRows === 1) {
                sess.user_name = new_username;
                var select = `SELECT fname FROM ${config.user_table} WHERE username = "${sess.user_name}";`;
                DB.query(select, function (err, rows) {
                    if (err) console.log(err);
                    else {
                        var string = JSON.stringify(rows);
                        var json = JSON.parse(string);
                        console.log(json.length);
                        if (json.length === 1) {
                            res.send({"message": `${json[0].fname} your information was successfully updated`});
                            console.log(`${json[0].fname} your information was successfully updated`);
                        }
                    }
                });
            }
        });
    } else {
        // no parameters passed
        res.send({"message": "The information you provided is not valid"});
    }
});

router.post('/viewUsers', auth.ensureAdmin, auth.ensureValidInput, function(req, res, next){
    var sess = req.session;

    // query db for user info

    var query = `SELECT fname, lname, username FROM ${config.user_table}`;
    if(typeof req.body.fname !== "undefined") {
        query += ` WHERE fname = "${req.body.fname}"`;
        if(typeof req.body.lname !== "undefined") query += ` AND lname = "${req.body.lname}";`;
        else query += ";";
    } else {
        if(typeof req.body.lname !== "undefined") query += ` WHERE lname = "${req.body.lname}"`;
        else query += ";";
    }
    console.log(query);

    DB.query(query, function(err, rows) {
        if(err) console.log(err);
        else {
            var string = JSON.stringify(rows);
            var json = JSON.parse(string);
            if(json.length === 0) {
                res.send({"message": "There are no users that match that criteria"});
            } else if (json.length > 0) {
                console.log(json.length + " users matched conditions found: " + json);
                res.send({"message": "The action was successful", "user": json});
            }
        }
    });
});

module.exports = router;