'use strict';

/** Guard admin routes — redirect to the login page when not authenticated. */
function requireAdmin(req, res, next) {
  if (req.session && req.session.adminId) {
    return next();
  }
  req.session.returnTo = req.originalUrl;
  return res.redirect('/admin/login');
}

module.exports = { requireAdmin };
