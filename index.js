const { 
  Client, 
  GatewayIntentBits, 
  REST, 
  Routes, 
  SlashCommandBuilder, 
  PermissionsBitField, 
  EmbedBuilder
} = require('discord.js');
const express = require('express');
const fs = require('fs');

// ---------- EXPRESS ----------
const app = express();
app.get("/", (req, res) => res.send("Bot is alive!"));
app.listen(3000, () => console.log("Express server running"));

// ---------- CLIENT ----------
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

// ---------- DATA FILES ----------
const LEVELS_FILE     = './levels.json';
const WARNINGS_FILE   = './warnings.json';
const XPCHANNELS_FILE = './xpChannels.json';
const AFK_FILE        = './afk.json';
const AUTOROLE_FILE   = './autoroles.json';
const WELCOME_FILE    = './welcome.json';
const ECON_FILE       = './economy.json';
const SHOP_FILE       = './shop.json';
const AUTOMOD_FILE    = './automod.json';

let levels          = fs.existsSync(LEVELS_FILE)     ? JSON.parse(fs.readFileSync(LEVELS_FILE))     : {};
let warnings        = fs.existsSync(WARNINGS_FILE)   ? JSON.parse(fs.readFileSync(WARNINGS_FILE))   : {};
let xpChannels      = fs.existsSync(XPCHANNELS_FILE) ? JSON.parse(fs.readFileSync(XPCHANNELS_FILE)) : {};
let afkData         = fs.existsSync(AFK_FILE)        ? JSON.parse(fs.readFileSync(AFK_FILE))        : {};
let autoRoles       = fs.existsSync(AUTOROLE_FILE)   ? JSON.parse(fs.readFileSync(AUTOROLE_FILE))   : {};
let welcomeChannels = fs.existsSync(WELCOME_FILE)    ? JSON.parse(fs.readFileSync(WELCOME_FILE))    : {};
let economy         = fs.existsSync(ECON_FILE)       ? JSON.parse(fs.readFileSync(ECON_FILE))       : {};
let shop            = fs.existsSync(SHOP_FILE)       ? JSON.parse(fs.readFileSync(SHOP_FILE))       : {};
let automodConfig   = fs.existsSync(AUTOMOD_FILE)    ? JSON.parse(fs.readFileSync(AUTOMOD_FILE))    : {};

// ---------- SAVE FUNCTIONS ----------
function saveData() {
  fs.writeFileSync(LEVELS_FILE,     JSON.stringify(levels, null, 2));
  fs.writeFileSync(WARNINGS_FILE,   JSON.stringify(warnings, null, 2));
  fs.writeFileSync(XPCHANNELS_FILE, JSON.stringify(xpChannels, null, 2));
  fs.writeFileSync(AFK_FILE,        JSON.stringify(afkData, null, 2));
  fs.writeFileSync(AUTOROLE_FILE,   JSON.stringify(autoRoles, null, 2));
  fs.writeFileSync(WELCOME_FILE,    JSON.stringify(welcomeChannels, null, 2));
}
function saveEconomy() { fs.writeFileSync(ECON_FILE,    JSON.stringify(economy, null, 2)); }
function saveShop()    { fs.writeFileSync(SHOP_FILE,    JSON.stringify(shop, null, 2)); }
function saveAutomod() { fs.writeFileSync(AUTOMOD_FILE, JSON.stringify(automodConfig, null, 2)); }
function ensureUser(id) { if (!economy[id]) economy[id] = { cash: 0, lastDaily: 0, inventory: [] }; }

// ---------- AUTOMOD HELPERS ----------
function getAutomod(guildId) {
  if (!automodConfig[guildId]) {
    automodConfig[guildId] = { enabled: false, logChannel: null, blockedWords: [], blockLinks: false, spamLimit: 5 };
  }
  return automodConfig[guildId];
}

const spamTracker = new Map();
function trackSpam(guildId, userId) {
  const key = `${guildId}:${userId}`;
  const now = Date.now();
  if (!spamTracker.has(key)) spamTracker.set(key, []);
  const times = spamTracker.get(key).filter(t => now - t < 5000);
  times.push(now);
  spamTracker.set(key, times);
  return times.length;
}

async function sendAutomodLog(guild, embed, cfg) {
  if (!cfg.logChannel) return;
  const ch = guild.channels.cache.get(cfg.logChannel);
  if (ch) ch.send({ embeds: [embed] }).catch(() => {});
}

