// ---------------------------- IMPORTS ----------------------------
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

// ---------------------------- EXPRESS SERVER ----------------------------
const app = express();
app.get("/", (req, res) => res.send("Bot is alive!"));
app.listen(3000, () => console.log("Express server running"));

// ---------------------------- CLIENT ----------------------------
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
const PREFIX = "?";

// ---------------------------- DATA FILES ----------------------------
const LEVELS_FILE = './levels.json';
const WARNINGS_FILE = './warnings.json';
const XPCHANNELS_FILE = './xpChannels.json';
const AFK_FILE = './afk.json';
const AUTOROLE_FILE = './autoroles.json';
const WELCOME_FILE = './welcome.json';

let levels = fs.existsSync(LEVELS_FILE) ? JSON.parse(fs.readFileSync(LEVELS_FILE)) : {};
let warnings = fs.existsSync(WARNINGS_FILE) ? JSON.parse(fs.readFileSync(WARNINGS_FILE)) : {};
let xpChannels = fs.existsSync(XPCHANNELS_FILE) ? JSON.parse(fs.readFileSync(XPCHANNELS_FILE)) : {};
let afkData = fs.existsSync(AFK_FILE) ? JSON.parse(fs.readFileSync(AFK_FILE)) : {};
let autoRoles = fs.existsSync(AUTOROLE_FILE) ? JSON.parse(fs.readFileSync(AUTOROLE_FILE)) : {};
let welcomeChannels = fs.existsSync(WELCOME_FILE) ? JSON.parse(fs.readFileSync(WELCOME_FILE)) : {};

function saveData(){
  fs.writeFileSync(LEVELS_FILE, JSON.stringify(levels, null, 2));
  fs.writeFileSync(WARNINGS_FILE, JSON.stringify(warnings, null, 2));
  fs.writeFileSync(XPCHANNELS_FILE, JSON.stringify(xpChannels, null, 2));
  fs.writeFileSync(AFK_FILE, JSON.stringify(afkData, null, 2));
  fs.writeFileSync(AUTOROLE_FILE, JSON.stringify(autoRoles, null, 2));
  fs.writeFileSync(WELCOME_FILE, JSON.stringify(welcomeChannels, null, 2));
}

// ---------------------------- SLASH COMMANDS ----------------------------
const commands = [
  new SlashCommandBuilder().setName("help").setDescription("Shows all bot commands"),
  new SlashCommandBuilder().setName("ping").setDescription("Check bot latency"),
  new SlashCommandBuilder().setName("afk").setDescription("Set yourself as AFK")
    .addStringOption(o => o.setName("reason").setDescription("Reason for going AFK")),
  new SlashCommandBuilder().setName("level").setDescription("Check your level/profile")
    .addUserOption(o => o.setName("user").setDescription("Check someone else's profile")),
  new SlashCommandBuilder().setName("addxp").setDescription("Add XP to a user")
    .addUserOption(o => o.setName("user").setDescription("User to add XP").setRequired(true))
    .addIntegerOption(o => o.setName("amount").setDescription("XP amount").setRequired(true)),
  new SlashCommandBuilder().setName("removexp").setDescription("Remove XP from a user")
    .addUserOption(o => o.setName("user").setDescription("User to remove XP").setRequired(true))
    .addIntegerOption(o => o.setName("amount").setDescription("XP amount").setRequired(true)),
  new SlashCommandBuilder().setName("leaderboard").setDescription("Shows top 10 users by level"),
  new SlashCommandBuilder().setName("setxpchannel").setDescription("Set channel for level-up messages")
    .addChannelOption(o => o.setName("channel").setDescription("Channel for level-up messages").setRequired(true)),
  new SlashCommandBuilder().setName("setautorole").setDescription("Set role to auto-assign to new members")
    .addRoleOption(o => o.setName("role").setDescription("Role to auto-assign").setRequired(true)),
  new SlashCommandBuilder().setName("setwelcome").setDescription("Set welcome channel (admin only)")
    .addChannelOption(o => o.setName("channel").setDescription("Channel for welcome messages").setRequired(true)),
  new SlashCommandBuilder().setName("announce").setDescription("Make an announcement (admin only)")
    .addStringOption(o => o.setName("message").setDescription("Message to announce").setRequired(true)),
  new SlashCommandBuilder().setName("kick").setDescription("Kick a member (admin only)")
    .addUserOption(o => o.setName("user").setDescription("User to kick").setRequired(true)),
  new SlashCommandBuilder().setName("ban").setDescription("Ban a member (admin only)")
    .addUserOption(o => o.setName("user").setDescription("User to ban").setRequired(true)),
  new SlashCommandBuilder().setName("warn").setDescription("Warn a member (admin only)")
    .addUserOption(o => o.setName("user").setDescription("User to warn").setRequired(true))
    .addStringOption(o => o.setName("reason").setDescription("Reason").setRequired(true)),
  new SlashCommandBuilder().setName("warnings").setDescription("Check warnings for a user")
    .addUserOption(o => o.setName("user").setDescription("User to check").setRequired(true)),
  new SlashCommandBuilder().setName("mute").setDescription("Mute a member temporarily (admin only)")
    .addUserOption(o => o.setName("user").setDescription("User to mute").setRequired(true))
    .addIntegerOption(o => o.setName("minutes").setDescription("Duration in minutes").setRequired(true)),
  new SlashCommandBuilder().setName("unmute").setDescription("Unmute a member manually (admin only)")
    .addUserOption(o => o.setName("user").setDescription("User to unmute").setRequired(true)),
].map(cmd => cmd.toJSON());

