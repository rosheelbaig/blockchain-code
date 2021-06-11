const express = require('express');
const bodyParser = require('body-parser');
const DB = require('./model/db');
var cors = require('cors');
const indexRouter = require('./routes/indexRouter');
const config = require('./config/configBasic');
const upload = require('express-fileupload');
const querystring = require('querystring');
var path = require('path');
const app = express();

app.use('/public', express.static('public'));
app.use(express.static(path.join(__dirname, 'public')));
//File Upload Middleware
app.use(upload());

//Init Middleware
app.use(express.urlencoded({ limit: '10mb', extended: false }));
app.use(express.json({ limit: '10mb', extended: true }));

//Body Parser
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.use(cors());

//routes middleware
app.get('/', (req, res) => {
  res.send('API Server is running');
});
app.use('/', indexRouter);

app.use((req, res) => {
  res.status(404).send();
});

app.listen(config.port, function () {
  console.log('Node app is running on port: ', config.port);
});

module.exports = app;
