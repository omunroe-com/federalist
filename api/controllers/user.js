const authorizer = require('../authorizers/user');
const userSerializer = require('../serializers/user');
const { User } = require('../models');

module.exports = {
  usernames(req, res) {
    User.findAll()
      .then((users) => {
        const usernames = users.map(user => ({
          id: user.id,
          username: user.username,
        }));
        return res.json(usernames);
      })
      .catch(err => res.error(err));
  },

  me: (req, res) => {
    User.findById(req.user.id)
      .then(model => authorizer.me(req.user, model))
      .then(currentUser => userSerializer.serialize(currentUser))
      .then(userJSON => res.json(userJSON))
      .catch(err => res.error(err));
  },
};
