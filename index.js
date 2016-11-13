var express = require('express');
var firebase = require('firebase');
var request = require('request');
var FCM = require('fcm-node');
var cron = require('cron');
var q = require('q');
var moment = require('moment');

var serverKey = 'AIzaSyAhvHUYy5L1pTb7F-UGEnEGKbbs9vqn_BY';
var fcm = new FCM(serverKey);
var app = express();

app.set('port', (process.env.PORT || 5000));

app.listen(app.get('port'), function() {
    console.log('Listening on port', app.get('port'));
});

firebase.initializeApp({
    serviceAccount: "./MIAPP-501ddba7a6c7.json",
    databaseURL: "https://miapp-800d5.firebaseio.com/"
});

var quotesRef = firebase.database().ref("quotes/");
var usersRef = firebase.database().ref("users/");

var finalQuotes = [];


function prepareNotificationsForSend(quotes) {
    finalQuotes = [];
    var deferred = q.defer();

    for (var key in quotes) {
        if (!quotes.hasOwnProperty(key)) continue;
        finalQuotes.push(quotes[key]);
        deferred.resolve(finalQuotes);

    }
    return deferred.promise;
}

function getNotifications() {
    var deferred = q.defer();
    quotesRef.once("value")
        .then(function (snapshot) {
            var quote = snapshot.val();
            prepareNotificationsForSend(quote).then(function (data) {
                deferred.resolve(data);
            });
        });
    return deferred.promise;
}

function getUsers() {
    var users = [];
    var deferred = q.defer();
    usersRef.on("child_added", function(data) {
        users.push(data.val());
        deferred.resolve(users);
    });

    return deferred.promise;
}

function listenForNotificationRequests(now) {
    getNotifications().then(function (finalQuotes) {
        getUsers().then(function (users) {
            finalQuotes.forEach(function (notify) {
                var notifyTime = moment.unix(notify.at);
                if (notify.to !== "") {
                  users.forEach(function(user) {
                      if(user.uid === notify.author && (now.hour() === notifyTime.hour() && now.minute() === notifyTime.minute())) {
                          var notification = {
                              to: notify.to, // required fill with device token or topics
                              notification: {
                                  title: user.username,
                                  body: notify.message
                              }
                          };
                          sendNotification(notification);
                      }
                  });

                }
            })
        });
    });
}
var cronJob = cron.job('*/15 * * * * ', function () {
    var now = moment();
    console.log("cron job enter", "now:", now);
    listenForNotificationRequests(now);

 });
 cronJob.start();

function sendNotification(notification) {
    fcm.send(notification, function (err, response) {
        if (err) {
            console.log("Something has gone wrong!");
        } else {
            console.log("Successfully sent with response: ", response);
        }
    });
}


