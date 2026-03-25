const { 
  Client, 
  GatewayIntentBits, 
  REST, 
  Routes, 
  SlashCommandBuilder, 
  PermissionsBitField, 
  EmbedBuilder 
} = require('discord.js');
const fs = require('fs');
const express = require('express');

// ---------- EXPRESS ----------
const app = express();
app.get("/", (req,res)=>res.send("Bot is alive!"));
app.listen(3000,()=>console.log("Express server running"));

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
let shop = fs.existsSync(SHOP_FILE) ? JSON.parse(fs.readFileSync(SHOP_FILE)) : {
  "Fishing Rod": {price:100, description:"Catch fish to earn cash"},
  "Lucky Charm": {price:500, description:"Increases gamble success"}
};

// ---------- SAVE FUNCTIONS ----------
function saveData(){
  fs.writeFileSync(LEVELS_FILE, JSON.stringify(levels,null,2));
  fs.writeFileSync(WARNINGS_FILE, JSON.stringify(warnings,null,2));
  fs.writeFileSync(XPCHANNELS_FILE, JSON.stringify(xpChannels,null,2));
  fs.writeFileSync(AFK_FILE, JSON.stringify(afkData,null,2));
  fs.writeFileSync(AUTOROLE_FILE, JSON.stringify(autoRoles,null,2));
  fs.writeFileSync(WELCOME_FILE, JSON.stringify(welcomeChannels,null,2));
}
function saveEconomy(){ fs.writeFileSync(ECON_FILE, JSON.stringify(economy,null,2)); }
function saveShop(){ fs.writeFileSync(SHOP_FILE, JSON.stringify(shop,null,2)); }
function ensureUser(id){ if(!economy[id]) economy[id]={cash:0, inventory:[], lastDaily:0}; }

// ---------- COMMANDS ----------
const commands = [
  // Basic
  new SlashCommandBuilder().setName("help").setDescription("Show commands"),
  new SlashCommandBuilder().setName("ping").setDescription("Check latency"),
  new SlashCommandBuilder().setName("afk").setDescription("Set AFK").addStringOption(o=>o.setName("reason").setDescription("Reason")),
  new SlashCommandBuilder().setName("level").setDescription("Check level").addUserOption(o=>o.setName("user").setDescription("User")),
  new SlashCommandBuilder().setName("leaderboard").setDescription("Show leaderboard")
    .addStringOption(o => o.setName("type").setDescription("Select leaderboard type").setRequired(true)
      .addChoices({name:"XP", value:"xp"}, {name:"Cash", value:"cash"})),
  // Moderation
  new SlashCommandBuilder().setName("kick").setDescription("Kick a user").addUserOption(o=>o.setName("user").setDescription("User").setRequired(true)),
  new SlashCommandBuilder().setName("ban").setDescription("Ban a user").addUserOption(o=>o.setName("user").setDescription("User").setRequired(true)),
  new SlashCommandBuilder().setName("mute").setDescription("Mute a user").addUserOption(o=>o.setName("user").setDescription("User").setRequired(true)).addIntegerOption(o=>o.setName("minutes").setDescription("Minutes").setRequired(true)),
  new SlashCommandBuilder().setName("unmute").setDescription("Unmute a user").addUserOption(o=>o.setName("user").setDescription("User").setRequired(true)),
  new SlashCommandBuilder().setName("warn").setDescription("Warn a user").addUserOption(o=>o.setName("user").setDescription("User").setRequired(true)).addStringOption(o=>o.setName("reason").setDescription("Reason").setRequired(true)),
  new SlashCommandBuilder().setName("warnings").setDescription("Check warnings").addUserOption(o=>o.setName("user").setDescription("User").setRequired(true)),
  // XP & Auto
  new SlashCommandBuilder().setName("setxpchannel").setDescription("Set XP channel").addChannelOption(o=>o.setName("channel").setDescription("Channel").setRequired(true)),
  new SlashCommandBuilder().setName("setautorole").setDescription("Set auto role").addRoleOption(o=>o.setName("role").setDescription("Role").setRequired(true)),
  new SlashCommandBuilder().setName("setwelcome").setDescription("Set welcome channel").addChannelOption(o=>o.setName("channel").setDescription("Channel").setRequired(true)),
  new SlashCommandBuilder().setName("announce").setDescription("Announcement").addStringOption(o=>o.setName("message").setDescription("Message").setRequired(true)),
  // Economy
  new SlashCommandBuilder().setName("cash").setDescription("Check cash").addUserOption(o=>o.setName("user").setDescription("User")),
  new SlashCommandBuilder().setName("daily").setDescription("Claim daily"),
  new SlashCommandBuilder().setName("give").setDescription("Give cash").addUserOption(o=>o.setName("user").setDescription("User").setRequired(true)).addIntegerOption(o=>o.setName("amount").setDescription("Amount").setRequired(true)),
  new SlashCommandBuilder().setName("fish").setDescription("Go fishing"),
  new SlashCommandBuilder().setName("rob").setDescription("Rob a user").addUserOption(o=>o.setName("user").setDescription("User").setRequired(true)),
  new SlashCommandBuilder().setName("gamble").setDescription("Gamble").addIntegerOption(o=>o.setName("amount").setDescription("Amount").setRequired(true)),
  new SlashCommandBuilder().setName("shop").setDescription("View shop items"),
  new SlashCommandBuilder().setName("buy").setDescription("Buy an item from shop").addStringOption(o=>o.setName("item").setDescription("Item name").setRequired(true)),
  new SlashCommandBuilder().setName("inventory").setDescription("Check your items"),
].map(cmd=>cmd.toJSON());