// ---------- SLASH COMMANDS ----------
const commands = [
  new SlashCommandBuilder().setName("help").setDescription("Shows all bot commands"),
  new SlashCommandBuilder().setName("ping").setDescription("Check bot latency"),
  new SlashCommandBuilder().setName("afk").setDescription("Set yourself as AFK")
    .addStringOption(o => o.setName("reason").setDescription("Reason")),
  new SlashCommandBuilder().setName("level").setDescription("Check your level/profile")
    .addUserOption(o => o.setName("user").setDescription("User to check")),

  new SlashCommandBuilder().setName("addxp").setDescription("Add XP to a user")
    .addUserOption(o => o.setName("user").setDescription("User").setRequired(true))
    .addIntegerOption(o => o.setName("amount").setDescription("XP amount").setRequired(true)),
  new SlashCommandBuilder().setName("removexp").setDescription("Remove XP from a user")
    .addUserOption(o => o.setName("user").setDescription("User").setRequired(true))
    .addIntegerOption(o => o.setName("amount").setDescription("XP amount").setRequired(true)),
  new SlashCommandBuilder().setName("leaderboard").setDescription("Top 10 users by level"),
  new SlashCommandBuilder().setName("setxpchannel").setDescription("Set level-up notification channel")
    .addChannelOption(o => o.setName("channel").setDescription("Channel").setRequired(true)),
  new SlashCommandBuilder().setName("setautorole").setDescription("Set auto role on join")
    .addRoleOption(o => o.setName("role").setDescription("Role").setRequired(true)),
  new SlashCommandBuilder().setName("setwelcome").setDescription("Set welcome channel")
    .addChannelOption(o => o.setName("channel").setDescription("Channel").setRequired(true)),

  new SlashCommandBuilder().setName("clear").setDescription("Delete messages from a channel")
    .addIntegerOption(o => o.setName("amount").setDescription("Number of messages (1-100)").setRequired(true).setMinValue(1).setMaxValue(100)),
  new SlashCommandBuilder().setName("announce").setDescription("Send an announcement embed")
    .addStringOption(o => o.setName("message").setDescription("Announcement text").setRequired(true)),
  new SlashCommandBuilder().setName("kick").setDescription("Kick a member from the server")
    .addUserOption(o => o.setName("user").setDescription("User to kick").setRequired(true))
    .addStringOption(o => o.setName("reason").setDescription("Reason for kick")),
  new SlashCommandBuilder().setName("ban").setDescription("Ban a member from the server")
    .addUserOption(o => o.setName("user").setDescription("User to ban").setRequired(true))
    .addStringOption(o => o.setName("reason").setDescription("Reason for ban")),
  new SlashCommandBuilder().setName("warn").setDescription("Warn a member")
    .addUserOption(o => o.setName("user").setDescription("User to warn").setRequired(true))
    .addStringOption(o => o.setName("reason").setDescription("Reason for warning").setRequired(true)),
  new SlashCommandBuilder().setName("warnings").setDescription("View warnings for a user")
    .addUserOption(o => o.setName("user").setDescription("User to check").setRequired(true)),
  new SlashCommandBuilder().setName("clearwarnings").setDescription("Clear all warnings for a user")
    .addUserOption(o => o.setName("user").setDescription("User").setRequired(true)),
  new SlashCommandBuilder().setName("mute").setDescription("Timeout (mute) a member")
    .addUserOption(o => o.setName("user").setDescription("User to mute").setRequired(true))
    .addIntegerOption(o => o.setName("minutes").setDescription("Duration in minutes").setRequired(true).setMinValue(1).setMaxValue(40320))
    .addStringOption(o => o.setName("reason").setDescription("Reason")),
  new SlashCommandBuilder().setName("unmute").setDescription("Remove timeout from a member")
    .addUserOption(o => o.setName("user").setDescription("User to unmute").setRequired(true)),

  new SlashCommandBuilder().setName("cash").setDescription("Check cash balance")
    .addUserOption(o => o.setName("user").setDescription("User to check")),
  new SlashCommandBuilder().setName("daily").setDescription("Claim your daily reward"),
  new SlashCommandBuilder().setName("give").setDescription("Give cash to another user")
    .addUserOption(o => o.setName("user").setDescription("Recipient").setRequired(true))
    .addIntegerOption(o => o.setName("amount").setDescription("Amount").setRequired(true)),
  new SlashCommandBuilder().setName("fish").setDescription("Go fishing for cash"),
  new SlashCommandBuilder().setName("rob").setDescription("Attempt to rob a user")
    .addUserOption(o => o.setName("user").setDescription("Target").setRequired(true)),
  new SlashCommandBuilder().setName("gamble").setDescription("Gamble your cash")
    .addIntegerOption(o => o.setName("amount").setDescription("Amount to gamble").setRequired(true)),
  new SlashCommandBuilder().setName("shop").setDescription("View the shop"),
  new SlashCommandBuilder().setName("buy").setDescription("Buy an item from the shop")
    .addStringOption(o => o.setName("item").setDescription("Item name").setRequired(true)),

  new SlashCommandBuilder().setName("automod").setDescription("Configure auto-moderation")
    .addSubcommand(s => s.setName("enable").setDescription("Enable auto-mod"))
    .addSubcommand(s => s.setName("disable").setDescription("Disable auto-mod"))
    .addSubcommand(s => s.setName("addword").setDescription("Add a blocked word")
      .addStringOption(o => o.setName("word").setDescription("Word to block").setRequired(true)))
    .addSubcommand(s => s.setName("removeword").setDescription("Remove a blocked word")
      .addStringOption(o => o.setName("word").setDescription("Word to unblock").setRequired(true)))
    .addSubcommand(s => s.setName("listwords").setDescription("List all blocked words"))
    .addSubcommand(s => s.setName("setlog").setDescription("Set the auto-mod log channel")
      .addChannelOption(o => o.setName("channel").setDescription("Log channel").setRequired(true)))
    .addSubcommand(s => s.setName("setspam").setDescription("Set spam message limit per 5 seconds")
      .addIntegerOption(o => o.setName("limit").setDescription("Limit (default: 5)").setRequired(true).setMinValue(2).setMaxValue(20)))
    .addSubcommand(s => s.setName("setlinks").setDescription("Toggle invite link blocking")
      .addBooleanOption(o => o.setName("enabled").setDescription("true = block links").setRequired(true)))
    .addSubcommand(s => s.setName("status").setDescription("Show current auto-mod settings")),

].map(cmd => cmd.toJSON());

// ---------- REGISTER COMMANDS ----------
const rest = new REST({ version: '10' }).setToken(TOKEN);
(async () => {
  try {
    console.log("Registering commands...");
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
    console.log("Commands registered!");
  } catch (err) { console.error(err); }
})();

