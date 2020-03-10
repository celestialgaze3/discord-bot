module.exports = {
  desc: "Set the channel where join/leave messages are sent",
  execute(message, command) {
    util.joinleave.setJoinLeaveChannel(message.guild.id, message.channel.id);
    message.channel.send(`Set channel to **#${message.channel.name}**`);
  }
}
