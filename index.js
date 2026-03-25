```js
const {
Client,
GatewayIntentBits,
EmbedBuilder,
SlashCommandBuilder,
PermissionsBitField,
REST,
Routes,
ChannelType
} = require("discord.js");

const fs = require("fs");
const express = require("express");

/* ---------------- EXPRESS SERVER ---------------- */

const app = express();
app.get("/", (req,res)=>res.send("Bot is running"));
app.listen(3000,()=>console.log("Web server started"));

/* ---------------- CLIENT ---------------- */

const client = new Client({
intents:[
GatewayIntentBits.Guilds,
GatewayIntentBits.GuildMembers,
GatewayIntentBits.GuildMessages,
GatewayIntentBits.MessageContent
]
});

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

/* ---------------- FILE DATABASE ---------------- */

const LEVEL_FILE="./levels.json";
const ECON_FILE="./economy.json";
const WARN_FILE="./warnings.json";
const CONFIG_FILE="./config.json";

let levels = fs.existsSync(LEVEL_FILE)?JSON.parse(fs.readFileSync(LEVEL_FILE)):{};
let economy = fs.existsSync(ECON_FILE)?JSON.parse(fs.readFileSync(ECON_FILE)):{};
let warnings = fs.existsSync(WARN_FILE)?JSON.parse(fs.readFileSync(WARN_FILE)):{};
let config = fs.existsSync(CONFIG_FILE)?JSON.parse(fs.readFileSync(CONFIG_FILE)):{};

function save(){
fs.writeFileSync(LEVEL_FILE,JSON.stringify(levels,null,2));
fs.writeFileSync(ECON_FILE,JSON.stringify(economy,null,2));
fs.writeFileSync(WARN_FILE,JSON.stringify(warnings,null,2));
fs.writeFileSync(CONFIG_FILE,JSON.stringify(config,null,2));
}

function ensureUser(id){
if(!economy[id]) economy[id]={cash:0,lastDaily:0};
}

/* ---------------- COMMANDS ---------------- */

const commands=[

new SlashCommandBuilder().setName("ping").setDescription("Bot ping"),

new SlashCommandBuilder().setName("cash").setDescription("Check your money"),

new SlashCommandBuilder().setName("daily").setDescription("Daily reward"),

new SlashCommandBuilder().setName("work").setDescription("Work for money"),

new SlashCommandBuilder()
.setName("gamble")
.setDescription("Gamble money")
.addIntegerOption(o=>o.setName("amount").setRequired(true)),

new SlashCommandBuilder()
.setName("give")
.setDescription("Give money")
.addUserOption(o=>o.setName("user").setRequired(true))
.addIntegerOption(o=>o.setName("amount").setRequired(true)),

new SlashCommandBuilder()
.setName("kick")
.setDescription("Kick user")
.addUserOption(o=>o.setName("user").setRequired(true)),

new SlashCommandBuilder()
.setName("ban")
.setDescription("Ban user")
.addUserOption(o=>o.setName("user").setRequired(true)),

new SlashCommandBuilder()
.setName("warn")
.setDescription("Warn user")
.addUserOption(o=>o.setName("user").setRequired(true))
.addStringOption(o=>o.setName("reason").setRequired(true)),

new SlashCommandBuilder()
.setName("warnings")
.setDescription("Check warnings")
.addUserOption(o=>o.setName("user").setRequired(true)),

new SlashCommandBuilder()
.setName("ticket")
.setDescription("Create support ticket"),

new SlashCommandBuilder()
.setName("close")
.setDescription("Close ticket"),

new SlashCommandBuilder()
.setName("userinfo")
.setDescription("User info")
.addUserOption(o=>o.setName("user")),

new SlashCommandBuilder()
.setName("serverinfo")
.setDescription("Server info"),

new SlashCommandBuilder()
.setName("setwelcome")
.setDescription("Set welcome channel")
.addChannelOption(o=>o.setName("channel").setRequired(true)),

new SlashCommandBuilder()
.setName("setautorole")
.setDescription("Set autorole")
.addRoleOption(o=>o.setName("role").setRequired(true))

].map(c=>c.toJSON());

/* ---------------- REGISTER COMMANDS ---------------- */

const rest = new REST({version:"10"}).setToken(TOKEN);

(async()=>{
try{
await rest.put(Routes.applicationCommands(CLIENT_ID),{body:commands});
console.log("Commands registered");
}catch(err){console.log(err);}
})();

/* ---------------- READY ---------------- */

client.once("ready",()=>{
console.log("Bot online");
console.log("Logged in as "+client.user.tag);
});

/* ---------------- WELCOME SYSTEM ---------------- */

client.on("guildMemberAdd",member=>{

if(config.autorole){
const role = member.guild.roles.cache.get(config.autorole);
if(role) member.roles.add(role);
}

const channel = member.guild.channels.cache.get(config.welcome);
if(!channel) return;

const welcome = new EmbedBuilder()
.setColor("#00ffcc")
.setTitle("🎉 Welcome!")
.setDescription(`Welcome ${member} to **${member.guild.name}**
Make sure to read rules #rules
Enjoy your stay!`)
.setFooter({text:`Member #${member.guild.memberCount}`});

