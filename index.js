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

// ---------- SLASH COMMANDS ----------
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
].map(cmd => cmd.toJSON());

// ---------- REGISTER COMMANDS ----------
const rest = new REST({ version: '10' }).setToken(TOKEN);
(async () => {
  try {
    console.log("Registering global commands...");
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
    console.log("Commands registered globally!");
  } catch (err) { console.error(err); }
})();

// ---------- READY ----------
client.once("ready", () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  client.user.setPresence({
    status: 'idle',
    activities: [{ name: '/help | InfernoX', type: 0 }]
  });
});

// ---------- WELCOME + AUTO-ROLE ----------
client.on("guildMemberAdd", member => {
  // Auto-role
  const roleId = autoRoles[member.guild.id];
  if(roleId){
    const role = member.guild.roles.cache.get(roleId);
    if(role) member.roles.add(role).catch(console.error);
  }

  // Welcome embed
  const channelId = welcomeChannels[member.guild.id];
  if(channelId){
    const channel = member.guild.channels.cache.get(channelId);
    if(channel){
      const embed = new EmbedBuilder()
        .setColor('#00ffcc')
        .setTitle('🎉 Welcome!')
        .setDescription(`Welcome ${member} to **${member.guild.name}**!\nEnjoy your stay!`)
        .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
        .setFooter({ text: `Member #${member.guild.memberCount}` })
        .setTimestamp();
      channel.send({ embeds: [embed] });
    }
  }
});

// ---------- MESSAGE HANDLER ----------
client.on("messageCreate", async message => {
  if(message.author.bot) return;

  // Remove AFK if user sends message
  if(afkData[message.author.id]){
    delete afkData[message.author.id];
    saveData();
    message.channel.send(`✅ Welcome back ${message.author.tag}, I removed your AFK status.`);
  }

  // Notify if mentioned user is AFK
  message.mentions.users.forEach(async user => {
    if(afkData[user.id]){
      message.channel.send(`⚠️ ${user.tag} is currently AFK: ${afkData[user.id]}`);
      try { await user.send(`💬 ${message.author.tag} mentioned you in **${message.guild.name}** while you were AFK.\nMessage: "${message.content}"`); } catch {}
    }
  });

  // XP & leveling
  if(!levels[message.guild.id]) levels[message.guild.id] = {};
  if(!levels[message.guild.id][message.author.id]) levels[message.guild.id][message.author.id] = { xp: 0, level: 1 };

  const userData = levels[message.guild.id][message.author.id];
  const xpGain = Math.floor(Math.random() * 10) + 5;
  userData.xp += xpGain;

  const nextLevelXP = userData.level * 100;
  if(userData.xp >= nextLevelXP){
    userData.level++;
    userData.xp -= nextLevelXP;

    const lvlChannelId = xpChannels[message.guild.id]?.[0] || message.channel.id;
    const lvlChannel = message.guild.channels.cache.get(lvlChannelId);
    if(lvlChannel) lvlChannel.send(`🎉 Congrats ${message.author}! You reached level ${userData.level}!`);
  }

  saveData();
});

