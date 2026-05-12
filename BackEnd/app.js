var createError = require('http-errors');
var express     = require('express');
var path        = require('path');
var cookieParser= require('cookie-parser');
var logger      = require('morgan');
var cors        = require('cors');
var pinoLogger  = require('./config/logger');

var authRouter           = require('./routes/auth');
var collegesRouter       = require('./routes/colleges');
var applicationsRouter   = require('./routes/applications');
var applicationFormRouter= require('./routes/application_form');
var collegeAdminRouter   = require('./routes/college_admin');
var documentsRouter      = require('./routes/documents');
var paymentsRouter       = require('./routes/payments');
var mastersRouter        = require('./routes/masters');
var collegeUsersRouter   = require('./routes/college_users');
var notificationsRouter  = require('./routes/notifications');
var certificatesRouter   = require('./routes/certificates');
var indexRouter          = require('./routes/index');

var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

app.use(cors({
  origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : '*',
  credentials: true,
}));
app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// ── Routes ───────────────────────────────────────────────────
app.use('/',              indexRouter);
app.use('/auth',          authRouter);
app.use('/colleges',      collegesRouter);
app.use('/applications',  applicationsRouter);
app.use('/api',           applicationFormRouter);
app.use('/college-admin', collegeAdminRouter);
app.use('/payments',      paymentsRouter);
app.use('/masters',       mastersRouter);
app.use('/admin',         collegeUsersRouter);
app.use('/notifications', notificationsRouter);
app.use('/certificates',  certificatesRouter);
app.use('/',              documentsRouter);

// ── 404 handler ──────────────────────────────────────────────
app.use(function(req, res, next) {
  next(createError(404));
});

// ── Error handler ────────────────────────────────────────────
app.use(function(err, req, res, next) {
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error',
  });
});

const PORT = process.env.PORT || 8000;
const PORTLOCAL = 5000;

app.listen(PORTLOCAL, function () {
  pinoLogger.info('Server listening on :' + PORTLOCAL);
});

module.exports = app;
