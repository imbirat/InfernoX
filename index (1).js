const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, PermissionsBitField, EmbedBuilder } = require('discord.js');
const express = require('express');

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

// ---------- SLASH COMMANDS ----------
const commands = [
  new SlashCommandBuilder()
    .setName("help")
    .setDescription("Shows all bot commands"),

  new SlashCommandBuilder()
    .setName("kick")
    .setDescription("Kick a member")
    .addUserOption(option => option.setName("user").setDescription("User to kick").setRequired(true)),

  new SlashCommandBuilder()
    .setName("ban")
    .setDescription("Ban a member")
    .addUserOption(option => option.setName("user").setDescription("User to ban").setRequired(true)),

  new SlashCommandBuilder()
    .setName("mute")
    .setDescription("Mute a member temporarily")
    .addUserOption(option => option.setName("user").setDescription("User to mute").setRequired(true))
    .addIntegerOption(option => option.setName("minutes").setDescription("Duration in minutes").setRequired(true)),

  new SlashCommandBuilder()
    .setName("warn")
    .setDescription("Warn a member")
    .addUserOption(option => option.setName("user").setDescription("User to warn").setRequired(true))
    .addStringOption(option => option.setName("reason").setDescription("Reason for warning").setRequired(true)),

  new SlashCommandBuilder()
    .setName("warnings")
    .setDescription("Check warnings for a user")
    .addUserOption(option => option.setName("user").setDescription("User to check").setRequired(true))
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
client.on("ready", () => {
  console.log(`${client.user.tag} is online!`);
});

// Auto role when someone joins
client.on("guildMemberAdd", member => {
  const role = member.guild.roles.cache.find(r => r.name === "AutoRole");
  if(role) member.roles.add(role).catch(console.error);

  const channel = member.guild.channels.cache.find(c => c.name === "welcome");
  if(channel) channel.send(`Welcome ${member.user}! You got the AutoRole.`);
});

// ---------- SLASH COMMAND HANDLING ----------
const warnings = {}; // In-memory warnings

client.on("interactionCreate", async interaction => {
  if(!interaction.isCommand()) return;
  const { commandName, guild, member } = interaction;

  if(!warnings[guild.id]) warnings[guild.id] = {};

  // ---------- HELP EMBED ----------
  if(commandName === "help"){
    const embed = new EmbedBuilder()
      .setTitle("🤖 Bot Commands")
      .setColor("Blue")
      .setDescription("Here are the available commands:")
      .addFields(
        { name: "/kick @user", value: "Kick a member", inline: true },
        { name: "/ban @user", value: "Ban a member", inline: true },
        { name: "/mute @user <minutes>", value: "Temporarily mute a member", inline: true },
        { name: "/warn @user <reason>", value: "Warn a member", inline: true },
        { name: "/warnings @user", value: "Check warnings", inline: true },
        { name: "Auto-role", value: "Assigned to new members automatically" }
      )
      .setFooter({ text: `Requested by ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: false }); // Visible to everyone
  }

  // ---------- OTHER COMMANDS (kick, ban, mute, warn, warnings) ----------
  // ... same as before, unchanged
});
client.login(TOKEN);