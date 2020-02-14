const desc = "Get activity history of user",
      args = "<user>";
const execute = (message, command) => {
  var path = util.json.getServerJSON(message.guild.id),
      data = util.json.JSONFromFile(path),
      output = "";

  if (command.getArgs().length > 0) {
    var user = message.mentions.users.first();
    if (user == undefined) {
      message.channel.send("You must specify a valid user.");
      return;
    }
    if (data.xp.history == undefined) data.xp.history = {}; // if server doesn't have xp history yet, add it so js doesn't scream undefined
    for (var day in data.xp.history) {
      var xp = data.xp.history[day][user.id] || 0;
      output += `*${new Date(day*86400000+86400000).toLocaleDateString("en-US")}*: ${xp} xp gained\n`;
    }
  } else {
    message.channel.send("You must specify a valid user.");
    return;
  }
  message.channel.send(output);
}

exports.args = args;
exports.desc = desc;
exports.execute = execute;
