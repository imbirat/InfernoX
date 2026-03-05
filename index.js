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
  new SlashCommandBuilder().setName("setwelcome").setDescription("Set welcome channel (admin only)")
    .addChannelOption(o => o.setName("channel").setDescription("Channel for welcome messages").setRequired(true)),
  new SlashCommandBuilder().setName("setautorole").setDescription("Set role to auto-assign to new members")
    .addRoleOption(o => o.setName("role").setDescription("Role to auto-assign").setRequired(true)),
  new SlashCommandBuilder().setName("setxpchannel").setDescription("Set channel for level-up messages")
    .addChannelOption(o => o.setName("channel").setDescription("Channel for level-up messages").setRequired(true))
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

  // Welcome message
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

// ---------- INTERACTION HANDLER ----------
client.on("interactionCreate", async interaction => {
  if(!interaction.isCommand()) return;
  const { commandName, guild, member } = interaction;
  const isAdminPerm = member.permissions.has(PermissionsBitField.Flags.Administrator);

  // Admin-only commands
  const adminCommands = ["setautorole", "setxpchannel", "setwelcome"];
  if(adminCommands.includes(commandName) && !isAdminPerm)
    return interaction.reply({ content: "❌ Admin permission required.", ephemeral: true });

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

});

// ---------- LOGIN ----------
client.login(TOKEN);
