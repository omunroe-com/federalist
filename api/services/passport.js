const logger = require('winston');
const GitHub = require('./GitHub');
const GitHubStrategy = require('passport-github').Strategy;
const passport = require('passport');
const config = require('../../config');
const { User } = require('../models');

const githubVerifyCallback = (accessToken, refreshToken, profile, callback) => {
  let user;

  return GitHub.validateUser(accessToken)
    .then(() => User.findOrCreate({
      where: { username: profile.username.toLowerCase() },
      defaults: {
        email: profile._json.email,
        username: profile.username,
      },
    }))
    .then((models) => {
      user = models[0];
      if (!user) {
        throw new Error(`Unable to find or create user ${profile.username}`);
      }
      return user.update({
        githubAccessToken: accessToken,
        githubUserId: profile.id,
        signedInAt: new Date(),
      });
    })
    .then(() => {
      callback(null, user);
    })
    .catch((err) => {
      logger.warn('Authentication error: ', err);
      callback(err);
    });
};

passport.use(new GitHubStrategy(config.passport.github.options, githubVerifyCallback));

passport.logout = (req, res) => {
  req.logout();
  req.session.destroy(() => {
    res.redirect('/');
  });
};

passport.callback = (req, res) => {
  passport.authenticate('github')(req, res, () => {
    if (req.user) {
      req.session.authenticated = true;
      req.session.authenticatedAt = new Date();
      req.session.save(() => {
        if (req.session.authRedirectPath) {
          res.redirect(req.session.authRedirectPath);
        } else {
          res.redirect('/');
        }
      });
    } else {
      req.flash('error', {
        title: 'Unauthorized',
        message: 'Apologies; you don\'t have access to Federalist! ' +
                 'Please contact the Federalist team if this is in error.',
      });
      res.redirect('/');
    }
  });
};

passport.serializeUser((user, next) => {
  next(null, user.id);
});

passport.deserializeUser((id, next) => {
  User.findById(id).then((user) => {
    next(null, user);
  });
});

module.exports = passport;
