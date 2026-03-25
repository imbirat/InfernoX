```js
const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  PermissionsBitField,
  EmbedBuilder
} = require("discord.js");

const fs = require("fs");
const express = require("express");

/* ---------------- EXPRESS 24/7 ---------------- */

const app = express();
app.get("/", (req, res) => res.send("Bot online"));
app.listen(3000, () => console.log("Web server ready"));

/* ---------------- CLIENT ---------------- */

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

/* ---------------- FILES ---------------- */

const LEVEL_FILE = "./levels.json";
const ECON_FILE = "./economy.json";
const WARN_FILE = "./warnings.json";
const AFK_FILE = "./afk.json";
const CONFIG_FILE = "./config.json";

let levels = fs.existsSync(LEVEL_FILE) ? JSON.parse(fs.readFileSync(LEVEL_FILE)) : {};
let economy = fs.existsSync(ECON_FILE) ? JSON.parse(fs.readFileSync(ECON_FILE)) : {};
let warnings = fs.existsSync(WARN_FILE) ? JSON.parse(fs.readFileSync(WARN_FILE)) : {};
let afk = fs.existsSync(AFK_FILE) ? JSON.parse(fs.readFileSync(AFK_FILE)) : {};
let config = fs.existsSync(CONFIG_FILE) ? JSON.parse(fs.readFileSync(CONFIG_FILE)) : {};

/* ---------------- SAVE ---------------- */

function saveAll() {
  fs.writeFileSync(LEVEL_FILE, JSON.stringify(levels, null, 2));
  fs.writeFileSync(ECON_FILE, JSON.stringify(economy, null, 2));
  fs.writeFileSync(WARN_FILE, JSON.stringify(warnings, null, 2));
  fs.writeFileSync(AFK_FILE, JSON.stringify(afk, null, 2));
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

/* ---------------- ECONOMY ---------------- */

function ensureUser(id) {
  if (!economy[id]) economy[id] = { cash: 0, bank: 0, inventory: [], lastDaily: 0 };
}

/* ---------------- COMMANDS ---------------- */

const commands = [

new SlashCommandBuilder().setName("ping").setDescription("Check bot ping"),

new SlashCommandBuilder().setName("help").setDescription("Command list"),

new SlashCommandBuilder()
.setName("afk")
.setDescription("Set AFK")
.addStringOption(o => o.setName("reason").setDescription("Reason")),

new SlashCommandBuilder()
.setName("level")
.setDescription("Check level")
.addUserOption(o => o.setName("user").setDescription("User")),

new SlashCommandBuilder()
.setName("leaderboard")
.setDescription("Show leaderboard")
.addStringOption(o =>
o.setName("type")
.setDescription("Type")
.setRequired(true)
.addChoices(
{name:"XP", value:"xp"},
{name:"Cash", value:"cash"}
)),

/* ECONOMY */

new SlashCommandBuilder().setName("cash").setDescription("Check cash"),

new SlashCommandBuilder().setName("daily").setDescription("Daily reward"),

new SlashCommandBuilder()
.setName("give")
.setDescription("Give money")
.addUserOption(o => o.setName("user").setRequired(true))
.addIntegerOption(o => o.setName("amount").setRequired(true)),

new SlashCommandBuilder()
.setName("gamble")
.setDescription("Gamble money")
.addIntegerOption(o => o.setName("amount").setRequired(true)),

new SlashCommandBuilder().setName("work").setDescription("Work for money"),

new SlashCommandBuilder().setName("inventory").setDescription("Check items"),

/* MODERATION */

new SlashCommandBuilder()
.setName("kick")
.setDescription("Kick user")
.addUserOption(o => o.setName("user").setRequired(true)),

new SlashCommandBuilder()
.setName("ban")
.setDescription("Ban user")
.addUserOption(o => o.setName("user").setRequired(true)),

new SlashCommandBuilder()
.setName("warn")
.setDescription("Warn user")
.addUserOption(o => o.setName("user").setRequired(true))
.addStringOption(o => o.setName("reason").setRequired(true)),

/* ADMIN */

new SlashCommandBuilder()
.setName("setwelcome")
.setDescription("Set welcome channel")
.addChannelOption(o => o.setName("channel").setRequired(true)),

new SlashCommandBuilder()
.setName("setautorole")
.setDescription("Set autorole")
.addRoleOption(o => o.setName("role").setRequired(true)),

].map(c => c.toJSON());

/* ---------------- REGISTER ---------------- */

const rest = new REST({ version: "10" }).setToken(TOKEN);

(async () => {
  try {
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
    console.log("Commands registered");
  } catch (err) {
    console.error(err);
  }
})();

/* ---------------- READY ---------------- */

client.once("ready", () => {
  console.log(`Logged in as ${client.user.tag}`);
});

/* ---------------- WELCOME ---------------- */

client.on("guildMemberAdd", member => {

const role = config.autorole;

if(role){
const r = member.guild.roles.cache.get(role);
if(r) member.roles.add(r);
}

const channelId = config.welcome;

if(channelId){

const ch = member.guild.channels.cache.get(channelId);

if(ch){

const embed = new EmbedBuilder()
.setColor("Green")
.setTitle("Welcome!")
.setDescription(`Welcome ${member} to **${member.guild.name}**`)
.setFooter({text:`Member #${member.guild.memberCount}`})
.setTimestamp();

ch.send({embeds:[embed]});

}

}

});

/* ---------------- MESSAGE SYSTEM ---------------- */

const xpCooldown = new Set();

client.on("messageCreate", message => {

if(message.author.bot) return;

if(!levels[message.author.id])
levels[message.author.id] = {xp:0, level:1};

if(xpCooldown.has(message.author.id)) return;

const data = levels[message.author.id];

data.xp += Math.floor(Math.random()*10)+5;

const needed = data.level * 100;

if(data.xp >= needed){

data.level++;

data.xp = 0;

message.channel.send(`🎉 ${message.author} reached level ${data.level}`);

}

xpCooldown.add(message.author.id);

setTimeout(()=>xpCooldown.delete(message.author.id), 60000);

saveAll();

});

/* ---------------- INTERACTION ---------------- */

client.on("interactionCreate", async interaction => {

if(!interaction.isChatInputCommand()) return;

const {commandName} = interaction;

/* PING */

if(commandName==="ping")
return interaction.reply(`Pong ${client.ws.ping}ms`);

/* HELP */

if(commandName==="help"){

const embed = new EmbedBuilder()

.setTitle("Commands")

.setDescription(`
/ping
/help
/afk
/level
/leaderboard

Economy
/cash
/daily
/work
/gamble

Moderation
/kick
/ban
/warn
`);

return interaction.reply({embeds:[embed]});

}

/* CASH */

if(commandName==="cash"){

ensureUser(interaction.user.id);

return interaction.reply(`💰 $${economy[interaction.user.id].cash}`);

}

/* DAILY */

if(commandName==="daily"){

ensureUser(interaction.user.id);

const now = Date.now();

if(now - economy[interaction.user.id].lastDaily < 86400000)

return interaction.reply("Come back tomorrow");

economy[interaction.user.id].lastDaily = now;

economy[interaction.user.id].cash += 200;

saveAll();

return interaction.reply("You got $200");

}

/* WORK */

if(commandName==="work"){

ensureUser(interaction.user.id);

const earn = Math.floor(Math.random()*200)+50;

economy[interaction.user.id].cash += earn;

saveAll();

return interaction.reply(`You earned $${earn}`);

}

});

/* ---------------- LOGIN ---------------- */

client.login(TOKEN);
```
