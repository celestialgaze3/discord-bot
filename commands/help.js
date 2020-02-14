const desc = "Get a list of commands";
      args = "<page OR command name> <server/bot/all> ";

const execute = (message, command) => {
  var helpType   = command.getArgs()[1],                                                       // second argument
      server     = helpType == "server" || helpType == "all" || helpType == undefined,         // whether we want server commands or not
      bot        = helpType == "bot" || helpType == "all" || helpType == undefined,            // whether we want bot commands or not
      page       = parseInt(command.getArgs()[0]),                                             // page number
      pageSize   = 10,                                                                         // size of each page
      cmdlist    = { servercmds: {} },                                                         // list of commands and their descriptions
      servercmds = util.json.JSONFromFile(util.json.getServerJSON(message.guild.id)).commands, // list of server commands
      prefix     = util.getServerPrefix(message.guild.id),                                     // server prefix
      draft      = "",                                                                         // message to send
      length     = 0,                                                                          // length of cmdlist
      selectedcmd = commands[command.getArgs()[0]] || modulecmds[command.getArgs()[0]];
  if (selectedcmd !== undefined) {
    message.channel.send(`**${util.getServerPrefix(message.guild.id)}${command.getArgs()[0]} ${selectedcmd.args}** - ${selectedcmd.desc}`);
    return;
  } else if (servercmds[command.getArgs()[0]] !== undefined) {
    message.channel.send(`**${util.getServerPrefix(message.guild.id)}${command.getArgs()[0]}** - ${servercmds.descriptions[command.getArgs()[0]] ? servercmds.descriptions[command.getArgs()[0]] : "No description provided"}`);
    return;
  }
  if (page == undefined) page = 1;
  if (isNaN(page)) page = 1;
  if (page <= 0) page = 1;

  var genCmdObj = function(desc, category) {
    var obj = {
      description: desc,
      category: category
    }
    return obj;
  }
  if (bot) {
    // Construct a list of all of the commands with their descriptions
    for (var cmd in commands) {
      var category = commands[cmd].path.split(`${__basedir}/commands/`)[1];
      if (category.includes("/")) {
        category = category.substring(0, category.lastIndexOf("/"));
      } else {
        category = '';
      }
      cmdlist[cmd] = genCmdObj(commands[cmd].desc, category);
      length++;
    }
    // Do the same for module commands.
    for (var cmd in modulecmds) {
      var category = modulecmds[cmd].path.split(`${__basedir}/commands/`)[1];
      if (category.includes("/")) {
        category = category.substring(0, category.lastIndexOf("/"));
      } else {
        category = '';
      }
      if (util.modules.isEnabled(modulecmds[cmd].module, message.guild.id)) {
        cmdlist[cmd] = genCmdObj(modulecmds[cmd].desc, category);
        length++;
      }
    }
  }
  if (server) {
    // Do the same for server-specific commands
    for (var command in servercmds) {
      cmdlist.servercmds[command] = servercmds.descriptions[command];
      if (cmdlist.servercmds[command] == undefined) cmdlist.servercmds[command] = "No description provided";
      length++;
    }
  }


  // Skip until the first index of the current page and then print out the next pageSize elements. If it runs out of commands to list in the
  // cmdlist, begin listing cmdlist.servercmds until pageSize elements have been printed or until it reaches the end of cmdlist.servercmds
  var iteration = 0;
  var categories = {};
  for (var command in cmdlist) {
    if (iteration > page*pageSize-1) break; // no need to continue the loop after we've printed all we need to.
    if (command == "servercmds") continue;      // skip over servercmds object as this contains the servercmds and isn't a command per se
    iteration++;
    if (iteration < (page-1)*pageSize+1) continue;  // skip over if the beginning of the selected page has not been reached
    if (cmdlist[command].category !== "") {
      if (categories[`${cmdlist[command].category}`] == undefined) categories[`${cmdlist[command].category}`] = {}; // if it doesnt exist create it cus nested objects are cancer
      categories[`${cmdlist[command].category}`][command] = cmdlist[command];
    } else {
      draft += `**${prefix}${command} ${commands[command].args}** - ${cmdlist[command].description}\n`;
    }
  }
  var categoryDraft = ""; // draft for category so it can be prefixed later

  // loop through all commands with category and construct the string to be prefixed
  for (var category in categories) {
    categoryDraft += `  --- **${category} commands** ---\n`;
    for (var command in categories[category]) {
      var cmd = commands[command] || modulecmds[command];
      categoryDraft += `  **${prefix}${command} ${cmd.args}** - ${categories[category][command].description}\n`;
    }
  }
  if (categoryDraft !== "" || draft !== "") {
    draft = categoryDraft + " ---\n" + draft; // prefix with categories
    draft = `--- **Bot commands** ---\n` + draft; // prefix with title
  }

  if (server && !(iteration > page*pageSize-1)) draft += `--- **Server commands** ---\n`;

  for (var command in cmdlist.servercmds) {
    if (iteration > page*pageSize-1) break;
    iteration++;
    if (iteration < (page-1)*pageSize+1) continue; // a few of the same checks as above

    draft += `**${prefix}${command}** - ${cmdlist.servercmds[command]}\n`;
  }

  if (draft == `--- **Server commands** ---\n`) draft = `Out of bounds\n`; // if neither bot nor server commands were found, the user dun fucked up

  draft += `Page (${page}/${Math.floor(length/pageSize)+1})`;
  message.channel.send(draft);
}

exports.args = args;
exports.desc = desc;
exports.execute = execute;