const rules = new EmbedBuilder()
.setColor("#2f3136")
.setTitle("📜 Discord Server Rules")
.setDescription(`
1. Respect Everyone
2. No Spamming
3. Keep Content Appropriate
4. Respect Privacy
5. No Advertising
6. Follow Staff Instructions
7. No Impersonation
9. Have Fun 🎉
`);

channel.send({embeds:[welcome]});
channel.send({embeds:[rules]});

});

/* ---------------- MESSAGE COMMANDS ---------------- */

const xpCooldown=new Set();

client.on("messageCreate",async message=>{

if(message.author.bot) return;

/* RULES */

if(message.content.toLowerCase()==="?rules"){

const embed=new EmbedBuilder()
.setTitle("📜 Rules")
.setDescription("Respect everyone\nNo spam\nNo NSFW\nFollow staff");

message.channel.send({embeds:[embed]});

}

/* CLEAR */

if(message.content.startsWith("?clear")){

if(!message.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) return;

const amount=message.content.split(" ")[1];

message.channel.bulkDelete(amount);

}

/* LEVEL SYSTEM */

if(!levels[message.author.id]) levels[message.author.id]={xp:0,level:1};

if(xpCooldown.has(message.author.id)) return;

levels[message.author.id].xp+=5;

if(levels[message.author.id].xp>=levels[message.author.id].level*100){

levels[message.author.id].level++;
levels[message.author.id].xp=0;

message.channel.send(`${message.author} reached level ${levels[message.author.id].level}`);

}

xpCooldown.add(message.author.id);
setTimeout(()=>xpCooldown.delete(message.author.id),60000);

save();

});

/* ---------------- INTERACTIONS ---------------- */

client.on("interactionCreate",async interaction=>{

if(!interaction.isChatInputCommand()) return;

const cmd=interaction.commandName;

/* PING */

if(cmd==="ping") return interaction.reply("🏓 "+client.ws.ping+"ms");

/* CASH */

if(cmd==="cash"){

ensureUser(interaction.user.id);

return interaction.reply("💰 $"+economy[interaction.user.id].cash);

}

/* DAILY */

if(cmd==="daily"){

ensureUser(interaction.user.id);

const now=Date.now();

if(now-economy[interaction.user.id].lastDaily<86400000)
return interaction.reply("Come back tomorrow");

economy[interaction.user.id].lastDaily=now;
economy[interaction.user.id].cash+=200;

save();

return interaction.reply("You got $200");

}

/* WORK */

if(cmd==="work"){

ensureUser(interaction.user.id);

const money=Math.floor(Math.random()*200)+50;

economy[interaction.user.id].cash+=money;

save();

return interaction.reply("You earned $"+money);

}

/* GAMBLE */

if(cmd==="gamble"){

const bet=interaction.options.getInteger("amount");

ensureUser(interaction.user.id);

if(economy[interaction.user.id].cash<bet)
return interaction.reply("Not enough money");

if(Math.random()>0.5){

economy[interaction.user.id].cash+=bet;

interaction.reply("You won $"+bet);

}else{

economy[interaction.user.id].cash-=bet;

interaction.reply("You lost $"+bet);

}

save();

}

/* TICKET */

if(cmd==="ticket"){

const channel=await interaction.guild.channels.create({
name:"ticket-"+interaction.user.username,
type:ChannelType.GuildText
});

channel.send("Support will be with you soon "+interaction.user);

interaction.reply({content:"Ticket created "+channel,ephemeral:true});

}

/* CLOSE */

if(cmd==="close"){

interaction.channel.delete();

}

});

/* ---------------- LOGIN ---------------- */

client.login(TOKEN);
```