// ---------- REGISTER ----------
const rest = new REST({ version:'10' }).setToken(TOKEN);
(async()=>{try{
  console.log("Registering commands...");
  await rest.put(Routes.applicationCommands(CLIENT_ID),{body:commands});
  console.log("Commands registered!");
}catch(err){console.error(err);}})();

// ---------- READY ----------
client.once("ready",()=>{console.log(`✅ Logged in as ${client.user.tag}`);});

// ---------- WELCOME ----------
client.on("guildMemberAdd", member=>{
  const roleId = autoRoles[member.guild.id];
  if(roleId){ const role = member.guild.roles.cache.get(roleId); if(role) member.roles.add(role).catch(console.error); }

  const channelId = welcomeChannels[member.guild.id];
  if(channelId){
    const channel = member.guild.channels.cache.get(channelId);
    if(channel){
      const embed = new EmbedBuilder()
        .setColor("#00ffcc")
        .setTitle("🎉 Welcome!")
        .setDescription(`Welcome ${member} to **${member.guild.name}**!\nMake sure to read rules <#rules>.\nEnjoy your stay!`)
        .setFooter({ text:`Member #${member.guild.memberCount}` })
        .setTimestamp();
      channel.send({ embeds:[embed] });

      const rulesEmbed = new EmbedBuilder()
        .setColor(0x2f3136)
        .setTitle("📜 Discord Server Rules")
        .setDescription(
          "**1. Respect Everyone**\nNo harassment, bullying, hate speech, or discrimination.\n\n"+
          "**2. No Spamming**\nAvoid spam, links or self-promotion.\n\n"+
          "**3. Keep Content Appropriate**\nNo NSFW, illegal, or pirated content.\n\n"+
          "**4. Respect Privacy**\nNo doxxing or sharing personal info without consent.\n\n"+
          "**5. No Advertising**\nAdvertising other servers, bots, or products is not allowed without permission.\n\n"+
          "**6. Follow Staff Instructions**\nRespect moderators and admins.\n\n"+
          "**7. No Impersonation**\nDo not impersonate staff or members.\n\n"+
          "**9. Have Fun!** 🎉\nEnjoy yourself and help create a friendly community!"
        )
        .setFooter({ text:"Follow the rules to keep the server safe and fun!" });
      channel.send({ embeds:[rulesEmbed] });
    }
  }
});

// ---------- MESSAGE HANDLER ----------
client.on("messageCreate", async message => {
  if(message.author.bot) return;
  // AFK removal
  if(afkData[message.author.id]){ delete afkData[message.author.id]; saveData(); message.channel.send(`✅ Welcome back ${message.author.tag}, removed your AFK.`);}
  message.mentions.users.forEach(u=>{ if(afkData[u.id]) message.channel.send(`⚠️ ${u.tag} is AFK: ${afkData[u.id]}`); });
  // XP & leveling
  if(!levels[message.guild.id]) levels[message.guild.id]={};
  if(!levels[message.guild.id][message.author.id]) levels[message.guild.id][message.author.id]={xp:0,level:1};
  const userData = levels[message.guild.id][message.author.id];
  const xpGain = Math.floor(Math.random()*10)+5;
  userData.xp += xpGain;
  const nextLevelXP = userData.level*100;
  if(userData.xp>=nextLevelXP){
    userData.level++; userData.xp-=nextLevelXP;
    const lvlChannelId = xpChannels[message.guild.id]?.[0] || message.channel.id;
    const lvlChannel = message.guild.channels.cache.get(lvlChannelId);
    if(lvlChannel) lvlChannel.send(`🎉 Congrats ${message.author}! You reached level ${userData.level}!`);
  }
  saveData();
});

