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
const XPCHANNELS_FILE = './xpChannels.json'; // Only used for level-up messages

let levels = fs.existsSync(LEVELS_FILE) ? JSON.parse(fs.readFileSync(LEVELS_FILE)) : {};
let warnings = fs.existsSync(WARNINGS_FILE) ? JSON.parse(fs.readFileSync(WARNINGS_FILE)) : {};
let xpChannels = fs.existsSync(XPCHANNELS_FILE) ? JSON.parse(fs.readFileSync(XPCHANNELS_FILE)) : {};

function saveData(){
  fs.writeFileSync(LEVELS_FILE, JSON.stringify(levels, null, 2));
  fs.writeFileSync(WARNINGS_FILE, JSON.stringify(warnings, null, 2));
  fs.writeFileSync(XPCHANNELS_FILE, JSON.stringify(xpChannels, null, 2));
}

// ---------- SLASH COMMANDS ----------
const commands = [
  new SlashCommandBuilder().setName("help").setDescription("Shows all bot commands"),

  new SlashCommandBuilder().setName("kick").setDescription("Kick a member")
    .addUserOption(option => option.setName("user").setDescription("User to kick").setRequired(true)),

  new SlashCommandBuilder().setName("ban").setDescription("Ban a member")
    .addUserOption(option => option.setName("user").setDescription("User to ban").setRequired(true)),

  new SlashCommandBuilder().setName("mute").setDescription("Mute a member temporarily")
    .addUserOption(option => option.setName("user").setDescription("User to mute").setRequired(true))
    .addIntegerOption(option => option.setName("minutes").setDescription("Duration in minutes").setRequired(true)),

  new SlashCommandBuilder().setName("warn").setDescription("Warn a member")
    .addUserOption(option => option.setName("user").setDescription("User to warn").setRequired(true))
    .addStringOption(option => option.setName("reason").setDescription("Reason for warning").setRequired(true)),

  new SlashCommandBuilder().setName("warnings").setDescription("Check warnings for a user")
    .addUserOption(option => option.setName("user").setDescription("User to check").setRequired(true)),

  new SlashCommandBuilder().setName("level").setDescription("Check your profile or level")
    .addUserOption(option => option.setName("user").setDescription("Check someone else's profile")),

  new SlashCommandBuilder().setName("addxp").setDescription("Add XP to a user")
    .addUserOption(option => option.setName("user").setDescription("User to add XP").setRequired(true))
    .addIntegerOption(option => option.setName("amount").setDescription("XP amount").setRequired(true)),

  new SlashCommandBuilder().setName("removexp").setDescription("Remove XP from a user")
    .addUserOption(option => option.setName("user").setDescription("User to remove XP").setRequired(true))
    .addIntegerOption(option => option.setName("amount").setDescription("XP amount").setRequired(true)),

  new SlashCommandBuilder().setName("leaderboard").setDescription("Shows top 10 users by level"),

  new SlashCommandBuilder().setName("setxpchannel").setDescription("Set a channel where level-up messages will appear")
    .addChannelOption(option => option.setName("channel").setDescription("Channel for level-up messages").setRequired(true))
].map(cmd => cmd.toJSON());

const rest = new REST({ version: '10' }).setToken(TOKEN);

// Register global commands
(async () => {
  try {
    console.log("Registering global commands...");
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
    console.log("Commands registered globally!");
  } catch (err) {
    console.error(err);
  }
})();

// ---------- BOT EVENTS ----------
client.once("ready", () => console.log(`✅ Logged in as ${client.user.tag}`));

// ---------- WELCOME + AUTO-ROLE ----------
client.on("guildMemberAdd", member => {
  const role = member.guild.roles.cache.find(r => r.name === "AutoRole");
  if(role) member.roles.add(role).catch(console.error);

  const channel = member.guild.channels.cache.find(c => c.name === "welcome");
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
});

// ---------- MESSAGE HANDLER ----------
client.on("messageCreate", message => {
  if(message.author.bot) return;

  // Give XP to everyone for all messages
  if(!levels[message.guild.id]) levels[message.guild.id] = {};
  if(!levels[message.guild.id][message.author.id]) levels[message.guild.id][message.author.id] = { xp: 0, level: 1 };

  const userData = levels[message.guild.id][message.author.id];
  const xpGain = Math.floor(Math.random() * 10) + 5;
  userData.xp += xpGain;

  const nextLevelXP = userData.level * 100;
  if(userData.xp >= nextLevelXP){
    userData.level++;
    userData.xp -= nextLevelXP;

    // Send level-up in the channel set via /setxpchannel
    const lvlChannelId = xpChannels[message.guild.id]?.[0] || message.channel.id;
    const lvlChannel = message.guild.channels.cache.get(lvlChannelId);
    if(lvlChannel) lvlChannel.send(`🎉 Congrats ${message.author}! You reached level ${userData.level}!`);
  }

  saveData();
});