const rest = new REST({ version: '10' }).setToken(TOKEN);
(async () => {
  try {
    console.log("Registering global commands...");
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
    console.log("Commands registered globally!");
  } catch (err) { console.error(err); }
})();

// ---------------------------- READY ----------------------------
client.once("ready", () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  client.user.setPresence({
    status: 'idle',
    activities: [{ name: '/help | InfernoX', type: 0 }]
  });
});

// ---------------------------- WELCOME + AUTO-ROLE ----------------------------
client.on("guildMemberAdd", member => {
  // Auto-role
  const roleId = autoRoles[member.guild.id];
  if(roleId){
    const role = member.guild.roles.cache.get(roleId);
    if(role) member.roles.add(role).catch(console.error);
  }

  // Welcome embed
  const channelId = welcomeChannels[member.guild.id];
  if(!channelId) return;
  const channel = member.guild.channels.cache.get(channelId);
  if(!channel) return;

  const rulesChannel = member.guild.channels.cache.find(ch => ch.name.toLowerCase() === "rules");
  const announcementsChannel = member.guild.channels.cache.find(ch => ch.name.toLowerCase() === "announcements");
  const generalChannel = member.guild.channels.cache.find(ch => ch.name.toLowerCase() === "general");

  const embed = new EmbedBuilder()
    .setColor('#2f3136')
    .setTitle(`Welcome ${member.user}!`)
    .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
    .setDescription(
      `• **Welcome to ${member.guild.name}!**\n` +
      `Take a moment to settle in.\n\n` +
      `» Read the rules 🔱 📜 ${rulesChannel ? `<#${rulesChannel.id}>` : '/Rules'}\n` +
      `» Check the announcements 📢 ${announcementsChannel ? `<#${announcementsChannel.id}>` : '/Announcements'}\n` +
      `» Chat here 💬 ${generalChannel ? `<#${generalChannel.id}>` : '/General'}\n\n` +
      `**This is a chill place to hang out, talk, and have fun with others!**`
    )
    .setImage('https://i.ibb.co/YT3x9sK/banner.png')
    .setFooter({ text: `We have ${member.guild.memberCount} members now!` })
    .setTimestamp();

  channel.send({ embeds: [embed] });
});

