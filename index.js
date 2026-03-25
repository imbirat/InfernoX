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
const ECON_FILE = './economy.json';
const SHOP_FILE = './shop.json';

let levels = fs.existsSync(LEVELS_FILE) ? JSON.parse(fs.readFileSync(LEVELS_FILE)) : {};
let warnings = fs.existsSync(WARNINGS_FILE) ? JSON.parse(fs.readFileSync(WARNINGS_FILE)) : {};
let xpChannels = fs.existsSync(XPCHANNELS_FILE) ? JSON.parse(fs.readFileSync(XPCHANNELS_FILE)) : {};
let afkData = fs.existsSync(AFK_FILE) ? JSON.parse(fs.readFileSync(AFK_FILE)) : {};
let autoRoles = fs.existsSync(AUTOROLE_FILE) ? JSON.parse(fs.readFileSync(AUTOROLE_FILE)) : {};
let welcomeChannels = fs.existsSync(WELCOME_FILE) ? JSON.parse(fs.readFileSync(WELCOME_FILE)) : {};
let economy = fs.existsSync(ECON_FILE) ? JSON.parse(fs.readFileSync(ECON_FILE)) : {};
let shop = fs.existsSync(SHOP_FILE) ? JSON.parse(fs.readFileSync(SHOP_FILE)) : {};

// ---------- SAVE FUNCTIONS ----------
function saveData(){
  fs.writeFileSync(LEVELS_FILE, JSON.stringify(levels, null, 2));
  fs.writeFileSync(WARNINGS_FILE, JSON.stringify(warnings, null, 2));
  fs.writeFileSync(XPCHANNELS_FILE, JSON.stringify(xpChannels, null, 2));
  fs.writeFileSync(AFK_FILE, JSON.stringify(afkData, null, 2));
  fs.writeFileSync(AUTOROLE_FILE, JSON.stringify(autoRoles, null, 2));
  fs.writeFileSync(WELCOME_FILE, JSON.stringify(welcomeChannels, null, 2));
}
function saveEconomy() { fs.writeFileSync(ECON_FILE, JSON.stringify(economy, null, 2)); }
function saveShop() { fs.writeFileSync(SHOP_FILE, JSON.stringify(shop, null, 2)); }
function ensureUser(id){ if(!economy[id]) economy[id] = { cash:0, lastDaily:0, inventory: [] }; }

// ---------- SLASH COMMANDS ----------
const commands = [
  new SlashCommandBuilder().setName("help").setDescription("Shows all bot commands"),
  new SlashCommandBuilder().setName("ping").setDescription("Check bot latency"),
  new SlashCommandBuilder().setName("afk").setDescription("Set yourself as AFK").addStringOption(o=>o.setName("reason").setDescription("Reason")),
  new SlashCommandBuilder().setName("level").setDescription("Check your level/profile").addUserOption(o=>o.setName("user").setDescription("User to check")),
  new SlashCommandBuilder().setName("addxp").setDescription("Add XP to a user")
    .addUserOption(o=>o.setName("user").setDescription("User").setRequired(true))
    .addIntegerOption(o=>o.setName("amount").setDescription("XP").setRequired(true)),
  new SlashCommandBuilder().setName("removexp").setDescription("Remove XP from a user")
    .addUserOption(o=>o.setName("user").setDescription("User").setRequired(true))
    .addIntegerOption(o=>o.setName("amount").setDescription("XP").setRequired(true)),
  new SlashCommandBuilder().setName("leaderboard").setDescription("Top 10 users by level"),
  new SlashCommandBuilder().setName("setxpchannel").setDescription("Set XP channel").addChannelOption(o=>o.setName("channel").setDescription("Channel").setRequired(true)),
  new SlashCommandBuilder().setName("setautorole").setDescription("Set auto role").addRoleOption(o=>o.setName("role").setDescription("Role").setRequired(true)),
  new SlashCommandBuilder().setName("setwelcome").setDescription("Set welcome channel").addChannelOption(o=>o.setName("channel").setDescription("Channel").setRequired(true)),
  new SlashCommandBuilder().setName("announce").setDescription("Make an announcement").addStringOption(o=>o.setName("message").setDescription("Message").setRequired(true)),
  new SlashCommandBuilder().setName("kick").setDescription("Kick user").addUserOption(o=>o.setName("user").setDescription("User").setRequired(true)),
  new SlashCommandBuilder().setName("ban").setDescription("Ban user").addUserOption(o=>o.setName("user").setDescription("User").setRequired(true)),
  new SlashCommandBuilder().setName("warn").setDescription("Warn user").addUserOption(o=>o.setName("user").setDescription("User").setRequired(true)).addStringOption(o=>o.setName("reason").setDescription("Reason").setRequired(true)),
  new SlashCommandBuilder().setName("warnings").setDescription("Check warnings").addUserOption(o=>o.setName("user").setDescription("User").setRequired(true)),
  new SlashCommandBuilder().setName("mute").setDescription("Mute user").addUserOption(o=>o.setName("user").setDescription("User").setRequired(true)).addIntegerOption(o=>o.setName("minutes").setDescription("Minutes").setRequired(true)),
  new SlashCommandBuilder().setName("unmute").setDescription("Unmute user").addUserOption(o=>o.setName("user").setDescription("User").setRequired(true)),

  // Economy
  new SlashCommandBuilder().setName("cash").setDescription("Check your cash").addUserOption(o=>o.setName("user").setDescription("User")),
  new SlashCommandBuilder().setName("daily").setDescription("Claim daily reward"),
  new SlashCommandBuilder().setName("give").setDescription("Give cash").addUserOption(o=>o.setName("user").setDescription("User").setRequired(true)).addIntegerOption(o=>o.setName("amount").setDescription("Amount").setRequired(true)),
  new SlashCommandBuilder().setName("fish").setDescription("Go fishing for cash"),
  new SlashCommandBuilder().setName("rob").setDescription("Rob another user").addUserOption(o=>o.setName("user").setDescription("User").setRequired(true)),
  new SlashCommandBuilder().setName("gamble").setDescription("Gamble cash").addIntegerOption(o=>o.setName("amount").setDescription("Amount").setRequired(true)),
  new SlashCommandBuilder().setName("shop").setDescription("View shop items"),
  new SlashCommandBuilder().setName("buy").setDescription("Buy an item from the shop").addStringOption(o=>o.setName("item").setDescription("Item name").setRequired(true)),
].map(cmd => cmd.toJSON());