// ---------- INTERACTION HANDLER ----------
client.on("interactionCreate", async interaction => {
  if(!interaction.isCommand()) return;
  const { commandName, guild, member } = interaction;
  const isAdminPerm = member.permissions.has(PermissionsBitField.Flags.Administrator);

  // Admin-only commands
  const adminCommands = ["setautorole", "setxpchannel", "setwelcome"];
  if(adminCommands.includes(commandName) && !isAdminPerm)
    return interaction.reply({ content: "❌ Admin permission required.", ephemeral: true });

  // ---------- HELP ----------
  if(commandName === "help"){
    const embed = new EmbedBuilder()
      .setTitle("🤖 Bot Commands")
      .setColor("Blue")
      .setDescription("Here are my main commands:")
      .addFields(
        { name: "Moderation", value: "`/kick @user`\n`/ban @user`\n`/mute @user <minutes>`\n`/warn @user <reason>`\n`/warnings @user`" },
        { name: "Levels & XP", value: "`/level`\n`/addxp @user <amount>`\n`/removexp @user <amount>`\n`/leaderboard`\n`/setxpchannel`" },
        { name: "Utility", value: "`/ping`\n`/afk <reason>`\n`/setautorole`\n`/setwelcome`" }
      )
      .setFooter({ text: `Requested by ${interaction.user.tag}` })
      .setTimestamp();
    return interaction.reply({ embeds: [embed] });
  }

  // ---------- SET WELCOME ----------
  if(commandName === "setwelcome"){
    const channel = interaction.options.getChannel("channel");
    welcomeChannels[guild.id] = channel.id;
    saveData();
    return interaction.reply(`✅ Welcome messages will now appear in ${channel}.`);
  }

  // ---------- SET AUTO-ROLE ----------
  if(commandName === "setautorole"){
    const role = interaction.options.getRole("role");
    autoRoles[guild.id] = role.id;
    saveData();
    return interaction.reply(`✅ Auto-role set to ${role.name}.`);
  }

  // ---------- SET XP CHANNEL ----------
  if(commandName === "setxpchannel"){
    const channel = interaction.options.getChannel("channel");
    xpChannels[guild.id] = [channel.id];
    saveData();
    return interaction.reply(`✅ Level-up messages will now appear in ${channel}.`);
  }

  // ---------- PING ----------
  if(commandName === "ping"){
    const msg = await interaction.reply({ content: "🏓 Pinging...", fetchReply: true });
    interaction.editReply(`🏓 Pong! Latency is ${msg.createdTimestamp - interaction.createdTimestamp}ms.`);
  }

  // ---------- AFK ----------
  if(commandName === "afk"){
    const reason = interaction.options.getString("reason") || "AFK";
    afkData[interaction.user.id] = reason;
    saveData();
    interaction.reply(`✅ You are now AFK: ${reason}`);
  }

  // ---------- LEVEL ----------
  if(commandName === "level"){
    const targetUser = interaction.options.getUser("user") || interaction.user;
    if(!levels[guild.id][targetUser.id]) levels[guild.id][targetUser.id] = { xp: 0, level: 1 };
    const data = levels[guild.id][targetUser.id];
    const embed = new EmbedBuilder()
      .setTitle(`${targetUser.tag}'s Profile`)
      .setColor("Gold")
      .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
      .setDescription(`**Level:** ${data.level}\n**XP:** ${data.xp}/${data.level * 100}`);
    interaction.reply({ embeds: [embed] });
  }

  // ---------- ADD/REMOVE XP ----------
  if(commandName === "addxp" || commandName === "removexp"){
    const targetUser = interaction.options.getUser("user");
    const amount = interaction.options.getInteger("amount");
    if(!levels[guild.id][targetUser.id]) levels[guild.id][targetUser.id] = { xp: 0, level: 1 };
    if(commandName === "addxp") levels[guild.id][targetUser.id].xp += amount;
    else {
      levels[guild.id][targetUser.id].xp -= amount;
      if(levels[guild.id][targetUser.id].xp < 0) levels[guild.id][targetUser.id].xp = 0;
    }
    saveData();
    interaction.reply(`✅ ${commandName === "addxp" ? "Added" : "Removed"} ${amount} XP for ${targetUser.tag}.`);
  }

  // ---------- LEADERBOARD ----------
  if(commandName === "leaderboard"){
    const guildLevels = levels[guild.id];
    if(!guildLevels || Object.keys(guildLevels).length === 0) 
      return interaction.reply("No level data yet.");
    const sorted = Object.entries(guildLevels)
      .sort(([,a],[,b]) => b.level - a.level || b.xp - a.xp)
      .slice(0, 10);
    let desc = "";
    for(let i=0;i<sorted.length;i++){
      const userId = sorted[i][0];
      const data = sorted[i][1];
      const user = await client.users.fetch(userId).catch(()=>({tag:"Unknown#0000"}));
      desc += `**${i+1}. ${user.tag}** - Level ${data.level} | XP ${data.xp}\n`;
    }
    const embed = new EmbedBuilder()
      .setTitle(`🏆 Top 10 Users in ${guild.name}`)
      .setColor("Purple")
      .setDescription(desc)
      .setTimestamp();
    interaction.reply({ embeds: [embed] });
  }
});

// ---------- LOGIN ----------
client.login(TOKEN);