// ---------- SLASH COMMAND HANDLER ----------
client.on("interactionCreate", async interaction => {
  if(!interaction.isCommand()) return;
  const { commandName, guild, member } = interaction;

  if(!levels[guild.id]) levels[guild.id] = {};
  if(!warnings[guild.id]) warnings[guild.id] = {};

  const isAdminPerm = member.permissions.has(PermissionsBitField.Flags.Administrator);

  // ---------- HELP ----------
  if(commandName === "help"){
    const embed = new EmbedBuilder()
      .setTitle("🤖 Bot Commands")
      .setColor("Blue")
      .setDescription("Available commands:")
      .addFields(
        { name: "/kick @user", value: "Kick a member (Admin only)", inline: true },
        { name: "/ban @user", value: "Ban a member (Admin only)", inline: true },
        { name: "/mute @user <minutes>", value: "Temporarily mute a member (Admin only)", inline: true },
        { name: "/warn @user <reason>", value: "Warn a member (Admin only)", inline: true },
        { name: "/warnings @user", value: "Check warnings (Admin only)", inline: true },
        { name: "/level", value: "Check your level/profile", inline: true },
        { name: "/addxp @user <amount>", value: "Add XP to a user (Admin only)", inline: true },
        { name: "/removexp @user <amount>", value: "Remove XP from a user (Admin only)", inline: true },
        { name: "/leaderboard", value: "Show top 10 users by level", inline: true },
        { name: "/setxpchannel", value: "Set channel for level-up messages (Admin only)" }
      )
      .setFooter({ text: `Requested by ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: false });
  }

  // ---------- ADMIN CHECK ----------
  const adminCommands = ["kick","ban","mute","warn","warnings","addxp","removexp","setxpchannel"];
  if(adminCommands.includes(commandName) && !isAdminPerm){
    return interaction.reply({ content: "❌ You need Administrator permission to use this command.", ephemeral: true });
  }

  // ---------- KICK ----------
  if(commandName === "kick"){
    const target = interaction.options.getUser("user");
    const memberTarget = guild.members.cache.get(target.id);
    if(!memberTarget) return interaction.reply("User not found.");
    memberTarget.kick().then(() => interaction.reply(`${target.tag} has been kicked.`))
                        .catch(() => interaction.reply("Failed to kick."));
  }

  // ---------- BAN ----------
  if(commandName === "ban"){
    const target = interaction.options.getUser("user");
    const memberTarget = guild.members.cache.get(target.id);
    if(!memberTarget) return interaction.reply("User not found.");
    memberTarget.ban().then(() => interaction.reply(`${target.tag} has been banned.`))
                       .catch(() => interaction.reply("Failed to ban."));
  }

  // ---------- MUTE ----------
  if(commandName === "mute"){
    const target = interaction.options.getUser("user");
    const minutes = interaction.options.getInteger("minutes");
    const memberTarget = guild.members.cache.get(target.id);
    if(!memberTarget) return interaction.reply("User not found.");
    interaction.reply(`${target.tag} has been muted for ${minutes} minutes. (Set up a Muted role manually)`);
  }

  // ---------- WARN ----------
  if(commandName === "warn"){
    const target = interaction.options.getUser("user");
    const reason = interaction.options.getString("reason");
    if(!warnings[guild.id][target.id]) warnings[guild.id][target.id] = [];
    warnings[guild.id][target.id].push(reason);
    saveData();
    interaction.reply(`${target.tag} has been warned for: ${reason}`);
  }

  // ---------- WARNINGS ----------
  if(commandName === "warnings"){
    const target = interaction.options.getUser("user");
    const userWarnings = warnings[guild.id][target.id] || [];
    interaction.reply(`${target.tag} has ${userWarnings.length} warnings:\n${userWarnings.join("\n") || "No warnings."}`);
  }

  // ---------- LEVEL PROFILE ----------
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

  // ---------- ADD XP ----------
  if(commandName === "addxp"){
    const targetUser = interaction.options.getUser("user");
    const amount = interaction.options.getInteger("amount");
    if(!levels[guild.id][targetUser.id]) levels[guild.id][targetUser.id] = { xp: 0, level: 1 };
    levels[guild.id][targetUser.id].xp += amount;
    saveData();
    interaction.reply(`✅ Added ${amount} XP to ${targetUser.tag}.`);
  }

  // ---------- REMOVE XP ----------
  if(commandName === "removexp"){
    const targetUser = interaction.options.getUser("user");
    const amount = interaction.options.getInteger("amount");
    if(!levels[guild.id][targetUser.id]) levels[guild.id][targetUser.id] = { xp: 0, level: 1 };
    levels[guild.id][targetUser.id].xp -= amount;
    if(levels[guild.id][targetUser.id].xp < 0) levels[guild.id][targetUser.id].xp = 0;
    saveData();
    interaction.reply(`✅ Removed ${amount} XP from ${targetUser.tag}.`);
  }

  // ---------- LEADERBOARD ----------
  if(commandName === "leaderboard"){
    const guildLevels = levels[guild.id];
    if(!guildLevels || Object.keys(guildLevels).length === 0) 
      return interaction.reply("No level data yet.");

    const sorted = Object.entries(guildLevels)
      .sort(([,a],[,b]) => b.level - a.level || b.xp - a.xp)
      .slice(0, 10);

    let description = "";
    for(let i=0;i<sorted.length;i++){
      const userId = sorted[i][0];
      const data = sorted[i][1];
      const user = await client.users.fetch(userId).catch(()=>({tag:"Unknown#0000"}));
      description += `**${i+1}. ${user.tag}** - Level ${data.level} | XP ${data.xp}\n`;
    }

    const embed = new EmbedBuilder()
      .setTitle(`🏆 Top 10 Users in ${guild.name}`)
      .setColor("Purple")
      .setDescription(description)
      .setTimestamp();

    interaction.reply({ embeds: [embed] });
  }

  // ---------- SET XP CHANNEL ----------
  if(commandName === "setxpchannel"){
    const channel = interaction.options.getChannel("channel");
    xpChannels[guild.id] = [channel.id]; // only one channel
    saveData();
    interaction.reply(`✅ Level-up messages will now appear in ${channel}.`);
  }
});

// ---------- LOGIN ----------
client.login(TOKEN);