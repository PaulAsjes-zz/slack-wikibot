'use strict';

const Slack = require('slack-client');

class Bot {
  constructor(opts) {
    let slackToken = opts.token;
    let autoReconnect = opts.autoReconnect || true;
    let autoMark = opts.autoMark || true;

    this.slack = new Slack(slackToken, autoReconnect, autoMark);

    this.slack.on('open', () => {
      console.log(`Connected to ${this.slack.team.name} as ${this.slack.self.name}`);
      this.name = this.slack.self.name;
    });

    // Create an ES6 Map to store our regular expressions
    this.keywords = new Map();

    this.slack.on('message', (message) => {
      // Only process text messages
      if (!message.text) {
        return;
      }

      let channel = this.slack.getChannelGroupOrDMByID(message.channel);
      let user = this.slack.getUserByID(message.user);

      // Loop over the keys of the keywords Map object and test each
      // regular expression against the message's text property
      for (let regex of this.keywords.keys()) {    
        if (regex.test(message.text)) {
          let callback = this.keywords.get(regex);
          callback(message, channel, user);
        }
      }
    });

    this.slack.on('error', (err) => {
      console.log('Error:', err);
    });

    this.slack.login();
  }

  // Return the name of the bot
  getName() {
    return this.slack.self.name;
  }

  setTypingIndicator(channel) {
    this.slack._send({ type: "typing", channel: channel });
  }

  getMembersByChannel(channel) {
    // If the channel has no members then that means we're in a DM
    if (!channel.members) {
      return false;
    }

    // Only select members which are active and not a bot
    let members = channel.members.filter((member) => {
      let m = this.slack.getUserByID(member);
      // Make sure the member is active (i.e. not set to 'away' status)
      return (m.presence === 'active' && !m.is_bot);
    });

    // Get the names of the members
    members = members.map((member) => {
      return this.slack.getUserByID(member).name;
    });

    return members;
  }

  respondTo(keywords, callback, start) {
    // If 'start' is truthy, prepend the '^' anchor to instruct the
    // expression to look for matches at the beginning of the string
    if (start) {
      keywords = '^' + keywords;
    }

    // Create a new regular expression, setting the case insensitive (i) flag
    // Note: avoid using the global (g) flag
    let regex = new RegExp(keywords, 'i');

    // Set the regular expression to be the key, with the callback function as the value
    this.keywords.set(regex, callback);
  }
}

// Export the Bot class, which will be imported when 'require' is used
module.exports = Bot;
