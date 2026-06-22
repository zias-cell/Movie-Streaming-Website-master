'use strict';

const session = require('express-session');

/**
 * Minimal express-session store backed by the app's node:sqlite database.
 * Keeps sessions (cart + admin login) persistent across restarts without
 * pulling in any extra native dependencies.
 */
class SqliteSessionStore extends session.Store {
  constructor(db) {
    super();
    this.db = db;
    db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        sid    TEXT PRIMARY KEY,
        sess   TEXT NOT NULL,
        expire INTEGER NOT NULL
      );
    `);
    this._get = db.prepare('SELECT sess, expire FROM sessions WHERE sid = ?');
    this._set = db.prepare(
      'INSERT INTO sessions (sid, sess, expire) VALUES (?, ?, ?) ' +
        'ON CONFLICT(sid) DO UPDATE SET sess = excluded.sess, expire = excluded.expire'
    );
    this._del = db.prepare('DELETE FROM sessions WHERE sid = ?');
    this._gc = db.prepare('DELETE FROM sessions WHERE expire < ?');

    // Periodically purge expired sessions.
    this._timer = setInterval(() => {
      try {
        this._gc.run(Date.now());
      } catch (_) {
        /* ignore */
      }
    }, 60 * 60 * 1000);
    if (this._timer.unref) this._timer.unref();
  }

  _expiry(sess) {
    if (sess && sess.cookie && sess.cookie.expires) {
      return new Date(sess.cookie.expires).getTime();
    }
    return Date.now() + 14 * 24 * 60 * 60 * 1000; // 14 days
  }

  get(sid, cb) {
    try {
      const row = this._get.get(sid);
      if (!row) return cb(null, null);
      if (row.expire < Date.now()) {
        this._del.run(sid);
        return cb(null, null);
      }
      return cb(null, JSON.parse(row.sess));
    } catch (err) {
      return cb(err);
    }
  }

  set(sid, sess, cb) {
    try {
      this._set.run(sid, JSON.stringify(sess), this._expiry(sess));
      if (cb) cb(null);
    } catch (err) {
      if (cb) cb(err);
    }
  }

  touch(sid, sess, cb) {
    try {
      this._set.run(sid, JSON.stringify(sess), this._expiry(sess));
      if (cb) cb(null);
    } catch (err) {
      if (cb) cb(err);
    }
  }

  destroy(sid, cb) {
    try {
      this._del.run(sid);
      if (cb) cb(null);
    } catch (err) {
      if (cb) cb(err);
    }
  }
}

module.exports = SqliteSessionStore;
