module.exports = {
  desc: "Enable a module",
  args: "<module name>",
  execute(message, command) {
    var selectedmodule = command.getArgs()[0];
    if (selectedmodule == undefined) { // If the module isn't specified by the user, it's auto-invalid.
      message.channel.send("You have specified an invalid module.");
      return;
    }

    if (modules[selectedmodule] !== undefined) { // Check for server module
      if (message.member.hasPermission("MANAGE_GUILD")) { // Needs permission
        util.modules.enable(selectedmodule, message.guild.id);
        message.channel.send(`Enabled **${selectedmodule}** module! View module commands in \`${util.general.getServerPrefix(message.guild.id)}help ${selectedmodule}\`. ${util.modules.property(selectedmodule, "tutorial", message.guild.id) ? `View tutorial with -tutorial ${selectedmodule}` : ""}`);
      } else {
        message.channel.send(`You don't have permission`);
      }
    } else if (usermodules[selectedmodule] !== undefined) { // Check for user module
      util.modules.enableUser(selectedmodule, message.author.id);
      message.channel.send(`Enabled **${selectedmodule}** user module! View module commands in \`${util.general.getServerPrefix(message.guild.id)}help ${selectedmodule}\`. ${util.modules.property(selectedmodule, "tutorial", message.guild.id) ? `View tutorial with -tutorial ${selectedmodule}` : ""}`);
    } else { // Invalid module
      message.channel.send("You have specified an invalid module.");
    }
  }
}
