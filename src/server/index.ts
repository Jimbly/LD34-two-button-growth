/// <reference path="../../typings/tsd.d.ts" />
import assert = require('assert');
import http = require('http');
import express = require('express');
import path = require('path');
var FileStore = require('fs-store').FileStore;

var store = new FileStore('scores.json');

// Actual app begins
var app = express();
app.get('/api/scoreget', function (req, res, next) {
  var scores = store.get('scores', {});
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(scores));
});
app.get('/api/scoreset', function (req, res, next) {
  var name = req.query.name.slice(0, 64);
  var score = Number(req.query.score) || 0;
  var scores = store.get('scores', {});
  scores[name] = Math.max(scores[name] || 0, score);
  store.set('scores', scores);
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(scores));
});
app.use(express.static(path.join(__dirname, '../client/')));

var port = process.env.port || 3000;

var server: http.Server = app.listen(port, () => {
  console.log('Running server at http://localhost:' + port);
});