// ---------- READY ----------
client.once("ready", () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  client.user.setPresence({ status: 'idle', activities: [{ name: '/help | Xyrox', type: 0 }] });
});

// ---------- XP HELPERS ----------
const xpCooldowns = new Map();

function addXP(guildId, userId, amount) {
  if (!levels[guildId]) levels[guildId] = {};
  if (!levels[guildId][userId]) levels[guildId][userId] = { xp: 0, level: 1 };
  const userData = levels[guildId][userId];
  userData.xp += amount;
  const xpNeeded = userData.level * 100;
  if (userData.xp >= xpNeeded) {
    userData.level++;
    userData.xp -= xpNeeded;
    saveData();
    return true;
  }
  saveData();
  return false;
}

function xpOnCooldown(userId) {
  const now = Date.now();
  const last = xpCooldowns.get(userId) || 0;
  if (now - last < 60000) return true;
  xpCooldowns.set(userId, now);
  return false;
}

// ---------- WELCOME / AUTO-ROLE ----------
client.on("guildMemberAdd", async member => {
  const guildId = member.guild.id;
  if (autoRoles[guildId]) {
    const role = member.guild.roles.cache.get(autoRoles[guildId]);
    if (role) member.roles.add(role).catch(console.error);
  }
  if (!welcomeChannels[guildId]) return;
  const channel = member.guild.channels.cache.get(welcomeChannels[guildId]);
  if (!channel) return;
  const memberCount = member.guild.memberCount;
  const embed = new EmbedBuilder()
    .setColor("Gold")
    .setTitle(`🎉 WELCOME ${member.user.username}! 🎉`)
    .setDescription(
      `✨ ───────────────── ✨\n` +
      `🔥 You joined **${member.guild.name}**\n` +
      `💎 Enjoy your stay & have fun!\n\n` +
      `🚀 Start chatting now\n📜 Read the rules\n🎯 Get your roles\n\n` +
      `👥 Member #${memberCount}\n\n` +
      `✨ ───────────────── ✨\n💥 We're glad to have you here! 💥`
    )
    .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 256 }))
    .setFooter({ text: `Member #${memberCount} • ${new Date(member.joinedTimestamp).toLocaleDateString('en-US')}` })
    .setTimestamp(member.joinedAt);
  channel.send({ embeds: [embed] });
});