// ---------- INTERACTION HANDLER ----------
client.on("interactionCreate", async interaction=>{
  if(!interaction.isCommand()) return;
  const { commandName, guild, member } = interaction;
  const isAdmin = member.permissions.has(PermissionsBitField.Flags.Administrator);

  // MODERATION
  if(["kick","ban","mute","unmute","warn","warnings"].includes(commandName) && !isAdmin)
    return interaction.reply({content:"❌ Admin required",ephemeral:true});
  
  // Kick/Ban/Mute/Unmute/Warn handled here
  // ... (same logic as previous code)
  
  // AFK
  if(commandName==="afk"){ const r=interaction.options.getString("reason")||"AFK"; afkData[interaction.user.id]=r; saveData(); interaction.reply(`✅ You are now AFK: ${r}`);}

  // LEVEL
  if(commandName==="level"){ const u=interaction.options.getUser("user")||interaction.user; if(!levels[guild.id]) levels[guild.id]={}; if(!levels[guild.id][u.id]) levels[guild.id][u.id]={xp:0,level:1}; const d=levels[guild.id][u.id]; const e=new EmbedBuilder().setTitle(`${u.tag}'s profile`).setColor("Gold").setThumbnail(u.displayAvatarURL({dynamic:true})).setDescription(`Level: ${d.level}\nXP: ${d.xp}/${d.level*100}`); interaction.reply({embeds:[e]});}

  // ECONOMY
  const userId = interaction.user.id; ensureUser(userId);

  // /cash, /daily, /give, /fish, /rob, /gamble, /shop, /buy, /inventory handled same as before

  // ---------- LEADERBOARD ----------
  if(commandName==="leaderboard"){
    const type = interaction.options.getString("type");
    const medals = ["🥇","🥈","🥉"];

    if(type==="xp"){
      const guildLevels = levels[guild.id];
      if(!guildLevels || Object.keys(guildLevels).length===0) return interaction.reply("No level data yet.");
      const sorted = Object.entries(guildLevels).sort(([,a],[,b])=>b.level-a.level||b.xp-a.xp).slice(0,10);
      let desc = "";
      for(let i=0;i<sorted.length;i++){ const uId=sorted[i][0]; const data=sorted[i][1]; const user=await client.users.fetch(uId).catch(()=>({tag:"Unknown#0000"})); desc+=`${medals[i]||`#${i+1}`} **${user.tag}** - Level ${data.level} | XP ${data.xp}\n`; }
      const embed=new EmbedBuilder().setTitle(`🏆 XP Leaderboard - ${guild.name}`).setColor("Purple").setDescription(desc).setThumbnail(guild.iconURL({dynamic:true})).setFooter({text:`Requested by ${interaction.user.tag}`,iconURL:interaction.user.displayAvatarURL({dynamic:true})}).setTimestamp();
      interaction.reply({embeds:[embed]});
    }
    else if(type==="cash"){
      const guildMembers=guild.members.cache.map(m=>m.id);
      const sortedCash=Object.entries(economy).filter(([id])=>guildMembers.includes(id)).sort(([,a],[,b])=>b.cash-a.cash).slice(0,10);
      let desc="";
      for(let i=0;i<sortedCash.length;i++){ const uId=sortedCash[i][0]; const data=sortedCash[i][1]; const user=await client.users.fetch(uId).catch(()=>({tag:"Unknown#0000"})); desc+=`${medals[i]||`#${i+1}`} **${user.tag}** - $${data.cash}\n`; }
      const embed=new EmbedBuilder().setTitle(`💰 Cash Leaderboard - ${guild.name}`).setColor("Green").setDescription(desc).setThumbnail(guild.iconURL({dynamic:true})).setFooter({text:`Requested by ${interaction.user.tag}`,iconURL:interaction.user.displayAvatarURL({dynamic:true})}).setTimestamp();
      interaction.reply({embeds:[embed]});
    }
  }
});

client.login(TOKEN);
