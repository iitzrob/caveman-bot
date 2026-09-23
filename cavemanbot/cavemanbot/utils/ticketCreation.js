const { ChannelType, PermissionFlagsBits } = require('discord.js');

// Creates a private ticket channel: hidden from everyone by default, visible
// to the opener and to every role in roleIds. Called by ticketHandlers.js,
// applicationHandlers.js, and vouchMessageHandler.js — all three destructure
// { channel, rolesWithAccess } from the result. rolesWithAccess is handed
// back to the caller so claim/unclaim later know exactly which roles to
// toggle SendMessages on for this specific ticket.
async function createPrivateChannel({ guild, name, parentId, openerId, roleIds }) {
  const sanitizedName = String(name)
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 90) || 'ticket';

  const uniqueRoleIds = [...new Set((roleIds || []).filter(Boolean))];

  const permissionOverwrites = [
    {
      id: guild.roles.everyone.id,
      deny: [PermissionFlagsBits.ViewChannel],
    },
    {
      id: openerId,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
      ],
    },
    ...uniqueRoleIds.map((roleId) => ({
      id: roleId,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
      ],
    })),
  ];

  const channel = await guild.channels.create({
    name: sanitizedName,
    type: ChannelType.GuildText,
    parent: parentId || undefined,
    permissionOverwrites,
  });

  return { channel, rolesWithAccess: uniqueRoleIds };
}

module.exports = {
  createPrivateChannel,
};