// ---------- MESSAGE EVENT ----------
client.on("messageCreate", async message => {
  if (message.author.bot) return;
  if (!message.guild) return;

  const guildId = message.guild.id;
  const userId  = message.author.id;
  const cfg     = getAutomod(guildId);

  // ---- AUTO-MOD ----
  if (cfg.enabled && !message.member?.permissions.has(PermissionsBitField.Flags.ManageMessages)) {

    // 1) Blocked words
    const lower = message.content.toLowerCase();
    const foundWord = cfg.blockedWords.find(w => lower.includes(w.toLowerCase()));
    if (foundWord) {
      await message.delete().catch(() => {});
      if (!warnings[guildId]) warnings[guildId] = {};
      if (!warnings[guildId][userId]) warnings[guildId][userId] = [];
      warnings[guildId][userId].push({ reason: `[AutoMod] Blocked word: "${foundWord}"`, moderator: "AutoMod", date: new Date().toISOString() });
      saveData();
      const embed = new EmbedBuilder().setColor("Red").setTitle("🚫 AutoMod — Blocked Word")
        .addFields(
          { name: "User",    value: `${message.author} (${message.author.tag})`, inline: true },
          { name: "Channel", value: `${message.channel}`, inline: true },
          { name: "Trigger", value: `\`${foundWord}\``, inline: true },
          { name: "Message", value: message.content.slice(0, 200) || "—" }
        ).setTimestamp();
      await sendAutomodLog(message.guild, embed, cfg);
      message.channel.send(`⚠️ ${message.author}, your message was removed — it contained a blocked word.`)
        .then(m => setTimeout(() => m.delete().catch(() => {}), 5000));
      return;
    }

    // 2) Spam
    const msgCount = trackSpam(guildId, userId);
    if (msgCount >= cfg.spamLimit) {
      const fetched = await message.channel.messages.fetch({ limit: 20 }).catch(() => null);
      if (fetched) {
        const userMsgs = fetched.filter(m => m.author.id === userId);
        message.channel.bulkDelete(userMsgs, true).catch(() => {});
      }
      try { await message.member.timeout(2 * 60 * 1000, "AutoMod: spam"); } catch {}
      spamTracker.set(`${guildId}:${userId}`, []);
      const embed = new EmbedBuilder().setColor("Orange").setTitle("⚡ AutoMod — Spam Detected")
        .addFields(
          { name: "User",    value: `${message.author} (${message.author.tag})`, inline: true },
          { name: "Channel", value: `${message.channel}`, inline: true },
          { name: "Action",  value: "Muted 2 minutes, recent messages deleted" }
        ).setTimestamp();
      await sendAutomodLog(message.guild, embed, cfg);
      message.channel.send(`⚠️ ${message.author}, you were muted for 2 minutes due to spam.`)
        .then(m => setTimeout(() => m.delete().catch(() => {}), 5000));
      return;
    }

    // 3) Invite links
    if (cfg.blockLinks && /discord\.gg\/|discord\.com\/invite\//i.test(message.content)) {
      await message.delete().catch(() => {});
      if (!warnings[guildId]) warnings[guildId] = {};
      if (!warnings[guildId][userId]) warnings[guildId][userId] = [];
      warnings[guildId][userId].push({ reason: "[AutoMod] Discord invite link", moderator: "AutoMod", date: new Date().toISOString() });
      saveData();
      const embed = new EmbedBuilder().setColor("Red").setTitle("🔗 AutoMod — Invite Link Blocked")
        .addFields(
          { name: "User",    value: `${message.author} (${message.author.tag})`, inline: true },
          { name: "Channel", value: `${message.channel}`, inline: true }
        ).setTimestamp();
      await sendAutomodLog(message.guild, embed, cfg);
      message.channel.send(`⚠️ ${message.author}, posting invite links is not allowed here.`)
        .then(m => setTimeout(() => m.delete().catch(() => {}), 5000));
      return;
    }
  }

  // ---- AFK CHECK ----
  if (message.mentions.users.size > 0) {
    message.mentions.users.forEach(user => {
      if (afkData[user.id]) message.reply(`💤 **${user.tag}** is AFK: ${afkData[user.id]}`);
    });
  }
  if (afkData[userId]) {
    delete afkData[userId];
    saveData();
    message.reply("✅ Welcome back! Your AFK has been removed.").then(m => setTimeout(() => m.delete(), 5000));
  }

  // ---- XP GAIN ----
  if (guildId && !xpOnCooldown(userId)) {
    const xpGain = Math.floor(Math.random() * 10) + 5;
    const leveledUp = addXP(guildId, userId, xpGain);
    if (leveledUp) {
      const lvl = levels[guildId][userId].level;
      const notifyChannelId = xpChannels[guildId];
      const notifyChannel = notifyChannelId ? message.guild.channels.cache.get(notifyChannelId) : message.channel;
      if (notifyChannel) notifyChannel.send(`🎉🎊 Congrats ${message.author}! You reached level **${lvl}**!`);
    }
  }

  // ---- ?rules ----
  if (message.content.toLowerCase() === "?rules") {
    const embed = new EmbedBuilder().setColor("Blue").setTitle("📜 Discord Server Rules")
      .setDescription("Follow the rules to keep the server safe and fun for everyone!")
      .addFields(
        { name: "1. Respect Everyone",          value: "No harassment, bullying, hate speech, or discrimination." },
        { name: "2. No Spamming",               value: "Avoid spam, excessive links, or self-promotion." },
        { name: "3. Keep Content Appropriate",  value: "No NSFW, illegal, or pirated content." },
        { name: "4. Respect Privacy",           value: "No doxxing or sharing personal info without consent." },
        { name: "5. No Advertising",            value: "No advertising servers, bots, or products without permission." },
        { name: "6. Follow Staff Instructions", value: "Respect moderators and admins; their decisions are final." },
        { name: "7. No Impersonation",          value: "Do not impersonate staff or other members." },
        { name: "8. Have Fun! 🎉",              value: "Enjoy yourself and help create a friendly community!" }
      )
      .setFooter({ text: "Breaking rules may result in warnings, mutes, kicks, or bans." });
    return message.channel.send({ embeds: [embed] });
  }

  // ---- ?lock ----
  if (message.content.toLowerCase().startsWith("?lock")) {
    if (!message.member.permissions.has(PermissionsBitField.Flags.ManageChannels) &&
        !message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return message.reply("❌ You need the **Manage Channels** permission to lock channels.");
    }
    const reason = message.content.slice(5).trim() || "No reason provided";
    try {
      await message.channel.permissionOverwrites.edit(message.guild.roles.everyone, {
        SendMessages: false
      });
      const embed = new EmbedBuilder()
        .setColor("Red")
        .setTitle("🔒 Channel Locked")
        .setDescription(`This channel has been locked. Members can no longer send messages here.`)
        .addFields(
          { name: "Locked by", value: message.author.tag, inline: true },
          { name: "Reason",    value: reason, inline: true }
        )
        .setTimestamp();
      return message.channel.send({ embeds: [embed] });
    } catch (err) {
      console.error(err);
      return message.reply("❌ Failed to lock the channel. Make sure I have the **Manage Channels** permission.");
    }
  }

  // ---- ?unlock ----
  if (message.content.toLowerCase().startsWith("?unlock")) {
    if (!message.member.permissions.has(PermissionsBitField.Flags.ManageChannels) &&
        !message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return message.reply("❌ You need the **Manage Channels** permission to unlock channels.");
    }
    try {
      await message.channel.permissionOverwrites.edit(message.guild.roles.everyone, {
        SendMessages: null
      });
      const embed = new EmbedBuilder()
        .setColor("Green")
        .setTitle("🔓 Channel Unlocked")
        .setDescription(`This channel has been unlocked. Members can send messages again.`)
        .addFields(
          { name: "Unlocked by", value: message.author.tag, inline: true }
        )
        .setTimestamp();
      return message.channel.send({ embeds: [embed] });
    } catch (err) {
      console.error(err);
      return message.reply("❌ Failed to unlock the channel. Make sure I have the **Manage Channels** permission.");
    }
  }
});

