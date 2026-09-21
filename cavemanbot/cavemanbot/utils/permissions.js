const { PermissionFlagsBits } = require('discord.js');
const config = require('../config');

function isStaff(member) {
  if (!member) return false;
  if (member.permissions.has(PermissionFlagsBits.Administrator)) return true;
  if (config.staffRoleId && member.roles.cache.has(config.staffRoleId)) return true;
  return false;
}

// Only the "always can type" bypass role (config.alwaysCanTypeRoleId) —
// intentionally not staff/Administrator, used to gate commands that should
// stay limited to that one specific role.
function isBypassRole(member) {
  if (!member) return false;
  if (!config.alwaysCanTypeRoleId) return false;
  return member.roles.cache.has(config.alwaysCanTypeRoleId);
}

module.exports = { isStaff, isBypassRole };
