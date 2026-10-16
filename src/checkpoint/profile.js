'use strict';

const fs = require('node:fs');

function ensurePrivateBrowserProfile(profileDir) {
  fs.mkdirSync(profileDir, {
    recursive: true,
    mode: 0o700,
  });

  fs.chmodSync(profileDir, 0o700);
}

module.exports = {
  ensurePrivateBrowserProfile,
};
