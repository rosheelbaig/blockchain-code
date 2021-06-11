const express = require('express');
const bodyParser = require('body-parser');
var cors = require('cors');
var path = require('path');
var config = require('./config/configBasic');
// const DB = require("./model/db");

const app = express();
app.use(bodyParser.json());
app.use(
  bodyParser.urlencoded({
    extended: false,
  })
);

app.use(cors());

//routes middleware
//app.use("/", indexRouter);

app.use(express.json());
app.use(
  express.urlencoded({
    extended: false,
  })
);

app.use(express.static(path.join(__dirname, 'public')));

app.use((req, res) => {
  res.status(404).send();
});

app.listen(config.port, function () {
  console.log('Node app is running on port: ', config.port);
});

module.exports = app;
