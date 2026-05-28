var createError = require('http-errors');
var express     = require('express');
var path        = require('path');
var cookieParser= require('cookie-parser');
var logger      = require('morgan');
var cors        = require('cors');
var helmet      = require('helmet');
var pinoLogger  = require('./config/logger');
var { startOtpCleanup } = require('./jobs/otpCleanup');

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
var chatRouter           = require('./routes/chat');
var indexRouter          = require('./routes/index');

var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

const IS_PROD = process.env.NODE_ENV === 'production';

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }, // allow static uploads to be fetched cross-origin

  // HSTS — only meaningful over HTTPS; enforce in production
  hsts: IS_PROD
    ? { maxAge: 31536000, includeSubDomains: true, preload: true }
    : false,

  // Content Security Policy
  contentSecurityPolicy: {
    directives: {
      defaultSrc:     ["'self'"],
      scriptSrc:      ["'self'"],
      styleSrc:       ["'self'", "'unsafe-inline'"],  // pug templates may inline styles
      imgSrc:         ["'self'", 'data:', 'blob:'],
      connectSrc:     ["'self'"],
      fontSrc:        ["'self'"],
      objectSrc:      ["'none'"],
      frameAncestors: ["'none'"],
      baseUri:        ["'self'"],
      formAction:     ["'self'"],
    },
  },
}));
const corsOptions = {
  origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',').map(o => o.trim()) : false,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Authorization', 'Content-Type'],
};
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
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
app.use('/chat',          chatRouter);
app.use('/',              documentsRouter);

// ── 404 handler ──────────────────────────────────────────────
app.use(function(req, res, next) {
  next(createError(404));
});

// ── Error handler ────────────────────────────────────────────
app.use(function(err, req, res, next) {
  const status = err.status || 500;
  if (status >= 500) {
    pinoLogger.error({ err, url: req.url, method: req.method }, 'Unhandled error');
  }
  // In production never leak internal error details to the client.
  // 4xx errors are intentional (validation, auth) — their messages are safe to forward.
  const isProd = IS_PROD;
  const message = status < 500
    ? (err.message || 'Bad request.')
    : (isProd ? 'An internal server error occurred.' : (err.message || 'Internal server error'));
  res.status(status).json({ success: false, message });
});
 
const PORT = process.env.PORT || (IS_PROD ? 8000 : 5000);

app.listen(PORT, '0.0.0.0', function () {
  pinoLogger.info('Server listening on 0.0.0.0:' + PORT);
  startOtpCleanup();
});

module.exports = app;