// ---------- INTERACTIONS ----------
client.on("interactionCreate", async interaction => {
  if (!interaction.isCommand()) return;

  const { commandName, guild, member } = interaction;
  const isAdmin = member.permissions.has(PermissionsBitField.Flags.Administrator);
  const isMod   = isAdmin || member.permissions.has(PermissionsBitField.Flags.ManageMessages);
  const canKick = isAdmin || member.permissions.has(PermissionsBitField.Flags.KickMembers);
  const canBan  = isAdmin || member.permissions.has(PermissionsBitField.Flags.BanMembers);
  const canMute = isAdmin || member.permissions.has(PermissionsBitField.Flags.ModerateMembers);

  // ─────────────────────────────────────────────
  // MODERATION
  // ─────────────────────────────────────────────

  if (commandName === "kick") {
    if (!canKick) return interaction.reply({ content: "❌ You need the **Kick Members** permission.", ephemeral: true });
    const targetUser   = interaction.options.getUser("user");
    const reason       = interaction.options.getString("reason") || "No reason provided";
    const targetMember = await guild.members.fetch(targetUser.id).catch(() => null);
    if (!targetMember)          return interaction.reply({ content: "❌ That user is not in this server.", ephemeral: true });
    if (!targetMember.kickable) return interaction.reply({ content: "❌ I can't kick that user — they may have a higher role than me.", ephemeral: true });
    if (targetMember.id === interaction.user.id) return interaction.reply({ content: "❌ You cannot kick yourself.", ephemeral: true });
    try {
      await targetMember.send(`👢 You have been **kicked** from **${guild.name}**.\n**Reason:** ${reason}`).catch(() => {});
      await targetMember.kick(reason);
      return interaction.reply(`✅ ${targetUser} has been kicked.`);
    } catch (err) {
      console.error(err);
      return interaction.reply({ content: "❌ Failed to kick the user.", ephemeral: true });
    }
  }

  if (commandName === "ban") {
    if (!canBan) return interaction.reply({ content: "❌ You need the **Ban Members** permission.", ephemeral: true });
    const targetUser   = interaction.options.getUser("user");
    const reason       = interaction.options.getString("reason") || "No reason provided";
    const targetMember = await guild.members.fetch(targetUser.id).catch(() => null);
    if (targetMember) {
      if (!targetMember.bannable) return interaction.reply({ content: "❌ I can't ban that user — they may have a higher role than me.", ephemeral: true });
      if (targetMember.id === interaction.user.id) return interaction.reply({ content: "❌ You cannot ban yourself.", ephemeral: true });
      await targetMember.send(`🔨 You have been **banned** from **${guild.name}**.\n**Reason:** ${reason}`).catch(() => {});
    }
    try {
      await guild.members.ban(targetUser.id, { reason, deleteMessageSeconds: 0 });
      return interaction.reply(`✅ ${targetUser} has been banned.`);
    } catch (err) {
      console.error(err);
      return interaction.reply({ content: "❌ Failed to ban the user.", ephemeral: true });
    }
  }

  if (commandName === "warn") {
    if (!isMod) return interaction.reply({ content: "❌ You need the **Manage Messages** permission.", ephemeral: true });
    const targetUser = interaction.options.getUser("user");
    const reason     = interaction.options.getString("reason");
    if (targetUser.id === interaction.user.id) return interaction.reply({ content: "❌ You cannot warn yourself.", ephemeral: true });
    if (targetUser.bot) return interaction.reply({ content: "❌ You cannot warn a bot.", ephemeral: true });
    if (!warnings[guild.id]) warnings[guild.id] = {};
    if (!warnings[guild.id][targetUser.id]) warnings[guild.id][targetUser.id] = [];
    warnings[guild.id][targetUser.id].push({ reason, moderator: interaction.user.tag, date: new Date().toISOString() });
    saveData();
    const totalWarnings = warnings[guild.id][targetUser.id].length;
    const targetMember = await guild.members.fetch(targetUser.id).catch(() => null);
    if (targetMember) {
      await targetMember.send(`⚠️ You have been **warned** in **${guild.name}**.\n**Reason:** ${reason}\n**Total warnings:** ${totalWarnings}`).catch(() => {});
    }
    return interaction.reply(`✅ ${targetUser} has been warned.`);
  }

  if (commandName === "warnings") {
    if (!isMod) return interaction.reply({ content: "❌ You need the **Manage Messages** permission.", ephemeral: true });
    const targetUser = interaction.options.getUser("user");
    const userWarns  = warnings[guild.id]?.[targetUser.id];
    if (!userWarns || userWarns.length === 0) {
      return interaction.reply(`✅ ${targetUser} has no warnings.`);
    }
    const warnList = userWarns.map((w, i) => {
      const date = new Date(w.date).toLocaleDateString('en-US');
      return `**#${i + 1}** — ${w.reason} *(by ${w.moderator || 'Unknown'} on ${date})*`;
    }).join("\n");
    return interaction.reply(`📋 **Warnings for ${targetUser}** (${userWarns.length} total)\n${warnList}`);
  }

  if (commandName === "clearwarnings") {
    if (!isAdmin) return interaction.reply({ content: "❌ Admins only.", ephemeral: true });
    const targetUser = interaction.options.getUser("user");
    if (warnings[guild.id]) warnings[guild.id][targetUser.id] = [];
    saveData();
    return interaction.reply(`✅ Warnings cleared for ${targetUser}.`);
  }

  if (commandName === "mute") {
    if (!canMute) return interaction.reply({ content: "❌ You need the **Moderate Members** permission.", ephemeral: true });
    const targetUser   = interaction.options.getUser("user");
    const minutes      = interaction.options.getInteger("minutes");
    const reason       = interaction.options.getString("reason") || "No reason provided";
    const targetMember = await guild.members.fetch(targetUser.id).catch(() => null);
    if (!targetMember)             return interaction.reply({ content: "❌ That user is not in this server.", ephemeral: true });
    if (!targetMember.moderatable) return interaction.reply({ content: "❌ I can't mute that user — they may have a higher role than me.", ephemeral: true });
    if (targetMember.id === interaction.user.id) return interaction.reply({ content: "❌ You cannot mute yourself.", ephemeral: true });
    try {
      await targetMember.timeout(minutes * 60 * 1000, reason);
      await targetMember.send(`🔇 You have been **muted** in **${guild.name}** for **${minutes} minute(s)**.\n**Reason:** ${reason}`).catch(() => {});
      return interaction.reply(`✅ ${targetUser} has been muted for **${minutes}** minute(s).`);
    } catch (err) {
      console.error(err);
      return interaction.reply({ content: "❌ Failed to mute the user.", ephemeral: true });
    }
  }

  if (commandName === "unmute") {
    if (!canMute) return interaction.reply({ content: "❌ You need the **Moderate Members** permission.", ephemeral: true });
    const targetUser   = interaction.options.getUser("user");
    const targetMember = await guild.members.fetch(targetUser.id).catch(() => null);
    if (!targetMember) return interaction.reply({ content: "❌ That user is not in this server.", ephemeral: true });
    if (!targetMember.isCommunicationDisabled()) return interaction.reply({ content: "⚠️ That user is not currently muted.", ephemeral: true });
    try {
      await targetMember.timeout(null);
      await targetMember.send(`🔊 Your mute in **${guild.name}** has been removed.`).catch(() => {});
      return interaction.reply(`✅ ${targetUser} has been unmuted.`);
    } catch (err) {
      console.error(err);
      return interaction.reply({ content: "❌ Failed to unmute the user.", ephemeral: true });
    }
  }

  if (commandName === "announce") {
    if (!isMod) return interaction.reply({ content: "❌ You need the **Manage Messages** permission.", ephemeral: true });
    const text = interaction.options.getString("message");
    const embed = new EmbedBuilder().setColor("Blue").setTitle("📢 Announcement")
      .setDescription(text)
      .setFooter({ text: `Announced by ${interaction.user.tag}` })
      .setTimestamp();
    await interaction.channel.send({ embeds: [embed] });
    return interaction.reply({ content: "✅ Announcement sent.", ephemeral: true });
  }

  if (commandName === "clear") {
    if (!isMod) return interaction.reply({ content: "❌ You need the **Manage Messages** permission.", ephemeral: true });
    const amount = interaction.options.getInteger("amount");
    await interaction.deferReply({ ephemeral: true });
    try {
      const deleted = await interaction.channel.bulkDelete(amount, true);
      return interaction.editReply(`✅ Deleted **${deleted.size}** message(s).`);
    } catch (err) {
      console.error(err);
      return interaction.editReply("❌ Failed to delete messages. Messages older than 14 days cannot be bulk deleted.");
    }
  }

  // ─────────────────────────────────────────────
  // AUTO-MOD SETTINGS
  // ─────────────────────────────────────────────

  if (commandName === "automod") {
    if (!isAdmin) return interaction.reply({ content: "❌ Admins only.", ephemeral: true });
    const sub = interaction.options.getSubcommand();
    const cfg = getAutomod(guild.id);

    if (sub === "enable")  { cfg.enabled = true;  saveAutomod(); return interaction.reply("✅ Auto-mod **enabled**."); }
    if (sub === "disable") { cfg.enabled = false; saveAutomod(); return interaction.reply("✅ Auto-mod **disabled**."); }
    if (sub === "addword") {
      const word = interaction.options.getString("word").toLowerCase();
      if (cfg.blockedWords.includes(word)) return interaction.reply("⚠️ That word is already blocked.");
      cfg.blockedWords.push(word); saveAutomod();
      return interaction.reply(`✅ Added \`${word}\` to the blocked words list.`);
    }
    if (sub === "removeword") {
      const word = interaction.options.getString("word").toLowerCase();
      const idx = cfg.blockedWords.indexOf(word);
      if (idx === -1) return interaction.reply("⚠️ That word isn't in the list.");
      cfg.blockedWords.splice(idx, 1); saveAutomod();
      return interaction.reply(`✅ Removed \`${word}\` from the blocked words list.`);
    }
    if (sub === "listwords") {
      if (cfg.blockedWords.length === 0) return interaction.reply({ content: "📋 No blocked words set.", ephemeral: true });
      return interaction.reply({ content: `📋 **Blocked words:**\n${cfg.blockedWords.map(w => `\`${w}\``).join(", ")}`, ephemeral: true });
    }
    if (sub === "setlog") {
      const channel = interaction.options.getChannel("channel");
      cfg.logChannel = channel.id; saveAutomod();
      return interaction.reply(`✅ Auto-mod logs will be sent to ${channel}.`);
    }
    if (sub === "setspam") {
      const limit = interaction.options.getInteger("limit");
      cfg.spamLimit = limit; saveAutomod();
      return interaction.reply(`✅ Spam limit set to **${limit}** messages per 5 seconds.`);
    }
    if (sub === "setlinks") {
      const enabled = interaction.options.getBoolean("enabled");
      cfg.blockLinks = enabled; saveAutomod();
      return interaction.reply(`✅ Invite link blocking is now **${enabled ? "enabled" : "disabled"}**.`);
    }
    if (sub === "status") {
      const embed = new EmbedBuilder().setTitle("🛡️ Auto-Mod Settings").setColor(cfg.enabled ? "Green" : "Red")
        .addFields(
          { name: "Status",        value: cfg.enabled ? "✅ Enabled" : "❌ Disabled", inline: true },
          { name: "Log Channel",   value: cfg.logChannel ? `<#${cfg.logChannel}>` : "Not set", inline: true },
          { name: "Spam Limit",    value: `${cfg.spamLimit} msgs / 5s`, inline: true },
          { name: "Block Invites", value: cfg.blockLinks ? "Yes" : "No", inline: true },
          { name: "Blocked Words", value: cfg.blockedWords.length > 0 ? cfg.blockedWords.map(w => `\`${w}\``).join(", ") : "None" }
        );
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }
  }

  // ─────────────────────────────────────────────
  // UTILITY
  // ─────────────────────────────────────────────

  if (commandName === "help") {
    const embed = new EmbedBuilder().setTitle("🤖 Bot Commands").setColor("Blue")
      .addFields(
        { name: "⚔️ Moderation",  value: "`/kick`, `/ban`, `/warn`, `/warnings`, `/clearwarnings`, `/mute`, `/unmute`, `/clear`, `/announce`" },
        { name: "📈 Levels & XP", value: "`/level`, `/addxp`, `/removexp`, `/leaderboard`, `/setxpchannel`" },
        { name: "💰 Economy",     value: "`/cash`, `/daily`, `/give`, `/fish`, `/rob`, `/gamble`, `/shop`, `/buy`" },
        { name: "🛡️ Auto-Mod",   value: "`/automod enable/disable/addword/removeword/listwords/setlog/setspam/setlinks/status`" },
        { name: "⚙️ Setup",       value: "`/setwelcome`, `/setautorole`, `/setxpchannel`" },
        { name: "🔧 Utility",     value: "`/afk`, `/ping`, `?rules`, `?lock [reason]`, `?unlock`" }
      );
    return interaction.reply({ embeds: [embed] });
  }

  if (commandName === "ping") {
    const msg = await interaction.reply({ content: "🏓 Pinging...", fetchReply: true });
    return interaction.editReply(`🏓 Pong! Latency: **${msg.createdTimestamp - interaction.createdTimestamp}ms**`);
  }

  if (commandName === "afk") {
    const reason = interaction.options.getString("reason") || "AFK";
    afkData[interaction.user.id] = reason;
    saveData();
    return interaction.reply(`✅ You are now AFK: **${reason}**`);
  }

  if (commandName === "level") {
    const target = interaction.options.getUser("user") || interaction.user;
    if (!levels[guild.id]) levels[guild.id] = {};
    if (!levels[guild.id][target.id]) levels[guild.id][target.id] = { xp: 0, level: 1 };
    const data = levels[guild.id][target.id];
    const embed = new EmbedBuilder().setTitle(`${target.tag}'s Profile`).setColor("Gold")
      .setThumbnail(target.displayAvatarURL({ dynamic: true }))
      .setDescription(`**Level:** ${data.level}\n**XP:** ${data.xp} / ${data.level * 100}`);
    return interaction.reply({ embeds: [embed] });
  }

  if (commandName === "setwelcome") {
    if (!isAdmin) return interaction.reply({ content: "❌ Admins only.", ephemeral: true });
    const channel = interaction.options.getChannel("channel");
    welcomeChannels[guild.id] = channel.id;
    saveData();
    return interaction.reply(`✅ Welcome channel set to ${channel}`);
  }

  if (commandName === "setautorole") {
    if (!isAdmin) return interaction.reply({ content: "❌ Admins only.", ephemeral: true });
    const role = interaction.options.getRole("role");
    autoRoles[guild.id] = role.id;
    saveData();
    return interaction.reply(`✅ Auto-role set to **${role.name}**`);
  }

  if (commandName === "setxpchannel") {
    if (!isAdmin) return interaction.reply({ content: "❌ Admins only.", ephemeral: true });
    const channel = interaction.options.getChannel("channel");
    xpChannels[guild.id] = channel.id;
    saveData();
    return interaction.reply(`✅ Level-up notifications will be sent to ${channel}.`);
  }

  if (commandName === "addxp") {
    if (!isAdmin) return interaction.reply({ content: "❌ You need the **Administrator** permission.", ephemeral: true });
    const target = interaction.options.getUser("user");
    const amount = interaction.options.getInteger("amount");
    if (amount <= 0) return interaction.reply({ content: "❌ Amount must be greater than 0.", ephemeral: true });
    if (!levels[guild.id]) levels[guild.id] = {};
    if (!levels[guild.id][target.id]) levels[guild.id][target.id] = { xp: 0, level: 1 };
    const leveled = addXP(guild.id, target.id, amount);
    const data = levels[guild.id][target.id];
    return interaction.reply(`✅ Added **${amount} XP** to ${target}.${leveled ? ` They leveled up to **Level ${data.level}**! 🎉` : ` They are now at **${data.xp}/${data.level * 100} XP**.`}`);
  }

  if (commandName === "removexp") {
    if (!isAdmin) return interaction.reply({ content: "❌ Admins only.", ephemeral: true });
    const target = interaction.options.getUser("user");
    const amount = interaction.options.getInteger("amount");
    if (amount <= 0) return interaction.reply({ content: "❌ Amount must be greater than 0.", ephemeral: true });
    if (!levels[guild.id]) levels[guild.id] = {};
    if (!levels[guild.id][target.id]) levels[guild.id][target.id] = { xp: 0, level: 1 };
    const userData = levels[guild.id][target.id];
    userData.xp -= amount;
    while (userData.xp < 0 && userData.level > 1) { userData.level--; userData.xp += userData.level * 100; }
    if (userData.xp < 0) userData.xp = 0;
    saveData();
    return interaction.reply(`✅ Removed **${amount} XP** from ${target}. They are now at **Level ${userData.level}** (${userData.xp}/${userData.level * 100} XP).`);
  }

  if (commandName === "leaderboard") {
    if (!levels[guild.id] || Object.keys(levels[guild.id]).length === 0)
      return interaction.reply("❌ No XP data for this server yet.");
    const sorted = Object.entries(levels[guild.id])
      .sort(([, a], [, b]) => b.level !== a.level ? b.level - a.level : b.xp - a.xp)
      .slice(0, 10);
    const medals = ["🥇", "🥈", "🥉"];
    let desc = "";
    for (let i = 0; i < sorted.length; i++) {
      const [uid, data] = sorted[i];
      let tag;
      try { const u = await client.users.fetch(uid); tag = u.tag; } catch { tag = "Unknown User"; }
      const rank = medals[i] || `**#${i + 1}**`;
      desc += `${rank} ${tag} — Level **${data.level}** (${data.xp}/${data.level * 100} XP)\n`;
    }
    const embed = new EmbedBuilder().setTitle(`🏆 ${guild.name} XP Leaderboard`).setColor("Gold").setDescription(desc).setTimestamp();
    return interaction.reply({ embeds: [embed] });
  }

  // ─────────────────────────────────────────────
  // ECONOMY
  // ─────────────────────────────────────────────

  ensureUser(interaction.user.id);

  if (commandName === "cash") {
    const target = interaction.options.getUser("user") || interaction.user;
    ensureUser(target.id);
    return interaction.reply(`💰 **${target.tag}** has **$${economy[target.id].cash}**`);
  }

  if (commandName === "daily") {
    const now      = Date.now();
    const last     = economy[interaction.user.id].lastDaily;
    const cooldown = 24 * 60 * 60 * 1000;
    if (now - last < cooldown) {
      const remain = cooldown - (now - last);
      const h = Math.floor(remain / 3600000);
      const m = Math.floor((remain % 3600000) / 60000);
      return interaction.reply(`⏳ Already claimed. Try again in **${h}h ${m}m**.`);
    }
    const reward = Math.floor(Math.random() * 500) + 100;
    economy[interaction.user.id].cash += reward;
    economy[interaction.user.id].lastDaily = now;
    saveEconomy();
    return interaction.reply(`✅ You claimed your daily reward of **$${reward}**!`);
  }

  if (commandName === "give") {
    const target = interaction.options.getUser("user");
    const amount = interaction.options.getInteger("amount");
    ensureUser(target.id);
    if (amount <= 0) return interaction.reply("❌ Amount must be greater than 0.");
    if (target.id === interaction.user.id) return interaction.reply("❌ You can't give cash to yourself.");
    if (economy[interaction.user.id].cash < amount) return interaction.reply("❌ You don't have enough cash.");
    economy[interaction.user.id].cash -= amount;
    economy[target.id].cash += amount;
    saveEconomy();
    return interaction.reply(`💸 Gave **$${amount}** to **${target.tag}**`);
  }

  if (commandName === "fish") {
    const gain = Math.floor(Math.random() * 300) + 50;
    economy[interaction.user.id].cash += gain;
    saveEconomy();
    return interaction.reply(`🎣 You caught a fish and earned **$${gain}**!`);
  }

  if (commandName === "rob") {
    const target = interaction.options.getUser("user");
    ensureUser(target.id);
    if (target.id === interaction.user.id) return interaction.reply("❌ You can't rob yourself.");
    if (economy[target.id].cash < 100) return interaction.reply("❌ Target doesn't have enough cash to rob (needs at least $100).");
    const success = Math.random() < 0.5;
    if (success) {
      const stolen = Math.floor(Math.random() * (economy[target.id].cash / 2)) + 1;
      economy[target.id].cash -= stolen;
      economy[interaction.user.id].cash += stolen;
      saveEconomy();
      return interaction.reply(`💰 Success! You stole **$${stolen}** from **${target.tag}**`);
    } else {
      const lost = Math.floor(Math.random() * 100) + 10;
      economy[interaction.user.id].cash = Math.max(0, economy[interaction.user.id].cash - lost);
      saveEconomy();
      return interaction.reply(`❌ You got caught! Lost **$${lost}**`);
    }
  }

  if (commandName === "gamble") {
    const amount = interaction.options.getInteger("amount");
    if (amount <= 0) return interaction.reply("❌ Amount must be greater than 0.");
    if (economy[interaction.user.id].cash < amount) return interaction.reply("❌ You don't have enough cash.");
    const win = Math.random() < 0.5;
    if (win) {
      economy[interaction.user.id].cash += amount;
      saveEconomy();
      return interaction.reply(`🎉 You won **$${amount}**! Balance: **$${economy[interaction.user.id].cash}**`);
    } else {
      economy[interaction.user.id].cash -= amount;
      saveEconomy();
      return interaction.reply(`💸 You lost **$${amount}**. Balance: **$${economy[interaction.user.id].cash}**`);
    }
  }

  if (commandName === "shop") {
    if (Object.keys(shop).length === 0) {
      shop["VIP Role"] = { price: 1000, desc: "Grants the VIP role" };
      saveShop();
    }
    let desc = "";
    for (const item in shop) desc += `**${item}** — $${shop[item].price}\n${shop[item].desc}\n\n`;
    const embed = new EmbedBuilder().setTitle("🛒 Shop").setColor("Green").setDescription(desc);
    return interaction.reply({ embeds: [embed] });
  }

  if (commandName === "buy") {
    const item = interaction.options.getString("item");
    if (!shop[item]) return interaction.reply("❌ That item doesn't exist in the shop.");
    const price = shop[item].price;
    if (economy[interaction.user.id].cash < price) return interaction.reply("❌ You don't have enough cash.");
    economy[interaction.user.id].cash -= price;
    economy[interaction.user.id].inventory.push(item);
    saveEconomy();
    return interaction.reply(`✅ You bought **${item}** for **$${price}**!`);
  }
});

client.login(TOKEN);
