
var activeCooldowns = {};
var globalCooldowns = {};
var globalXPJson = `${__basedir}/data/bot/globalxp.json`;
module.exports = {
  /*
  ** isEnabled()
  ** Description: see if xp module is enabled in a server
  */
  isEnabled(id) {
    if (util.modules.isEnabled("xp", id)) return true; else return false;
  },
  /*
  ** addXP(user, guild, amount) / getXP (user, guild)
  ** Description: get xp from/add xp to user in server
  */
  addXP(user, guild, amount, skipCooldown) {
    var path = util.json.getServerJSON(guild);
    var data = util.json.JSONFromFile(path);
    if (skipCooldown == undefined && amount) skipCooldown = true; // default skipCooldown to true if the amount is specified
    if (this.hasXPCooldown(user) && !skipCooldown) return; // stop user from gaining xp if an xp cooldown is active unless it has been specified that the cooldown should be skipped
    if (!amount && !(amount < 0)) amount = this.getExpGained(this.getLevel(user, guild));
    // Store xp
    if (data.xp == undefined) data.xp = {}; // if the server hasn't used xp before, add the object so js doesn't scream undefined
    if (data.xp[user] == undefined) data.xp[user] = 0; //set xp to 0 if it doesn't exist
    data.xp[user] += amount; // add xp
    // Activity
    var date = new Date(Date.now());
    var day = Math.floor((date.getTime())/86400000); // Get number of days since epoch (timezone stuff cus it was off by that many hours)
    if (data.xp.history == undefined) data.xp.history = {};
    if (data.xp.history[day] == undefined) data.xp.history[day] = {}; // same as above except with individual days
    if (data.xp.history[day][user] == undefined) data.xp.history[day][user] = {};
    data.xp.history[day][user].amount = this.getXP(user, guild); // add xp to current day (for activity command)
    data.xp.history[day][user].rank = `${this.getLeaderboardRank(guild, user)}/${this.getTotalRank(guild, client.users.cache.get(user).bot)}`;
    util.json.writeJSONToFile(data, path); // Write to file

    this.addXPCooldown(user); // Add XP cooldown so that the user can't spam and earn XP
    if (util.modules.isEnabled("xpleaderboard", guild)) this.updateLeaderboard(guild); // Update the leaderboard if the module is enabled
    if (util.modules.isEnabled("xp-roles", guild)) this.updateRoles(user, guild); // Update the user's roles if the module is enabled
  },
  getXP(user, guild, string) {
    var path = util.json.getServerJSON(guild);
    var data = util.json.JSONFromFile(path);
    if (data.xp == undefined) data.xp = {};
    if (data.xp[user] == undefined) data.xp[user] = 0; // same as above function
    if (string) return util.general.numberWithCommas(data.xp[user]);
    return data.xp[user];
  },
  /*
  ** getLevel(user, guild)
  ** Description: get level of user in server
  */
  getLevel(user, guild) {
    var path = util.json.getServerJSON(guild);
    var data = util.json.JSONFromFile(path);
    if (data.xp == undefined) data.xp = {};
    if (data.xp[user] == undefined) data.xp[user] = 0; // same as above function
    var level = 1;
    for (var i = 1; i <= 500; i++) {
      //13.88888889 x3 + 195.2380952 x2 + 195.6349206 x
      var currentxp = Math.round(13.88888889*Math.pow(i, 3)+195.2380952*Math.pow(i, 2)+195.6349206*i);
      if (data.xp[user] > currentxp) {
        level++;
      }
    }
    return level;
  },
  /*
  ** getLevelXP(xp)
  ** Description: get level of xp
  */
  getLevelXP(xp) {
    var level = 1;
    for (var i = 1; i <= 500; i++) {
      //13.88888889 x3 + 195.2380952 x2 + 195.6349206 x
      var currentxp = Math.round(13.88888889*Math.pow(i, 3)+195.2380952*Math.pow(i, 2)+195.6349206*i);
      if (xp > currentxp) {
        level++;
      }
    }
    return level;
  },
  /*
  ** getMinXP(level)
  ** Description: get minimum xp for required for level
  */
  getMinXP(level) {
    level = level - 1;
    return Math.round(13.88888889*Math.pow(level, 3)+195.2380952*Math.pow(level, 2)+195.6349206*level);
  },
  /*
  ** getExpGained(level)
  ** Description: get default xp gained for level
  */
  getExpGained(level) {
    return 45 + (5 * level) + util.general.generateRandomNumber(0, level);
  },
  /*
  ** addXPCooldown(user) / hasXPCoooldown(user)
  ** Description: add/see if user has an xp cooldown
  ** Comment: so users dont spam
  */
  addXPCooldown(user) {
    activeCooldowns[user] = 20;
  },
  hasXPCooldown(user) {
    if (activeCooldowns[user] == undefined) return false; else return true;
  },
  /*
  ** startXPCooldowns()
  ** Description: start the xp timers
  ** Comment: called in bot function
  */
  startXPCooldowns() {
    setInterval(function() {
      for (var user in activeCooldowns) {
        activeCooldowns[user] = activeCooldowns[user] - 1;
        if (activeCooldowns[user] == 0) {
          delete activeCooldowns[user];
        }
      }
      for (var user in globalCooldowns) {
        globalCooldowns[user] = globalCooldowns[user] - 1;
        if (globalCooldowns[user] == 0) {
          delete globalCooldowns[user];
        }
      }
    }, 1000);
  },
  /*
  ** getLeaderboard(id, page)
  ** Description: get a leaderboard string
  */
  getLeaderboard(id, page, bot) {
    page = page || 1;
    var pageSize = 10,
        output   = "",
        path     = util.json.getServerJSON(id),
        data     = util.json.JSONFromFile(path),
        embed    = new Discord.MessageEmbed();
    if (data.xp == undefined) return "There is no xp data for this server.";
    // Sort by putting in array and using the sort() function
    var array = [];
    for (var xp in data.xp) {
      if (isNaN(parseInt(xp))) continue; // skip if they're not a user
      array.push({ id: xp, xp: data.xp[xp] });
    }
    array.sort(function(a, b) { // sort
      return b.xp - a.xp;
    });
    // get day for showing today's xp gained in leaderboardChannelID
    var date = new Date(Date.now());
    var day = Math.floor((date.getTime())/86400000); // Get number of days since epoch (timezone stuff cus it was off by that many hours)
    if (data.xp.history == undefined) data.xp.history = {};
    if (data.xp.history[day] == undefined) data.xp.history[day] = {};
    embed.setColor("#ff8080");
    embed.setAuthor(`${client.guilds.cache.get(id).name}`, `${client.guilds.cache.get(id).iconURL()}`);
    embed.setTitle("Leaderboard");
    var i = 0;
    for (var object in array) {
      if (isNaN(parseInt(array[object].id))) continue; // Handle non-users in xp object
      if (client.guilds.cache.get(id).members.cache.get(array[object].id) !== undefined && client.guilds.cache.get(id).members.cache.get(array[object].id).user.bot && !bot) continue; // Skip user if they are a bot unless bot argument is true
      i++;
      if (i < (page-1)*pageSize+(page-1)) continue; // Page system
      if (i > page*pageSize) break;
      var member = client.guilds.cache.get(id).members.cache.get(array[object].id);
      if (member == undefined) member = { user: { username: "Unknown", id: array[object].id} }; // Replace username with "Unknown" since we don't know what their real username is
      var xptoday = this.getXPGained(id, member.id, Math.floor((new Date(Date.now()).getTime())/86400000)); // days since epoch
      var string = `${i}. <@${member.user.id}> - ${this.getXP(array[object].id, id, true)} xp${xptoday !== undefined ? " (" : ""}${xptoday >= 0 ? "+" : ""}${xptoday < 0 ? "-" : ""}${xptoday !== undefined ? `${util.general.numberWithCommas(xptoday)} gained today` : ""}${xptoday !== undefined ? ")" : ""}, Level ${this.getLevel(array[object].id, id)}${util.modules.isEnabled("xp-roles", id) ? ` <@&${this.getHighestRole(id, this.getLevel(array[object].id, id))}>` : ""}\n`;
      if (i == 1) {
        output += `**${string}**`;
        embed.setThumbnail(`${member.user.displayAvatarURL() ? member.user.displayAvatarURL() : ""}`);
      } else output += string;
    }
    embed.setDescription(output);
    embed.setFooter(`Page ${page}`);
    embed.setTimestamp();
    return embed;
  },
  /*
  ** getLeaderboardRank(guildID, userID)
  ** Description: return rank of user
  */
  getLeaderboardRank(guildID, userID) {
    var path     = util.json.getServerJSON(guildID),
        data     = util.json.JSONFromFile(path);
    // Sort by putting in array and using the sort() function
    var array = [];
    for (var xp in data.xp) {
      if (isNaN(parseInt(xp))) continue;
      array.push({ id: xp, xp: data.xp[xp] });
    }
    array.sort(function(a, b) {
      return b.xp - a.xp;
    });
    var i = 0;
    for (var object in array) {
      if (isNaN(parseInt(array[object].id))) continue; // Handle non-users in xp object
      if (client.guilds.cache.get(guildID).members.cache.get(array[object].id) !== undefined && client.guilds.cache.get(guildID).members.cache.get(array[object].id).user.bot && array[object].id !== userID) continue; // Skip user if they are a bot
      i++;
      if (array[object].id !== userID) continue;
      return i;
    }
    return "Unknown Rank";
  },
  getTotalRank(guildID, bot) {
    var path     = util.json.getServerJSON(guildID),
        data     = util.json.JSONFromFile(path);
    // Sort by putting in array and using the sort() function
    var array = [];
    for (var xp in data.xp) {
      if (isNaN(parseInt(xp))) continue;
      array.push({ id: xp, xp: data.xp[xp] });
    }
    array.sort(function(a, b) {
      return b.xp - a.xp;
    });
    var i = 0;
    for (var object in array) {
      if (isNaN(parseInt(array[object].id))) continue; // Handle non-users in xp object
      if (client.guilds.cache.get(guildID).members.cache.get(array[object].id) !== undefined && client.guilds.cache.get(guildID).members.cache.get(array[object].id).user.bot && !bot) continue; // Skip user if they are a bot
      i++;
    }
    return i;
  },

  getXPatRank(guildID, rank) {
    var path     = util.json.getServerJSON(guildID),
        data     = util.json.JSONFromFile(path);
    // Sort by putting in array and using the sort() function
    var array = [];
    for (var xp in data.xp) {
      if (isNaN(parseInt(xp))) continue;
      array.push({ id: xp, xp: data.xp[xp] });
    }
    for (var object in array) {
      if (isNaN(parseInt(array[object].id))) {delete array[object]; continue;}
      if (array[object].id == "672280373065154569") {delete array[object]; continue;}
      if (client.guilds.cache.get(guildID).members.cache.get(array[object].id) !== undefined && client.guilds.cache.get(guildID).members.cache.get(array[object].id).user.bot) {delete array[object]; continue;}
    }
    array.sort(function(a, b) {
      return b.xp - a.xp;
    });

    if (!array[rank-1]) return 0;
    return array[rank-1].xp || 0;
  },
  getUserAtRank(guildID, rank) {
    var path     = util.json.getServerJSON(guildID),
        data     = util.json.JSONFromFile(path);
    // Sort by putting in array and using the sort() function
    var array = [];
    for (var xp in data.xp) {
      if (isNaN(parseInt(xp))) continue;
      array.push({ id: xp, xp: data.xp[xp] });
    }
    for (var object in array) {
      if (isNaN(parseInt(array[object].id))) {delete array[object]; continue;}
      if (array[object].id == "672280373065154569") {delete array[object]; continue;}
      if (client.guilds.cache.get(guildID).members.cache.get(array[object].id) !== undefined && client.guilds.cache.get(guildID).members.cache.get(array[object].id).user.bot) {delete array[object]; continue;}
    }
    array.sort(function(a, b) {
      return b.xp - a.xp;
    });

    if (!array[rank-1]) return client.user.id;
    return array[rank-1].id;
  },
  /*
  ** setLeaderboardMessage(guildID, channelid, messageid)
  ** Description: set the message id to edit the leaderboard into
  */
  setLeaderboardMessage(guildID, channelID, messageID) {
    var path = util.json.getServerJSON(guildID);
    var data = util.json.JSONFromFile(path);
    data.xp.leaderboardMessageID = messageID;
    data.xp.leaderboardChannelID = channelID;
    util.json.writeJSONToFile(data, path);
  },
  /*
  ** updateLeaderboard(guildID)
  ** Description: update the leaderboard in the given server
  */
  updateLeaderboard(guildID) {
    var path = util.json.getServerJSON(guildID),
        data = util.json.JSONFromFile(path),
        channelID = data.xp.leaderboardChannelID,
        messageID = data.xp.leaderboardMessageID;
    if (channelID == undefined || messageID == undefined) return;
    client.guilds.cache.get(guildID).channels.cache.get(channelID).messages.fetch(messageID)
      .then(msg => msg.edit(this.getLeaderboard(guildID)))
      .catch(`Error updating leaderboard in ${guildID}`);
  },
  /*
  ** setRole(guildID, roleID, levelThreshold)
  ** Description: set a role to be obtained at a certain level
  */
  setRole(guildID, roleID, levelThreshold) {
    var path = util.json.getServerJSON(guildID),
        data = util.json.JSONFromFile(path);
    if (data.xp.roles == undefined) data.xp.roles = {}; // Add roles object if it doesn't already exist
    data.xp.roles[roleID] = levelThreshold; // set the role id property of roles object to the level so that we know what level to check for in updateRoles
    util.json.writeJSONToFile(data, path);
  },
  /*
  ** setVisibleRole(guildID, userID, roleID)
  ** Description: set the visible role of a user
  */
  setVisibleRole(guildID, userID, roleID) {
    var path = util.json.getServerJSON(guildID),
        data = util.json.JSONFromFile(path);
    if (data.xp.roles == undefined) data.xp.roles = {}; // Add roles object if it doesn't already exist
    if (data.xp.roles.visible == undefined) data.xp.roles.visible = {};
    data.xp.roles.visible[userID] = roleID; // store the user's visible role
    util.json.writeJSONToFile(data, path);
  },
  /*
  ** getVisibleRole(guildID, userID)
  ** Description: get the visible role of a user
  */
  getVisibleRole(guildID, userID) {
    var path = util.json.getServerJSON(guildID),
        data = util.json.JSONFromFile(path);
    if (data.xp.roles == undefined) data.xp.roles = {}; // Add roles object if it doesn't already exist
    if (data.xp.roles.visible == undefined) data.xp.roles.visible = {};
    if (data.xp.roles.visible[userID] !== undefined) {
      if (this.getMinimumXPForRole(guildID, data.xp.roles.visible[userID]) > this.getXP(userID, guildID)) {
        return this.getHighestRole(guildID, this.getLevel(userID, guildID));
      } else {
        return data.xp.roles.visible[userID];
      }
    } else {
      return this.getHighestRole(guildID, this.getLevel(userID, guildID));
    }
  },
  /*
  ** removeVisibleRole(guildID, userID)
  ** Description: set the visible role of a user
  */
  removeVisibleRole(guildID, userID) {
    var path = util.json.getServerJSON(guildID),
        data = util.json.JSONFromFile(path);
    if (data.xp.roles == undefined) data.xp.roles = {}; // Add roles object if it doesn't already exist
    if (data.xp.roles.visible == undefined) data.xp.roles.visible = {};
    delete data.xp.roles.visible[userID]; // remove the visible role
    util.json.writeJSONToFile(data, path);
  },

  /*
  ** isRoleHigher(guildID, first_role, second_role)
  ** Description: check if one role is higher than another
  */
  isRoleHigher(guildID, first_role, second_role) {
    if (this.getMinimumXPForRole(guildID, first_role) > this.getMinimumXPForRole(guildID, second_role)) return true;
    return false;
  },
  /*
  ** removeRole(guildID, roleID)
  ** Description: remove role from level
  */
  removeRole(guildID, roleID) {
    var path = util.json.getServerJSON(guildID),
        data = util.json.JSONFromFile(path);
    if (data.xp.roles == undefined) data.xp.roles = {}; // Add roles object if it doesn't already exist
    delete data.xp.roles[roleID]; // delete role lol
    util.json.writeJSONToFile(data, path);
  },

  /*
  ** updateRoles(userID, guildID)
  ** Description: update roles for a user.
  ** Comment: Also supports removal of xp and not just gaining
  */
  updateRoles(userID, guildID) {
    var path = util.json.getServerJSON(guildID),
        data = util.json.JSONFromFile(path);
    if (data.xp.roles == undefined) data.xp.roles = {}; // Add roles object if it doesn't already exist
    for (var role in data.xp.roles) {
      var member = client.guilds.cache.get(guildID).members.cache.get(userID); // Get the member
      if (member !== undefined && this.getLevel(userID, guildID) >= data.xp.roles[role] && this.getMinimumXPForRole(guildID, role) <= this.getMinimumXPForRole(guildID, this.getVisibleRole(guildID, userID))) {
        member.roles.add(role, "Reached level threshold"); // Add the role to the user
      } else {
        if (member.roles.cache.get(role) !== undefined) { // If the user has the role and they aren't high enough level to have it (or their visible role permits them to) remove it
          member.roles.remove(role, "Under level threshold");
        }
      }
    }
  },
  /*
  ** getHighestRole(guildID, level)
  ** Description: gets highest role for specific level
  */
  getHighestRole(guildID, level) {
    var path = util.json.getServerJSON(guildID),
        data = util.json.JSONFromFile(path),
        output = "";
    if (data.xp.roles == undefined) data.xp.roles = {}; // Add roles object if it doesn't already exist
    for (var role in data.xp.roles) {
      if (level >= data.xp.roles[role]) {
        output = role;
      }
    }
    return output;
  },
  /*
  ** getNextHighestRole(guildID, level)
  ** Description: gets next highest role for specific level
  */
  getNextHighestRole(guildID, level) {
    var path = util.json.getServerJSON(guildID),
        data = util.json.JSONFromFile(path),
        output = "";
    if (data.xp == undefined) data.xp = {};
    if (data.xp.roles == undefined) data.xp.roles = {}; // Add roles object if it doesn't already exist
    for (var role in data.xp.roles) {
      if (level < data.xp.roles[role]) {
        output = role;
        break;
      }
    }
    return output;
  },
  /*
  ** getMinimumXPForRole(guildID, roleID)
  ** Description: gets minimum XP needed to have a role
  */
  getMinimumXPForRole(guildID, roleID) {
    var path = util.json.getServerJSON(guildID),
        data = util.json.JSONFromFile(path),
        output = 0;
    if (data.xp.roles == undefined) data.xp.roles = {}; // Add roles object if it doesn't already exist
    for (var role in data.xp.roles) {
      if (roleID == role) {
        output = this.getMinXP(data.xp.roles[role]);
      }
    }
    return output;
  },
  /*
  ** getLevelUpMessages(guildID, userID)
  ** Description: gets level up messages.
  */
  getLevelUpMessages(guildID, userID) {
    var path = util.json.getServerJSON(guildID),
        data = util.json.JSONFromFile(path);
    if (data.xp == undefined) data.xp = {};
    if (data.xp.levelUpMessages == undefined) data.xp.levelUpMessages = {}; // Add roles object if it doesn't already exist
    if (data.xp.levelUpMessages[userID] == undefined) data.xp.levelUpMessages[userID] = {}; // Add roles object if it doesn't already exist
    return data.xp.levelUpMessages[userID];
  },
  /*
  ** addLevelUpMessage(guildID, userID, message)
  ** Description: gets minimum XP needed to have a role
  */
  addLevelUpMessage(guildID, channelID, messageID, userID, level, message) {
    var path = util.json.getServerJSON(guildID),
        data = util.json.JSONFromFile(path);
    if (data.xp == undefined) data.xp = {};
    if (data.xp.levelUpMessages == undefined) data.xp.levelUpMessages = {}; // Add roles object if it doesn't already exist
    if (data.xp.levelUpMessages[userID] == undefined) data.xp.levelUpMessages[userID] = {}; // Add roles object if it doesn't already exist
    if (data.xp.levelUpMessages[userID][level] == undefined) data.xp.levelUpMessages[userID][level] = {}
    data.xp.levelUpMessages[userID][level].message = message;
    data.xp.levelUpMessages[userID][level].link = `https://discordapp.com/channels/${guildID}/${channelID}/${messageID}`;
    util.json.writeJSONToFile(data, path);
  },
  /*
  ** formatLevelUpMessages(guildID, userID, page)
  ** Description: gets level up messages, except cool
  */
  formatLevelUpMessages(guildID, userID, page) {
    var pageSize = 10,
        output = "",
        embed = new Discord.MessageEmbed(),
        lvlupMsgs = util.xp.getLevelUpMessages(guildID, userID);
    var i = 0;
    embed.setTitle(`Level-up History for ${client.users.cache.get(userID) ? `${client.users.cache.get(userID).username}` : userID}`);
    for (var level in lvlupMsgs) {
      i++;
      if (i < (page-1)*pageSize+(page-1)) continue; // Page system
      if (i > page*pageSize) break;
      if (typeof lvlupMsgs[level] !== 'object') {
        output += `Level ${level}: ${lvlupMsgs[level]}\n`;
      } else {
        output += `Level ${level}: ${lvlupMsgs[level].message} [Link](${lvlupMsgs[level].link})\n`;
      }
    }
    if (output == "") {
      return "None found";
    } else {
      embed.setFooter(`\nPage ${page}`);
      embed.setDescription(output);
      return embed;
    }
    return undefined;
  },

  getXPHistory(guildID, userID, page) {
    var path = util.json.getServerJSON(guildID),
        data = util.json.JSONFromFile(path),
        pageSize = 10,
        output = "",
        embed = new Discord.MessageEmbed();
    embed.setAuthor(`${client.guilds.cache.get(guildID).name}`, `${client.guilds.cache.get(guildID).iconURL()}`);
    embed.setTitle(`XP History for ${client.users.cache.get(userID).username}`);
    if (data.xp == undefined) data.xp = {};
    if (data.xp.history == undefined) data.xp.history = {}; // if server doesn't have xp history yet, add it so js doesn't scream undefined
    var i = 0;
    for (var day in data.xp.history) {
      if (data.xp.history[day][userID] == undefined) continue;
      i++;
      if (i < (page-1)*pageSize+(page-1)) continue; // Page system
      if (i > page*pageSize) break;
      var xp = -1;
      if (data.xp.history[day][userID] !== undefined) xp = data.xp.history[day][userID].amount || 0;
      var rank = this.getDayRank(guildID, userID, day);
      output += `*${new Date(day*86400000+86400000).toLocaleDateString("en-US")}*: ${xp} xp, +${this.getXPGained(guildID, userID, day)} gained today, **#${rank}**\n`;
    }
    embed.setDescription(output);
    return embed;
  },
  getDayRank(guildID, userID, day) {
    var path = util.json.getServerJSON(guildID),
        data = util.json.JSONFromFile(path);
    if (data.xp.history == undefined) data.xp.history = {}; // if server doesn't have xp history yet, add it so js doesn't scream undefined
    if (data.xp.history[day] == undefined) return -1;
    if (data.xp.history[day][userID] == undefined) return -1;
    if (data.xp.history[day][userID].rank == undefined) return -1;
    return data.xp.history[day][userID].rank;
  },
  getXPGained(guildID, userID, day) {
    var path = util.json.getServerJSON(guildID),
        data = util.json.JSONFromFile(path);
    if (data.xp == undefined) data.xp = {};
    if (data.xp.history == undefined) data.xp.history = {}; // if server doesn't have xp history yet, add it so js doesn't scream undefined
    var xpBefore = 0;
    for (var i = 1; i < day-18298; i++) {
      if (data.xp.history[day-i] !== undefined && data.xp.history[day-i][userID] !== undefined && data.xp.history[day-i][userID].amount !== undefined) {
        xpBefore = data.xp.history[day-i][userID].amount;
        break;
      }
    }
    var xpAfter = 0;
    if (data.xp.history[day] !== undefined && data.xp.history[day][userID] !== undefined) xpAfter = data.xp.history[day][userID].amount;
    if (xpAfter == 0) return 0;
    return xpAfter - xpBefore;
  },
  getXPGainedAvg(guildID, userID, range) {
    var day = Math.floor((new Date(Date.now()).getTime())/86400000)-1; // days since epoch - 1
    var num = 0;
    var i = 0;
    for (i = 0; i < range; i++) {
      num += this.getXPGained(guildID, userID, day-i);
    }
    return Math.round(num/i);
  },
  //          *****************************************       USER XP        *****************************************
  addXPGlobal(userID, guildID) {
    var path = globalXPJson,
        data = util.json.JSONFromFile(path);
    if (!this.isTrusted(guildID)) return;
    if (this.hasGlobalXPCooldown(userID)) return;
    if (data[userID] == undefined) data[userID] = 0;
    data[userID] += this.getExpGained(this.getLevelXP(this.getXPGlobal(userID)));
    util.json.writeJSONToFile(data, path);
    this.addGlobalXPCooldown(userID);
  },

  getXPGlobal(userID, stringify) {
    var path = globalXPJson,
        data = util.json.JSONFromFile(path);
    if (data[userID] == undefined) return 0;
    if (stringify) return util.general.numberWithCommas(data[userID]);
    return data[userID];
  },
  getGlobalLeaderboard(page) {
    var pageSize = 10,
        output   = "",
        path     = globalXPJson,
        data     = util.json.JSONFromFile(path),
        embed    = new Discord.MessageEmbed();
    // Sort by putting in array and using the sort() function
    var array = [];
    for (var user in data) {
      if (isNaN(parseInt(user))) continue; // skip if they're not a user
      array.push({ id: user, xp: data[user] });
    }
    array.sort(function(a, b) { // sort
      return b.xp - a.xp;
    });
    embed.setColor("#ff8080");
    embed.setTitle("Global Leaderboard");
    var i = 0;
    for (var object in array) {
      if (isNaN(parseInt(array[object].id))) continue; // Handle non-users in xp object
      if (array[object].id == "672280373065154569") continue; // Skip bot user from leaderboard
      if (client.users.cache.get(array[object].id) !== undefined && client.users.cache.get(array[object].id).bot) continue; // Skip user if they are a bot
      i++;
      if (i < (page-1)*pageSize+(page-1)) continue; // Page system
      if (i > page*pageSize) break;
      var user = client.users.cache.get(array[object].id);
      if (user == undefined) user = { username: "Unknown", id: array[object].id }; // Replace username with "Unknown" since we don't know what their real username is
      var string = `${i}. <@${user.id}> - ${this.getXPGlobal(array[object].id, true)} xp, Level ${this.getLevelXP(array[object].xp)}\n`;
      if (i == 1) {
        output += `**${string}**`;
        embed.setThumbnail(`${user.displayAvatarURL() ? user.displayAvatarURL() : ""}`);
      } else output += string;
    }
    embed.setDescription(output);
    embed.setFooter(`Page ${page}`);
    embed.setTimestamp();
    return embed;
  },
  getGlobalLeaderboardRank(userID) {
    var path     = globalXPJson,
        data     = util.json.JSONFromFile(path);
    // Sort by putting in array and using the sort() function
    var array = [];
    for (var user in data) {
      if (isNaN(parseInt(user))) continue;
      array.push({ id: user, xp: data[user] });
    }
    array.sort(function(a, b) {
      return b.xp - a.xp;
    });
    var i = 0;
    for (var object in array) {
      if (isNaN(parseInt(array[object].id))) continue; // Handle non-users in xp object
      if (array[object].id == "672280373065154569") continue; // Skip bot user from leaderboard
      if (client.users.cache.get(array[object].id) !== undefined && client.users.cache.get(array[object].id).bot) continue; // Skip user if they are a bot
      i++;
      if (array[object].id !== userID) continue;
      return i;
    }
    return "Unknown Rank";
  },
  addGlobalXPCooldown(user) {
    globalCooldowns[user] = 20;
  },
  hasGlobalXPCooldown(user) {
    if (globalCooldowns[user] == undefined) return false; else return true;
  },

  /*
  ** addTrusted(guildID)
  ** Description: adds guild as a trusted guild, meaning global xp is enabled.
  */
  addTrusted(guildID) {
    var path = util.json.getServerJSON(guildID),
        data = util.json.JSONFromFile(path);
    if (data.xp == undefined) data.xp = {};
    data.xp.trusted = true;
    util.json.writeJSONToFile(data, path);
  },
  /*
  ** isTrusted(guildID)
  ** Description: checks if guild is a trusted guild, meaning global xp is enabled.
  */
  isTrusted(guildID) {
    var path = util.json.getServerJSON(guildID),
        data = util.json.JSONFromFile(path);
    if (data.xp == undefined) data.xp = {};
    return data.xp.trusted;
  },
  disableXPGain(guildID, channelID) {
    var path = util.json.getServerJSON(guildID),
        data = util.json.JSONFromFile(path);
    if (data.xp == undefined) data.xp = {};
    if (data.xp.xpBlacklist == undefined) data.xp.xpBlacklist = [];
    data.xp.xpBlacklist.push(channelID);
    util.json.writeJSONToFile(data, path);
  },
  enableXPGain(guildID, channelID) {
    var path = util.json.getServerJSON(guildID),
        data = util.json.JSONFromFile(path);
    if (data.xp == undefined) data.xp = {};
    if (data.xp.xpBlacklist == undefined) data.xp.xpBlacklist = [];
    if (data.xp.xpBlacklist.indexOf(channelID) !== -1) data.xp.xpBlacklist.splice(data.xp.xpBlacklist.indexOf(channelID), 1);
    util.json.writeJSONToFile(data, path);
  },
  enabledXPGain(guildID, channelID) {
    var path = util.json.getServerJSON(guildID),
        data = util.json.JSONFromFile(path);
    if (data.xp == undefined) return false;
    if (data.xp.xpBlacklist == undefined) return true;
    if (data.xp.xpBlacklist.indexOf(channelID) == -1) return true;
    return false;
  }
}
