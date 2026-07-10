const { validationResult } = require('express-validator');

// Wraps an array of express-validator chains with a final middleware that
// checks the accumulated result and short-circuits with the same {message}
// shape every other error path in this API already uses — no new response
// contract, so the frontend's existing err.response?.data?.message handling
// needs no changes.
function validate(rules) {
  return [
    ...rules,
    (req, res, next) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ message: errors.array()[0].msg });
      }
      next();
    },
  ];
}

module.exports = { validate };