// ---------------------------- MESSAGE HANDLER ----------------------------
client.on("messageCreate", async message => {
  if(message.author.bot) return;
  const guild = message.guild;
  const member = message.member;

  // ----------------- AFK -----------------
  if(afkData[message.author.id]){
    delete afkData[message.author.id];
    saveData();
    message.channel.send(`✅ Welcome back ${message.author.tag}, I removed your AFK status.`);
  }

  message.mentions.users.forEach(async user => {
    if(afkData[user.id]){
      message.channel.send(`⚠️ ${user.tag} is currently AFK: ${afkData[user.id]}`);
      try { await user.send(`💬 ${message.author.tag} mentioned you in **${guild.name}** while you were AFK.\nMessage: "${message.content}"`); } catch {}
    }
  });

  // ----------------- XP / LEVELING -----------------
  if(!levels[guild.id]) levels[guild.id] = {};
  if(!levels[guild.id][message.author.id]) levels[guild.id][message.author.id] = { xp:0, level:1 };
  const data = levels[guild.id][message.author.id];
  const xpGain = Math.floor(Math.random()*10)+5;
  data.xp += xpGain;
  const nextLevelXP = data.level*100;
  if(data.xp >= nextLevelXP){
    data.level++;
    data.xp -= nextLevelXP;
    const lvlChannelId = xpChannels[guild.id]?.[0] || message.channel.id;
    const lvlChannel = guild.channels.cache.get(lvlChannelId);
    if(lvlChannel) lvlChannel.send(`🎉 Congrats ${message.author}! You reached level ${data.level}!`);
  }
  saveData();

  // ----------------- PREFIX COMMANDS -----------------
  if(!message.content.startsWith(PREFIX)) return;
  const args = message.content.slice(PREFIX.length).trim().split(/ +/);
  const cmd = args.shift().toLowerCase();
  const isAdmin = member.permissions.has(PermissionsBitField.Flags.Administrator);

  // ---------- HELPER FUNCTION ----------
  async function fetchUser(arg){
    return message.mentions.users.first() || guild.members.cache.get(arg)?.user;
  }

  // ----------------- HELP -----------------
  if(cmd === "help"){
    const embed = new EmbedBuilder()
      .setTitle("🤖 Bot Commands")
      .setColor("Blue")
      .addFields(
        { name: "Utility", value: "`?help`, `?ping`, `?afk <reason>`" },
        { name: "Levels", value: "`?level [user]`, `?leaderboard`, `?addxp @user <amount>`, `?removexp @user <amount>`" },
        { name: "Moderation (Admin only)", value: "`?kick @user`, `?ban @user`, `?mute @user <minutes>`, `?unmute @user`, `?warn @user <reason>`, `?warnings @user`, `?announce <message>`" },
        { name: "Server Setup", value: "`?setautorole <role>`, `?setwelcome <channel>`, `?setxpchannel <channel>`" }
      );
    return message.channel.send({ embeds: [embed] });
  }

  // ---------- PING ----------
  if(cmd === "ping"){
    const msg = await message.channel.send("🏓 Pinging...");
    return msg.edit(`🏓 Pong! Latency is ${msg.createdTimestamp - message.createdTimestamp}ms.`);
  }

  // ---------- AFK ----------
  if(cmd === "afk"){
    const reason = args.join(" ") || "AFK";
    afkData[message.author.id] = reason;
    saveData();
    return message.channel.send(`✅ You are now AFK: ${reason}`);
  }

  // ---------- LEVEL ----------
  if(cmd === "level"){
    const target = await fetchUser(args[0]) || message.author;
    if(!levels[guild.id][target.id]) levels[guild.id][target.id] = { xp:0, level:1 };
    const d = levels[guild.id][target.id];
    const embed = new EmbedBuilder()
      .setTitle(`${target.tag}'s Profile`)
      .setColor("Gold")
      .setThumbnail(target.displayAvatarURL({ dynamic:true }))
      .setDescription(`**Level:** ${d.level}\n**XP:** ${d.xp}/${d.level*100}`);
    return message.channel.send({ embeds: [embed] });
  }

  // ---------- LEADERBOARD ----------
  if(cmd === "leaderboard"){
    const guildLevels = levels[guild.id];
    if(!guildLevels || !Object.keys(guildLevels).length) return message.channel.send("No level data yet.");
    const sorted = Object.entries(guildLevels).sort(([,a],[,b])=>b.level-a.level||b.xp-b.xp).slice(0,10);
    let desc="";
    for(let i=0;i<sorted.length;i++){
      const u = await client.users.fetch(sorted[i][0]).catch(()=>({tag:"Unknown#0000"}));
      const d = sorted[i][1];
      desc += `**${i+1}. ${u.tag}** - Level ${d.level} | XP ${d.xp}\n`;
    }
    const embed = new EmbedBuilder().setTitle(`🏆 Top 10 Users in ${guild.name}`).setColor("Purple").setDescription(desc).setTimestamp();
    return message.channel.send({ embeds: [embed] });
  }

  // ---------- ADMIN COMMANDS ----------
  if(!isAdmin) return; // Only admins can use the rest

  // Kick
  if(cmd==="kick"){
    const target = await fetchUser(args[0]);
    if(!target) return message.channel.send("User not found.");
    const mem = guild.members.cache.get(target.id);
    mem?.kick().then(()=>message.channel.send(`${target.tag} has been kicked.`)).catch(()=>message.channel.send("❌ Failed to kick."));
  }

  // Ban
  if(cmd==="ban"){
    const target = await fetchUser(args[0]);
    if(!target) return message.channel.send("User not found.");
    const mem = guild.members.cache.get(target.id);
    mem?.ban().then(()=>message.channel.send(`${target.tag} has been banned.`)).catch(()=>message.channel.send("❌ Failed to ban."));
  }

  // Mute
  if(cmd==="mute"){
    const target = await fetchUser(args[0]);
    const mins = parseInt(args[1]);
    if(!target || isNaN(mins)) return message.channel.send("Usage: ?mute @user <minutes>");
    const mem = guild.members.cache.get(target.id);
    let muteRole = guild.roles.cache.find(r=>r.name==="Muted");
    if(!muteRole) return message.channel.send("❌ 'Muted' role not found. Create it first.");
    mem.roles.add(muteRole).then(()=>{
      const endTime = new Date(Date.now()+mins*60*1000);
      message.channel.send(`${target.tag} muted for ${mins} min(s). Ends <t:${Math.floor(endTime.getTime()/1000)}:R>`);
      setTimeout(()=>{mem.roles.remove(muteRole).catch(()=>{});}, mins*60*1000);
    }).catch(()=>message.channel.send("❌ Failed to mute."));
  }

  // Unmute
  if(cmd==="unmute"){
    const target = await fetchUser(args[0]);
    const mem = guild.members.cache.get(target?.id);
    if(!mem) return message.channel.send("User not found.");
    let muteRole = guild.roles.cache.find(r=>r.name==="Muted");
    if(!muteRole) return message.channel.send("❌ 'Muted' role not found.");
    if(!mem.roles.cache.has(muteRole.id)) return message.channel.send("User is not muted.");
    mem.roles.remove(muteRole).then(()=>message.channel.send(`✅ ${target.tag} has been unmuted.`));
  }

  // Warn
  if(cmd==="warn"){
    const target = await fetchUser(args[0]);
    const reason = args.slice(1).join(" ");
    if(!target || !reason) return message.channel.send("Usage: ?warn @user <reason>");
    if(!warnings[guild.id]) warnings[guild.id]={};
    if(!warnings[guild.id][target.id]) warnings[guild.id][target.id]=[];
    warnings[guild.id][target.id].push(reason);
    saveData();
    message.channel.send(`${target.tag} has been warned for: ${reason}`);
  }

  // Warnings
  if(cmd==="warnings"){
    const target = await fetchUser(args[0]);
    if(!target) return message.channel.send("User not found.");
    const userWarnings = warnings[guild.id]?.[target.id]||[];
    const embed = new EmbedBuilder().setTitle(`${target.tag}'s Warnings`).setColor("Red")
      .setDescription(userWarnings.length?userWarnings.map((w,i)=>`${i+1}. ${w}`).join("\n"):"No warnings.");
    message.channel.send({ embeds: [embed] });
  }

  // Announce
  if(cmd==="announce"){
    const msgContent = args.join(" ");
    if(!msgContent) return message.channel.send("Usage: ?announce <message>");
    const embed = new EmbedBuilder()
      .setTitle("📢 Announcement")
      .setDescription(msgContent)
      .setColor("Orange")
      .setFooter({ text: `Announcement by ${message.author.tag}`, iconURL: message.author.displayAvatarURL({ dynamic:true }) })
      .setTimestamp();
    message.channel.send({ embeds: [embed] });
  }

  // AddXP / RemoveXP
  if(cmd==="addxp" || cmd==="removexp"){
    const target = await fetchUser(args[0]);
    const amt = parseInt(args[1]);
    if(!target || isNaN(amt)) return message.channel.send("Usage: ?addxp @user <amount>");
    if(!levels[guild.id][target.id]) levels[guild.id][target.id]={xp:0,level:1};
    if(cmd==="addxp") levels[guild.id][target.id].xp += amt;
    else levels[guild.id][target.id].xp = Math.max(0, levels[guild.id][target.id].xp - amt);
    saveData();
    message.channel.send(`${cmd==="addxp"? "Added":"Removed"} ${amt} XP ${cmd==="addxp"? "to":"from"} ${target.tag}`);
  }

  // SetAutoRole
  if(cmd==="setautorole"){
    const role = guild.roles.cache.get(args[0].replace(/\D/g,""));
    if(!role) return message.channel.send("Role not found.");
    autoRoles[guild.id] = role.id;
    saveData();
    message.channel.send(`✅ Auto-role set to ${role.name}`);
  }

  // SetWelcome
  if(cmd==="setwelcome"){
    const ch = guild.channels.cache.get(args[0].replace(/\D/g,""));
    if(!ch) return message.channel.send("Channel not found.");
    welcomeChannels[guild.id]=ch.id;
    saveData();
    message.channel.send(`✅ Welcome channel set to ${ch.name}`);
  }

  // SetXPChannel
  if(cmd==="setxpchannel"){
    const ch = guild.channels.cache.get(args[0].replace(/\D/g,""));
    if(!ch) return message.channel.send("Channel not found.");
    xpChannels[guild.id]=[ch.id];
    saveData();
    message.channel.send(`✅ XP channel set to ${ch.name}`);
  }
});

// ---------------------------- LOGIN ----------------------------
client.login(TOKEN);