// ---------- REGISTER COMMANDS ----------
const rest = new REST({ version: '10' }).setToken(TOKEN);
(async ()=>{
  try{
    console.log("Registering commands...");
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
    console.log("Commands registered!");
  }catch(err){console.error(err);}
})();

// ---------- READY ----------
client.once("ready", ()=>{
  console.log(`✅ Logged in as ${client.user.tag}`);
  client.user.setPresence({ status: 'idle', activities:[{ name: '/help | Xyrox', type: 0 }] });
});

// ---------- WELCOME MESSAGE ----------
client.on("guildMemberAdd", member => {
  const roleId = autoRoles[member.guild.id];
  if(roleId){
    const role = member.guild.roles.cache.get(roleId);
    if(role) member.roles.add(role).catch(console.error);
  }

  const channelId = welcomeChannels[member.guild.id];
  if(channelId){
    const channel = member.guild.channels.cache.get(channelId);
    if(channel){
      const embed = new EmbedBuilder()
        .setColor('#00ffcc')
        .setTitle('🎉 Welcome!')
        .setDescription(
          `Welcome ${member} to **${member.guild.name}**!\n` +
          `Make sure to read rules <#rules>.\n` +
          `Enjoy your stay!`
        )
        .setFooter({ text: `Member #${member.guild.memberCount}` })
        .setTimestamp();
      channel.send({ embeds: [embed] });

      // Send rules automatically
      const rulesEmbed = new EmbedBuilder()
        .setColor(0x2f3136)
        .setTitle("📜 Discord Server Rules")
        .setDescription(
          "**1. Respect Everyone**\nNo harassment, bullying, hate speech, or discrimination.\n\n" +
          "**2. No Spamming**\nAvoid spam, links or self-promotion.\n\n" +
          "**3. Keep Content Appropriate**\nNo NSFW, illegal, or pirated content.\n\n" +
          "**4. Respect Privacy**\nNo doxxing or sharing personal info without consent.\n\n" +
          "**5. No Advertising**\nAdvertising other servers, bots, or products is not allowed without permission.\n\n" +
          "**6. Follow Staff Instructions**\nAlways respect moderators and admins; their decisions are final.\n\n" +
          "**7. No Impersonation**\nDo not impersonate staff or other members.\n\n" +
          "**9. Have Fun!** 🎉\nEnjoy yourself and help create a friendly community!"
        )
        .setFooter({ text: "Follow the rules to keep the server safe and fun!" });
      channel.send({ embeds: [rulesEmbed] });
    }
  }
});

// ---------- MESSAGE HANDLER ----------
client.on("messageCreate", async message => {
  if(message.author.bot) return;

  // AFK return
  if(afkData[message.author.id]){
    delete afkData[message.author.id];
    saveData();
    message.channel.send(`✅ Welcome back ${message.author.tag}, I removed your AFK status.`);
  }

  message.mentions.users.forEach(async user => {
    if(afkData[user.id]){
      message.channel.send(`⚠️ ${user.tag} is currently AFK: ${afkData[user.id]}`);
    }
  });

  // Rules command
  if(message.content === "?rules"){
    const embed = new EmbedBuilder()
      .setColor(0x2f3136)
      .setTitle("📜 Discord Server Rules")
      .setDescription(
        "**1. Respect Everyone**\nNo harassment, bullying, hate speech, or discrimination.\n\n" +
        "**2. No Spamming**\nAvoid spam, links or self-promotion.\n\n" +
        "**3. Keep Content Appropriate**\nNo NSFW, illegal, or pirated content.\n\n" +
        "**4. Respect Privacy**\nNo doxxing or sharing personal info without consent.\n\n" +
        "**5. No Advertising**\nAdvertising other servers, bots, or products is not allowed without permission.\n\n" +
        "**6. Follow Staff Instructions**\nAlways respect moderators and admins; their decisions are final.\n\n" +
        "**7. No Impersonation**\nDo not impersonate staff or other members.\n\n" +
        "**9. Have Fun!** 🎉\nEnjoy yourself and help create a friendly community!"
      )
      .setFooter({ text: "Follow the rules to keep the server safe and fun!" });
    message.channel.send({ embeds: [embed] });
  }
});

// ---------- INTERACTION HANDLER ----------
client.on("interactionCreate", async interaction=>{
  if(!interaction.isCommand()) return;
  const { commandName, guild, member } = interaction;
  const isAdmin = member.permissions.has(PermissionsBitField.Flags.Administrator);

  // Economy and commands handled here...
  // (You can add the economy code from previous all-in-one example here)
});

client.login(TOKEN);
